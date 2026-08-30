import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/*
 * Contrast is a property of the colour values, so it is checked here against
 * the stylesheet rather than in a browser. An audit of the rendered page found
 * category labels as low as 2.13:1 - lime on a light card - and white CTA text
 * at 3.68:1; these assertions are the arithmetic that fix stated, kept honest.
 */

const CSS = new URL('../styles.css', import.meta.url);

const hex = (value) => {
  const clean = value.trim().replace('#', '');
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

const relativeLuminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Composites `colour` at `alpha` over `backdrop`, as the browser paints it. */
const over = (colour, alpha, backdrop) => colour.map((v, i) => v * alpha + backdrop[i] * (1 - alpha));

// The surfaces text actually lands on, measured from the rendered page.
const DARK_PAGE = hex('#050810');
const DARK_CARD = over(hex('#0f172a'), 0.66, DARK_PAGE);
const LIGHT_PAGE = hex('#f5f7fb');
const LIGHT_CARD = over(hex('#ffffff'), 0.86, LIGHT_PAGE);

const AA_NORMAL = 4.5;

async function tokens() {
  const css = await readFile(CSS, 'utf8');
  const dark = new Map();
  const light = new Map();
  // Anchored to the line start: the light-theme rules below also contain
  // `[data-accent='blue']`, and an unanchored match let them overwrite these.
  for (const [, name, colour] of css.matchAll(
    /^\[data-accent='(\w+)'\]\s*\{[^}]*--accent-text:\s*(#[0-9a-f]{3,6})/gim,
  )) {
    dark.set(name, colour);
  }
  for (const [, name, colour] of css.matchAll(
    /:root\[data-theme='light'\]\s*\[data-accent='(\w+)'\]\s*\{\s*--accent-text:\s*(#[0-9a-f]{3,6})/gi,
  )) {
    light.set(name, colour);
  }
  return { css, dark, light };
}

test('every category accent is legible as text in both themes', async () => {
  const { dark, light } = await tokens();
  assert.ok(dark.size >= 11, `only ${dark.size} dark accents found`);
  assert.equal(light.size, dark.size, 'every accent needs a light-theme text colour');

  for (const [name, colour] of dark) {
    const ratio = contrast(hex(colour), DARK_CARD);
    assert.ok(ratio >= AA_NORMAL, `${name} is ${ratio.toFixed(2)}:1 on the dark card`);
  }
  for (const [name, colour] of light) {
    const ratio = contrast(hex(colour), LIGHT_CARD);
    assert.ok(ratio >= AA_NORMAL, `${name} is ${ratio.toFixed(2)}:1 on the light card`);
  }
});

test('the primary call to action carries legible white text', async () => {
  const { css } = await tokens();
  const from = css.match(/--cta-from:\s*(#[0-9a-f]{3,6})/i)?.[1];
  const to = css.match(/--cta-to:\s*(#[0-9a-f]{3,6})/i)?.[1];
  assert.ok(from && to, 'the CTA gradient tokens are missing');

  // 16px bold is normal text by WCAG's definition, so both ends owe 4.5:1.
  for (const [label, stop] of [['from', from], ['to', to]]) {
    const ratio = contrast(hex('#ffffff'), hex(stop));
    assert.ok(ratio >= AA_NORMAL, `the gradient's ${label} stop ${stop} gives white text ${ratio.toFixed(2)}:1`);
  }
});

test('dim body text stays legible on the surface it sits on', async () => {
  const { css } = await tokens();
  const faint = [...css.matchAll(/--text-faint:\s*(#[0-9a-f]{3,6})/gi)].map((m) => m[1]);
  assert.equal(faint.length, 2, 'expected a --text-faint for each theme');

  const [darkFaint, lightFaint] = faint;
  for (const backdrop of [DARK_PAGE, DARK_CARD]) {
    assert.ok(contrast(hex(darkFaint), backdrop) >= AA_NORMAL, `${darkFaint} is too dim on dark`);
  }
  for (const backdrop of [LIGHT_PAGE, LIGHT_CARD]) {
    assert.ok(contrast(hex(lightFaint), backdrop) >= AA_NORMAL, `${lightFaint} is too dim on light`);
  }
});
