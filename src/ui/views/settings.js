/** Settings: appearance, behaviour, and the data escape hatch. */

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { LOCALES, t } from '../../core/i18n.js';
import { TARGETS } from '../../core/targets.js';
import { SCHEMA_VERSION } from '../../core/store.js';
import { confirmDialog } from '../modal.js';
import { sectionHead } from '../components.js';
import { toast } from '../toast.js';
import { openShortcutsDialog } from '../shortcuts.js';

const THEMES = ['dark', 'light', 'system'];
const THEME_ICON = { dark: 'moon', light: 'sun', system: 'monitor' };

function settingRow(label, control, hint) {
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' } },
    h('div', null, h('span', { style: { fontWeight: '700' } }, label), hint ? h('p', { class: 'field-hint' }, hint) : null),
    control,
  );
}

export function renderSettings({ app, router }) {
  const settings = app.settings();

  const themeChips = h(
    'div',
    { class: 'chip-row' },
    ...THEMES.map((theme) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': String(settings.theme === theme),
          onClick: (event) => {
            app.setSetting('theme', theme);
            for (const sibling of themeChips.children) sibling.setAttribute('aria-pressed', 'false');
            event.currentTarget.setAttribute('aria-pressed', 'true');
          },
        },
        icon(THEME_ICON[theme], { size: 14 }),
        t(`settings.theme.${theme}`),
      ),
    ),
  );

  const localeSelect = h(
    'select',
    {
      class: 'select',
      style: { width: 'auto' },
      onChange: (event) => {
        app.setSetting('locale', event.target.value);
        router.go('settings');
        window.location.reload();
      },
    },
    ...Object.values(LOCALES).map((locale) => h('option', { value: locale.id }, locale.label)),
  );
  localeSelect.value = settings.locale;

  const targetSelect = h(
    'select',
    { class: 'select', style: { width: 'auto' }, onChange: (event) => app.setSetting('defaultTarget', event.target.value) },
    ...TARGETS.map((target) => h('option', { value: target.id }, target.label)),
  );
  targetSelect.value = settings.defaultTarget;

  function toggle(key) {
    const input = h('input', { type: 'checkbox', onChange: (event) => app.setSetting(key, event.target.checked) });
    input.checked = Boolean(settings[key]);
    return h('label', { class: 'switch' }, input, h('span', { class: 'switch-track' }));
  }

  const importInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onChange: async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const merge = importInput.dataset.mode === 'merge';
      try {
        const applied = await app.importBackup(file, { merge });
        toast(t('toast.imported', { count: applied.length }), { tone: 'success' });
        setTimeout(() => window.location.reload(), 700);
      } catch {
        toast(t('toast.importFailed'), { tone: 'error' });
      }
      event.target.value = '';
    },
  });

  function pickFile(mode) {
    importInput.dataset.mode = mode;
    importInput.click();
  }

  return h(
    'div',
    { class: 'view view-enter' },
    h(
      'div',
      { class: 'page-head' },
      h('div', null, h('h1', { class: 'page-title' }, icon('settings', { size: 22 }), t('settings.title'))),
    ),

    h(
      'section',
      { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      sectionHead(t('settings.appearance')),
      settingRow(t('settings.theme'), themeChips),
      h('hr', { class: 'divider' }),
      settingRow(t('settings.language'), localeSelect),
    ),

    h(
      'section',
      { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      sectionHead(t('settings.behavior')),
      settingRow(t('settings.livePreview'), toggle('livePreview')),
      h('hr', { class: 'divider' }),
      settingRow(t('settings.reducedMotion'), toggle('reducedMotion')),
      h('hr', { class: 'divider' }),
      settingRow(t('settings.defaultTarget'), targetSelect),
    ),

    h(
      'section',
      { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      sectionHead(t('settings.data')),
      h('p', { class: 'field-hint' }, t('settings.dataLead')),
      !app.store.persistent ? h('div', { class: 'notice' }, icon('alert', { size: 16 }), h('span', null, t('settings.storageWarning'))) : null,
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onClick: () => app.exportBackup() }, icon('download', { size: 15 }), t('settings.export')),
        h('button', { class: 'btn', type: 'button', onClick: () => pickFile('merge') }, icon('upload', { size: 15 }), t('settings.importMerge')),
        h('button', { class: 'btn', type: 'button', onClick: () => pickFile('replace') }, icon('upload', { size: 15 }), t('settings.importReplace')),
        importInput,
      ),
      h(
        'div',
        { class: 'kv' },
        h('dt', null, t('stats.saved')),
        h('dd', null, String(app.vault().length)),
        h('dt', null, t('builder.myEngines')),
        h('dd', null, String(app.customEngines().length)),
        h('dt', null, t('vault.trash')),
        h('dd', null, String(app.trash().length)),
      ),
      h('hr', { class: 'divider' }),
      h(
        'button',
        {
          class: 'btn btn-danger',
          type: 'button',
          style: { alignSelf: 'flex-start' },
          onClick: async () => {
            const ok = await confirmDialog({
              title: t('settings.wipe'),
              message: t('settings.confirmWipe'),
              confirmLabel: t('common.delete'),
              danger: true,
            });
            if (!ok) return;
            app.wipe();
            window.location.hash = '#/';
            window.location.reload();
          },
        },
        icon('trash', { size: 15 }),
        t('settings.wipe'),
      ),
    ),

    h(
      'section',
      { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      sectionHead(t('settings.about')),
      h(
        'div',
        { class: 'kv' },
        h('dt', null, t('settings.version')),
        h('dd', null, `2.0 · schema v${SCHEMA_VERSION}`),
        h('dt', null, t('home.allEngines')),
        h('dd', null, String(app.registry.all().length)),
      ),
      h(
        'button',
        { class: 'btn', type: 'button', style: { alignSelf: 'flex-start' }, onClick: () => openShortcutsDialog() },
        icon('keyboard', { size: 15 }),
        t('settings.shortcuts'),
      ),
    ),
  );
}
