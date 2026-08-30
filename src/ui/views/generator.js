/**
 * The generator - where a symptom becomes a prompt.
 *
 * Three tabs sit over one result: the engineered prompt, the naive prompt most
 * people would have written, and a line diff between them. The diff is the
 * teaching moment, and the reason the library stores a baseline for every
 * engine rather than only the good version.
 */

import { h, replace } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../core/i18n.js';
import { buildPrompts, defaultValues, missingRequired } from '../../core/registry.js';
import { MODIFIERS, MODIFIER_GROUPS, toggleModifier } from '../../core/modifiers.js';
import { diffLines, diffStats } from '../../core/diff.js';
import { measure } from '../../core/tokens.js';
import { TARGETS, buildTargetUrl } from '../../core/targets.js';
import { decodeState, encodeState } from '../router.js';
import { debounce } from '../../core/utils.js';
import { emptyState, favoriteButton, fieldControl, levelChip, techniqueChips } from '../components.js';
import { inviteCard } from '../footer.js';
import { toast } from '../toast.js';

export function renderGenerator({ app, router, params, query }) {
  const engine = app.registry.get(params.engineId);
  if (!engine) {
    return h(
      'div',
      { class: 'view view-enter' },
      emptyState({
        iconName: 'help',
        title: t('search.none'),
        action: h('button', { class: 'btn btn-primary', type: 'button', onClick: () => router.go('home') }, t('nav.home')),
      }),
    );
  }

  app.pushRecent(engine.id);

  /* --- state ------------------------------------------------------------ */

  const shared = query.v ? decodeState(query.v) : null;
  const values = { ...defaultValues(engine), ...(shared?.values ?? {}) };
  let activeModifiers = Array.isArray(shared?.mods) ? shared.mods : [];
  let tab = 'strategic';
  let generated = null;
  const controls = new Map();

  /* --- output plumbing --------------------------------------------------- */

  const outputText = h('textarea', {
    class: 'output-text',
    readonly: true,
    dir: 'auto',
    'aria-label': t('gen.result'),
    dataset: { variant: 'strategic' },
  });
  const diffBox = h('div', { class: 'output-text diff', dir: 'auto', hidden: true });
  const placeholder = h(
    'div',
    { class: 'output-empty' },
    icon('sparkles', { size: 34 }),
    h('p', null, t('gen.placeholder')),
  );
  const metaBar = h('div', { class: 'output-meta' });
  /*
   * Generating is silent to a screen reader: the prompt lands in a readonly
   * textarea nobody is focused on. The visible stats are bare numbers, so they
   * would announce "247 words - ~1100 tokens" with no hint that anything was
   * produced. This says what happened and where it went, and stays out of the
   * layout so the design is unchanged.
   */
  const announcer = h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' });
  const techniqueBar = h('div', { class: 'chip-row' });
  const diffLegend = h('p', { class: 'field-hint', hidden: true }, t('gen.diffLegend'));

  const tabButtons = ['strategic', 'generic', 'diff'].map((name) =>
    h(
      'button',
      {
        class: 'tab',
        type: 'button',
        role: 'tab',
        'aria-selected': String(name === tab),
        dataset: { variant: name },
        onClick: () => setTab(name),
      },
      t(`gen.tab.${name}`),
    ),
  );
  const tabRow = h('div', { class: 'tabs', role: 'tablist', hidden: true }, ...tabButtons);

  function setTab(name) {
    tab = name;
    for (const button of tabButtons) button.setAttribute('aria-selected', String(button.dataset.variant === name));
    paintOutput();
  }

  function paintOutput() {
    if (!generated) {
      placeholder.hidden = false;
      outputText.hidden = true;
      diffBox.hidden = true;
      tabRow.hidden = true;
      actionRow.hidden = true;
      metaBar.replaceChildren();
      techniqueBar.replaceChildren();
      diffLegend.hidden = true;
      return;
    }

    placeholder.hidden = true;
    tabRow.hidden = false;
    actionRow.hidden = false;
    const hasBaseline = Boolean(generated.generic);
    tabButtons[1].disabled = !hasBaseline;
    tabButtons[2].disabled = !hasBaseline;

    if (tab === 'diff' && hasBaseline) {
      outputText.hidden = true;
      diffBox.hidden = false;
      diffLegend.hidden = false;
      const diff = diffLines(generated.generic, generated.strategic);
      replace(
        diffBox,
        ...diff.map((row) =>
          h(
            'div',
            { class: 'diff-row', dataset: { type: row.type } },
            h('span', { class: 'diff-sign' }, row.type === 'added' ? '+' : row.type === 'removed' ? '-' : ' '),
            h('span', null, row.text || ' '),
          ),
        ),
      );
      const stats = diffStats(diff);
      replace(metaBar, h('span', null, t('gen.diffSummary', stats)));
    } else {
      diffBox.hidden = true;
      diffLegend.hidden = true;
      outputText.hidden = false;
      const isGeneric = tab === 'generic' && hasBaseline;
      outputText.dataset.variant = isGeneric ? 'generic' : 'strategic';
      outputText.value = isGeneric ? generated.generic : generated.strategic;
      const stats = measure(outputText.value);
      announcer.textContent = t('gen.announced', stats);
      replace(
        metaBar,
        h('span', null, t('gen.stats', stats)),
        isGeneric ? h('span', { class: 'chip chip-danger' }, t('gen.genericNote')) : null,
        !hasBaseline && tab !== 'strategic' ? h('span', null, t('gen.genericUnavailable')) : null,
      );
    }

    replace(techniqueBar, techniqueChips(generated.techniques));
  }

  /* --- generate ---------------------------------------------------------- */

  function readValues() {
    for (const [id, control] of controls) values[id] = control.read();
    return values;
  }

  function syncUrl() {
    router.silent('engine', { engineId: engine.id }, { v: encodeState({ values, mods: activeModifiers }) });
  }

  function generate({ track = true, validate = true } = {}) {
    readValues();
    const missing = missingRequired(engine, values);
    for (const [id, control] of controls) control.setInvalid(missing.includes(id) ? t('gen.required') : null);

    if (validate && missing.length) {
      toast(t('gen.missingRequired'), { tone: 'error' });
      controls.get(missing[0])?.focus();
      return false;
    }
    if (!validate && missing.length) return false;

    generated = buildPrompts(engine, values, activeModifiers);
    if (track) app.track('generate', engine.id);
    syncUrl();
    paintOutput();
    return true;
  }

  // Live preview re-renders quietly: no validation errors, no usage counted,
  // so typing does not inflate the analytics or shout at a half-filled form.
  const livePreview = debounce(() => {
    if (!app.settings().livePreview) return;
    if (!generated) return;
    generate({ track: false, validate: false });
  }, 320);

  /* --- form -------------------------------------------------------------- */

  const formFields = h('div', { class: 'form-stack' });
  for (const field of engine.fields) {
    const control = fieldControl(field, values[field.id], (value) => {
      values[field.id] = value;
      livePreview();
    });
    controls.set(field.id, control);
    formFields.append(control.element);
  }

  function fillExample() {
    if (!engine.example) return;
    for (const [id, value] of Object.entries(engine.example)) {
      values[id] = value;
    }
    replace(formFields);
    controls.clear();
    for (const field of engine.fields) {
      const control = fieldControl(field, values[field.id], (value) => {
        values[field.id] = value;
        livePreview();
      });
      controls.set(field.id, control);
      formFields.append(control.element);
    }
    generate();
  }

  /* --- modifiers --------------------------------------------------------- */

  const modifierBox = h('div', { class: 'form-stack' });
  function paintModifiers() {
    replace(
      modifierBox,
      ...MODIFIER_GROUPS.map((group) =>
        h(
          'div',
          { class: 'modifier-group' },
          h('span', { class: 'modifier-group-label' }, group.label),
          h(
            'div',
            { class: 'chip-row' },
            ...MODIFIERS.filter((modifier) => modifier.group === group.id).map((modifier) =>
              h(
                'button',
                {
                  class: 'chip',
                  type: 'button',
                  title: modifier.hint,
                  'aria-pressed': String(activeModifiers.includes(modifier.id)),
                  onClick: () => {
                    activeModifiers = toggleModifier(activeModifiers, modifier.id);
                    paintModifiers();
                    if (generated) generate({ track: false, validate: false });
                    else syncUrl();
                  },
                },
                modifier.label,
              ),
            ),
          ),
        ),
      ),
    );
  }
  paintModifiers();

  /* --- actions ----------------------------------------------------------- */

  function currentText() {
    return tab === 'generic' && generated?.generic ? generated.generic : generated?.strategic ?? '';
  }

  // The invitation lives here so it appears exactly where the visitor's eyes
  // already are - directly under the prompt they just took.
  const inviteSlot = h('div', { class: 'invite-slot' });

  /**
   * Called after a copy, which is the moment the portal has actually given
   * something. `inviteDecision` decides whether the ask has been earned yet;
   * this only renders it.
   */
  function maybeInvite() {
    if (inviteSlot.childElementCount > 0) return;
    if (!app.inviteDecision().show) return;
    inviteSlot.append(inviteCard(app));
  }

  const copyButton = h(
    'button',
    {
      class: 'btn btn-primary',
      type: 'button',
      onClick: async () => {
        const ok = await app.copy(currentText());
        if (!ok) return toast(t('toast.copyFailed'), { tone: 'error' });
        app.track('copy', engine.id);
        toast(t('toast.copied'), { tone: 'success' });
        replace(copyButton, icon('check', { size: 16 }), t('gen.copied'));
        setTimeout(() => replace(copyButton, icon('copy', { size: 16 }), t('gen.copy')), 1800);
        maybeInvite();
      },
    },
    icon('copy', { size: 16 }),
    t('gen.copy'),
  );

  const saveButton = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      onClick: () => {
        if (!generated) return;
        app.saveToVault({
          engineId: engine.id,
          engineTitle: engine.title,
          prompt: generated.strategic,
          inputs: { ...values },
          modifiers: [...activeModifiers],
        });
        toast(t('toast.savedToVault'), { tone: 'success' });
        replace(saveButton, icon('check', { size: 16 }), t('gen.saved'));
        setTimeout(() => replace(saveButton, icon('bookmark', { size: 16 }), t('gen.save')), 1800);
      },
    },
    icon('bookmark', { size: 16 }),
    t('gen.save'),
  );

  const shareButton = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      onClick: async () => {
        readValues();
        const hash = `#/e/${encodeURIComponent(engine.id)}?v=${encodeState({ values, mods: activeModifiers })}`;
        const url = `${window.location.origin}${window.location.pathname}${hash}`;
        const ok = await app.copy(url);
        toast(ok ? t('toast.linkCopied') : t('toast.copyFailed'), { tone: ok ? 'success' : 'error' });
      },
    },
    icon('share', { size: 16 }),
    t('gen.share'),
  );

  const targetSelect = h(
    'select',
    { class: 'select', style: { width: 'auto' }, 'aria-label': t('settings.defaultTarget') },
    ...TARGETS.map((target) => h('option', { value: target.id }, target.label)),
  );
  targetSelect.value = app.settings().defaultTarget;

  const openButton = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      onClick: async () => {
        const text = currentText();
        if (!text) return;
        const { url, prefilled } = buildTargetUrl(targetSelect.value, text);
        // Long prompts blow past every chat product's URL ceiling, so they ride
        // the clipboard instead of being silently truncated in the address bar.
        if (!prefilled) {
          const ok = await app.copy(text);
          toast(ok ? t('toast.copied') : t('toast.copyFailed'), { tone: ok ? 'success' : 'error' });
        }
        app.track('copy', engine.id);
        window.open(url, '_blank', 'noopener');
        maybeInvite();
      },
    },
    icon('external', { size: 16 }),
    t('gen.openIn'),
  );

  const actionRow = h(
    'div',
    { class: 'output-actions', hidden: true },
    copyButton,
    saveButton,
    shareButton,
    h('div', { style: { display: 'flex', gap: '4px' } }, openButton, targetSelect),
  );

  /* --- assemble ---------------------------------------------------------- */

  if (shared) generate({ track: false, validate: false });

  return h(
    'div',
    { class: 'view view-enter', dataset: { accent: engine.categoryAccent } },

    h(
      'section',
      { class: 'engine-hero' },
      h(
        'div',
        { class: 'panel', style: { position: 'relative' } },
        favoriteButton(app, engine.id),
        h(
          'div',
          { class: 'hero-main' },
          h('span', { class: 'hero-icon' }, icon(engine.symptomIcon, { size: 24 })),
          h(
            'div',
            null,
            h('h1', { style: { fontSize: '1.4rem', marginBottom: '4px' } }, engine.title),
            h('p', { class: 'page-lead' }, engine.shortDesc),
            h(
              'div',
              { class: 'chip-row', style: { marginBlockStart: '12px' } },
              levelChip(engine.level),
              h('span', { class: 'chip' }, engine.categoryTitle),
              ...(engine.tags ?? []).slice(0, 3).map((tag) => h('span', { class: 'chip' }, tag)),
            ),
          ),
        ),
        engine.symptom
          ? h('p', { class: 'engine-symptom', style: { marginBlockStart: '16px' } }, '"', engine.symptom, '"')
          : null,
      ),
      h(
        'div',
        { class: 'panel strategy-note' },
        h('h3', null, icon('chess', { size: 16 }), t('engine.strategy')),
        h('p', null, engine.strategy),
        h('h3', { style: { marginBlockStart: '8px' } }, icon('atom', { size: 16 }), t('engine.techniques')),
        techniqueChips(engine.techniques),
      ),
    ),

    h(
      'section',
      { class: 'generator' },

      h(
        'div',
        { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
        h(
          'div',
          { class: 'section-head' },
          h('h2', { class: 'section-title' }, icon('settings', { size: 15 }), ' ', t('gen.inputs')),
          engine.example
            ? h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onClick: fillExample }, icon('wand', { size: 14 }), t('gen.fillExample'))
            : null,
        ),
        formFields,
        h('hr', { class: 'divider' }),
        h(
          'div',
          null,
          h('div', { class: 'section-head' }, h('h2', { class: 'section-title' }, icon('layers', { size: 15 }), ' ', t('gen.modifiers'))),
          h('p', { class: 'field-hint', style: { marginBlockEnd: '10px' } }, t('gen.modifiersHint')),
          modifierBox,
        ),
        h(
          'button',
          { class: 'btn btn-primary btn-lg btn-block', type: 'button', onClick: () => generate() },
          icon('sparkles', { size: 18 }),
          t('gen.generate'),
        ),
      ),

      h(
        'div',
        { class: 'panel output-panel' },
        h(
          'div',
          { class: 'output-head' },
          h('h2', { class: 'section-title' }, icon('code', { size: 15 }), ' ', t('gen.result')),
          tabRow,
        ),
        h('div', { class: 'output-body' }, outputText, diffBox, placeholder),
        announcer,
        diffLegend,
        metaBar,
        techniqueBar,
        actionRow,
        inviteSlot,
      ),
    ),
  );
}
