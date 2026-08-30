/**
 * The no-code engine builder.
 *
 * v1 could only append an engine and reload the page; there was no editing, no
 * deleting, and field ids were opaque (`field_1`), which made templates hard to
 * write. Here fields carry readable ids, the template is analysed live for
 * mismatched variables, and a preview renders with the example values as you
 * type.
 */

import { h, replace } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../core/i18n.js';
import { analyzeTemplate, render } from '../../core/template.js';
import { validateCustomEngine } from '../../core/registry.js';
import { slugify, uid } from '../../core/utils.js';
import { confirmDialog } from '../modal.js';
import { emptyState, sectionHead } from '../components.js';
import { toast } from '../toast.js';

const FIELD_TYPES = ['text', 'textarea', 'select', 'multiselect', 'number', 'toggle'];

/** Field ids must be valid template variables: no spaces, no punctuation. */
function toVariableName(label, fallbackIndex) {
  const slug = slugify(label).replace(/-/g, '_');
  return slug || `field_${fallbackIndex}`;
}

export function renderBuilder({ app, router, params }) {
  const editingId = params?.engineId ?? null;
  const existing = editingId ? app.customEngines().find((engine) => engine.id === editingId) : null;

  const draft = existing
    ? { ...existing, fields: existing.fields.map((field) => ({ ...field })) }
    : { id: uid('custom'), title: '', shortDesc: '', symptom: '', icon: 'spark', tags: [], techniques: [], fields: [], template: '' };

  /* --- detail inputs ----------------------------------------------------- */

  const titleInput = h('input', { class: 'input', placeholder: t('builder.namePlaceholder'), onInput: (e) => { draft.title = e.target.value; refresh(); } });
  const descInput = h('input', { class: 'input', placeholder: t('builder.descPlaceholder'), onInput: (e) => { draft.shortDesc = e.target.value; } });
  const symptomInput = h('input', { class: 'input', placeholder: t('builder.symptomPlaceholder'), onInput: (e) => { draft.symptom = e.target.value; } });
  const templateInput = h('textarea', {
    class: 'textarea',
    rows: '12',
    style: { fontFamily: 'var(--font-mono)', fontSize: '0.84rem' },
    placeholder: t('builder.templatePlaceholder'),
    onInput: (e) => { draft.template = e.target.value; refresh(); },
  });
  titleInput.value = draft.title;
  descInput.value = draft.shortDesc;
  symptomInput.value = draft.symptom;
  templateInput.value = draft.template;

  /* --- field rows -------------------------------------------------------- */

  const fieldList = h('div', { class: 'form-stack' });

  function paintFields() {
    if (draft.fields.length === 0) {
      replace(fieldList, h('p', { class: 'field-hint' }, t('builder.noEngines')));
      return;
    }
    replace(
      fieldList,
      ...draft.fields.map((field, index) => {
        const labelInput = h('input', {
          class: 'input',
          placeholder: t('builder.fieldLabel'),
          onInput: (e) => {
            field.label = e.target.value;
            // Keep the id in step with the label until it has been used, so the
            // variable the person types in the template stays predictable.
            if (!field.idLocked) {
              field.id = toVariableName(e.target.value, index + 1);
              idInput.value = field.id;
              refresh();
            }
          },
        });
        const idInput = h('input', {
          class: 'input',
          style: { fontFamily: 'var(--font-mono)' },
          onInput: (e) => {
            field.idLocked = true;
            field.id = toVariableName(e.target.value, index + 1);
            refresh();
          },
        });
        const typeSelect = h(
          'select',
          { class: 'select', onChange: (e) => { field.type = e.target.value; paintFields(); } },
          ...FIELD_TYPES.map((type) => h('option', { value: type }, type)),
        );
        const requiredToggle = h('input', { type: 'checkbox', onChange: (e) => { field.required = e.target.checked; } });

        labelInput.value = field.label ?? '';
        idInput.value = field.id ?? '';
        typeSelect.value = field.type ?? 'text';
        requiredToggle.checked = Boolean(field.required);

        const optionsInput = h('input', {
          class: 'input full',
          placeholder: t('builder.fieldOptions'),
          onInput: (e) => {
            field.options = e.target.value.split(',').map((option) => option.trim()).filter(Boolean);
          },
        });
        optionsInput.value = (field.options ?? []).join(', ');

        return h(
          'div',
          { class: 'builder-field-row' },
          labelInput,
          idInput,
          typeSelect,
          h(
            'div',
            { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
            h('label', { class: 'switch', title: t('builder.fieldRequired') }, requiredToggle, h('span', { class: 'switch-track' })),
            h(
              'button',
              {
                class: 'icon-btn',
                type: 'button',
                'aria-label': t('builder.removeField'),
                onClick: () => {
                  draft.fields.splice(index, 1);
                  paintFields();
                  refresh();
                },
              },
              icon('close', { size: 16 }),
            ),
          ),
          field.type === 'select' || field.type === 'multiselect' ? optionsInput : null,
        );
      }),
    );
  }

  function addField(preset = {}) {
    const index = draft.fields.length + 1;
    draft.fields.push({
      id: preset.id ?? `field_${index}`,
      label: preset.label ?? '',
      type: preset.type ?? 'text',
      placeholder: '',
      required: false,
      idLocked: Boolean(preset.id),
    });
    paintFields();
    refresh();
  }

  /** Pull every {{variable}} out of the template and create the missing fields. */
  function detectVariables() {
    const known = new Set(draft.fields.map((field) => field.id));
    const found = analyzeTemplate(draft.template, [...known]).unknownVariables;
    if (found.length === 0) return toast(t('builder.noNewVars'));
    for (const name of found) addField({ id: name, label: name, type: name.length > 12 ? 'textarea' : 'text' });
    toast(t('builder.detected', { count: found.length }), { tone: 'success' });
  }

  /* --- live analysis and preview ----------------------------------------- */

  const warnings = h('div', { class: 'form-stack' });
  const preview = h('pre', { class: 'output-text', dir: 'auto', style: { minHeight: '160px' } });

  function refresh() {
    const result = validateCustomEngine(draft);
    replace(
      warnings,
      ...result.warnings.map((warning) =>
        h(
          'div',
          { class: 'notice' },
          icon('alert', { size: 16 }),
          h(
            'span',
            null,
            warning.type === 'unknownVariables'
              ? t('builder.warnUnknownVars', { vars: warning.items.join(', ') })
              : t('builder.warnUnusedFields', { fields: warning.items.join(', ') }),
          ),
        ),
      ),
    );

    // Preview with each field's label standing in for a real value, so the
    // shape of the finished prompt is visible before any engine is saved.
    const sample = Object.fromEntries(draft.fields.map((field) => [field.id, `[${field.label || field.id}]`]));
    preview.textContent = render(draft.template, sample).text || t('gen.placeholder');
  }

  function save() {
    const result = validateCustomEngine(draft);
    if (!result.valid) {
      if (result.errors.includes('title')) toast(t('builder.errNoTitle'), { tone: 'error' });
      else if (result.errors.includes('template')) toast(t('builder.errNoTemplate'), { tone: 'error' });
      else toast(t('builder.errNoTitle'), { tone: 'error' });
      return;
    }
    const clean = {
      ...draft,
      fields: draft.fields.map(({ idLocked, ...field }) => field),
    };
    app.saveCustomEngine(clean);
    toast(t('builder.saved'), { tone: 'success' });
    router.go('engine', { engineId: clean.id });
  }

  paintFields();
  refresh();

  /* --- existing engines list --------------------------------------------- */

  const myEngines = app.customEngines();
  const enginesList = myEngines.length
    ? h(
        'div',
        { class: 'grid grid-cards' },
        ...myEngines.map((engine) =>
          h(
            'article',
            { class: 'card', dataset: { accent: 'lime' } },
            h('h3', { class: 'card-title' }, engine.title || t('engine.custom')),
            h('p', { class: 'card-desc' }, engine.shortDesc || engine.symptom || ''),
            h(
              'div',
              { class: 'btn-row' },
              h('button', { class: 'btn btn-sm', type: 'button', onClick: () => router.go('engine', { engineId: engine.id }) }, icon('play', { size: 13 }), t('vault.reopen')),
              h('button', { class: 'btn btn-sm', type: 'button', onClick: () => router.go('builderEdit', { engineId: engine.id }) }, icon('edit', { size: 13 }), t('common.edit')),
              h(
                'button',
                {
                  class: 'btn btn-sm',
                  type: 'button',
                  onClick: () => {
                    const copy = { ...engine, id: uid('custom'), title: `${engine.title} (${t('common.copy')})` };
                    app.saveCustomEngine(copy);
                    router.go('builderEdit', { engineId: copy.id });
                  },
                },
                icon('duplicate', { size: 13 }),
                t('builder.duplicate'),
              ),
              h(
                'button',
                {
                  class: 'btn btn-sm',
                  type: 'button',
                  onClick: () => app.download(`${slugify(engine.title) || 'engine'}.json`, JSON.stringify(engine, null, 2)),
                },
                icon('download', { size: 13 }),
                t('builder.exportEngine'),
              ),
              h(
                'button',
                {
                  class: 'btn btn-sm btn-danger',
                  type: 'button',
                  style: { marginInlineStart: 'auto' },
                  'aria-label': t('builder.deleteEngine'),
                  onClick: async () => {
                    const ok = await confirmDialog({
                      title: t('builder.deleteEngine'),
                      message: t('builder.confirmDelete', { title: engine.title }),
                      confirmLabel: t('common.delete'),
                      danger: true,
                    });
                    if (!ok) return;
                    app.deleteCustomEngine(engine.id);
                    toast(t('toast.engineDeleted'));
                    router.go('builder');
                  },
                },
                icon('trash', { size: 13 }),
              ),
            ),
          ),
        ),
      )
    : emptyState({ iconName: 'hammer', message: t('builder.noEngines') });

  const importInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onChange: async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        app.saveCustomEngine({ ...parsed, id: uid('custom') });
        toast(t('builder.saved'), { tone: 'success' });
        router.go('builder');
      } catch {
        toast(t('toast.importFailed'), { tone: 'error' });
      }
      event.target.value = '';
    },
  });

  return h(
    'div',
    { class: 'view view-enter', dataset: { accent: 'lime' } },
    h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        null,
        h('h1', { class: 'page-title' }, icon('hammer', { size: 22 }), existing ? t('builder.edit') : t('builder.title')),
        h('p', { class: 'page-lead' }, t('builder.lead')),
      ),
      h(
        'div',
        { class: 'btn-row' },
        existing ? h('button', { class: 'btn btn-sm', type: 'button', onClick: () => router.go('builder') }, t('builder.new')) : null,
        h('button', { class: 'btn btn-sm', type: 'button', onClick: () => importInput.click() }, icon('upload', { size: 14 }), t('builder.importEngine')),
        importInput,
      ),
    ),

    h(
      'div',
      { class: 'builder-grid' },
      h(
        'section',
        { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        sectionHead(t('builder.details')),
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, t('builder.name'), h('span', { class: 'field-req' }, '*')), titleInput),
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, t('builder.desc')), descInput),
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, t('builder.symptom')), symptomInput),
        h('hr', { class: 'divider' }),
        sectionHead(t('builder.fields'), {
          actions: [
            h('button', { class: 'btn btn-sm', type: 'button', onClick: () => addField() }, icon('plus', { size: 13 }), t('builder.addField')),
            h('button', { class: 'btn btn-sm', type: 'button', onClick: detectVariables }, icon('wand', { size: 13 }), t('builder.detectVars')),
          ],
        }),
        fieldList,
      ),

      h(
        'section',
        { class: 'panel', style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        sectionHead(t('builder.template')),
        h('p', { class: 'field-hint' }, t('builder.templateHint')),
        templateInput,
        warnings,
        sectionHead(t('builder.preview')),
        preview,
        h('button', { class: 'btn btn-primary btn-block btn-lg', type: 'button', onClick: save }, icon('check', { size: 17 }), t('builder.save')),
      ),
    ),

    h('section', null, sectionHead(t('builder.myEngines'), { count: myEngines.length }), enginesList),
  );
}
