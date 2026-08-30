#!/usr/bin/env node
/**
 * Renders the raster icons and the social card from the SVG sources.
 *
 * They have to exist as PNG: iOS ignores manifest icons entirely and takes
 * `apple-touch-icon`, which it will not accept as SVG, so an installed portal
 * showed a blank tile on iPhone. WhatsApp - which is how this portal actually
 * gets passed around - needs a raster `og:image` or it renders a bare link.
 *
 * This shells out to headless Chromium rather than taking an image library as
 * a dependency, so `npm test` and `npm run serve` still install nothing. It is
 * not part of the build: the PNGs are committed, and this only regenerates
 * them when the SVGs or the card change. Point CHROME at a binary if the
 * defaults below miss.
 */

import { execFileSync } from 'node:child_process';
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = join(ROOT, 'assets');

const CANDIDATES = [
  process.env.CHROME,
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function findChrome() {
  for (const path of CANDIDATES) {
    try {
      await stat(path);
      return path;
    } catch {
      /* try the next one */
    }
  }
  throw new Error(`no Chromium found. Set CHROME to a binary. Tried:\n  ${CANDIDATES.join('\n  ')}`);
}

const BASE_FLAGS = ['--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars'];

/**
 * How much shorter than `--window-size` the layout viewport actually is.
 *
 * Chromium subtracts its own chrome from the window height, so a 512-tall
 * window laid out at 512x425 - and every icon came out with its bottom 87px
 * cropped to white, at every size. The offset is measured here rather than
 * hardcoded, because it is a property of the binary and the platform, not of
 * this project.
 */
async function measureChromeHeight(chrome, dir) {
  const probe = join(dir, 'probe.html');
  const asked = 600;
  await writeFile(probe, '<div id="v"></div><script>v.textContent=innerWidth+"x"+innerHeight<\/script>');
  const dom = execFileSync(
    chrome,
    [...BASE_FLAGS, `--window-size=800,${asked}`, '--virtual-time-budget=800', '--dump-dom', `file://${probe}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const seen = dom.match(/id="v">(\d+)x(\d+)/);
  if (!seen) throw new Error('could not measure the viewport');
  return asked - Number(seen[2]);
}

/**
 * Screenshots one HTML string at an exact size.
 *
 * The page goes through a file, not a data: URL - the social card inlines the
 * font as base64, and at that length Chromium accepted the argument and then
 * wrote no file at all, reporting success either way.
 */
async function shoot(chrome, html, out, { width, height, dir, chromeHeight }) {
  const page = join(dir, `page-${Math.random().toString(36).slice(2)}.html`);
  await writeFile(page, html);
  execFileSync(
    chrome,
    [
      ...BASE_FLAGS,
      // The capture is cropped to the window, so the extra height only has to
      // exist for layout; it never reaches the file.
      `--window-size=${width},${height + chromeHeight}`,
      '--virtual-time-budget=1200',
      `--screenshot=${out}`,
      `file://${page}`,
    ],
    { stdio: 'pipe' },
  );
  // Chromium can exit 0 having written nothing; the caller must not trust it.
  await stat(out);
  await trimHeight(out, height);
}

/** An SVG scaled to fill the frame exactly, with no page margin. */
function iconPage(svg, size) {
  return `<style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
    svg{display:block;width:${size}px;height:${size}px}
  </style>${svg}`;
}

/**
 * The social card. Deliberately says what the portal does rather than showing
 * the interface: a screenshot at 1200x630 is unreadable in a chat preview.
 */
async function cardPage() {
  const font = await readFile(join(ASSETS, 'fonts', 'assistant-hebrew.woff2'));
  const svg = await readFile(join(ASSETS, 'icon.svg'), 'utf8');
  // box-sizing matters here: with content-box the padding widened the body
  // past 1200px, and in RTL that pushed the whole card off the right edge.
  return `<style>
    *{box-sizing:border-box}
    @font-face{font-family:Assistant;font-weight:400 800;font-display:block;
      src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2')}
    html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden}
    body{background:#050810;color:#f8fafc;font-family:Assistant,sans-serif;direction:rtl;
      display:flex;flex-direction:column;justify-content:center;gap:26px;padding:0 88px;
      background-image:radial-gradient(900px 460px at 82% 8%, rgba(59,130,246,.20), transparent 62%),
                       radial-gradient(760px 420px at 10% 96%, rgba(168,85,247,.18), transparent 60%)}
    .mark,.mark svg{display:block;width:92px;height:92px}
    h1{font-size:76px;line-height:1.08;font-weight:800;margin:0;letter-spacing:-.01em}
    p{font-size:33px;line-height:1.5;font-weight:600;margin:0;color:#94a3b8}
    .rule{height:6px;width:132px;border-radius:99px;
      background:linear-gradient(90deg,#3b82f6,#a855f7)}
  </style>
  <div class="mark">${svg}</div>
  <div class="rule"></div>
  <h1>מכאב לפרומפט שעובד</h1>
  <p>50 מנועי פרומפטים בעברית.<br>הכל נשמר אצלכם במכשיר.</p>`;
}


/* --- PNG height trim ------------------------------------------------------
 *
 * The capture is the size of the *window*, while layout gets the window minus
 * Chromium's chrome, so every shot comes out with blank rows at the bottom.
 * They are dropped here rather than by taking an image library as a
 * dependency.
 *
 * Only trailing rows are removed, which is the one crop a PNG allows without
 * un-filtering anything: a scanline's filter may reference the row above it,
 * never the row below, so a prefix of scanlines is still a valid image.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function readChunks(png) {
  const chunks = [];
  let at = 8;
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    chunks.push({ type: png.toString('ascii', at + 4, at + 8), data: png.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  return chunks;
}

/** Rewrites `file` in place with only its first `height` rows. */
async function trimHeight(file, height) {
  const png = await readFile(file);
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${file} is not a PNG`);

  const chunks = readChunks(png);
  const ihdr = chunks.find((c) => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0);
  const current = ihdr.readUInt32BE(4);
  if (current === height) return;
  if (current < height) throw new Error(`${file} is ${current} rows, cannot grow to ${height}`);

  const depth = ihdr[8];
  const colour = ihdr[9];
  if (ihdr[12] !== 0) throw new Error('interlaced PNGs are not supported');
  const stride = 1 + Math.ceil((width * CHANNELS[colour] * depth) / 8);

  const raw = inflateSync(Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const kept = raw.subarray(0, stride * height);

  const header = Buffer.from(ihdr);
  header.writeUInt32BE(height, 4);

  const rebuilt = [PNG_SIGNATURE, chunk('IHDR', header)];
  for (const c of chunks) {
    if (c.type === 'IHDR' || c.type === 'IDAT' || c.type === 'IEND') continue;
    rebuilt.push(chunk(c.type, c.data));
  }
  rebuilt.push(chunk('IDAT', deflateSync(kept, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  await writeFile(file, Buffer.concat(rebuilt));
}

const TARGETS = [
  { file: 'icon-192.png', source: 'icon.svg', size: 192 },
  { file: 'icon-512.png', source: 'icon.svg', size: 512 },
  { file: 'icon-maskable-512.png', source: 'icon-maskable.svg', size: 512 },
  // iOS composites its own rounded corners, so this one keeps a solid ground.
  { file: 'apple-touch-icon.png', source: 'icon.svg', size: 180 },
];

async function main() {
  const chrome = await findChrome();
  const work = await mkdtemp(join(tmpdir(), 'sp-icons-'));
  try {
    const chromeHeight = await measureChromeHeight(chrome, work);
    for (const { file, source, size } of TARGETS) {
      const svg = await readFile(join(ASSETS, source), 'utf8');
      const out = join(ASSETS, file);
      await shoot(chrome, iconPage(svg, size), out, { width: size, height: size, dir: work, chromeHeight });
      console.log(`${file} — ${size}x${size}`);
    }
    const card = join(ASSETS, 'og-image.png');
    await shoot(chrome, await cardPage(), card, { width: 1200, height: 630, dir: work, chromeHeight });
    console.log('og-image.png — 1200x630');
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

await main();
