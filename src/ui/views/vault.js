/**
 * The vault and its trash.
 *
 * Deletion is soft: an item moves to the trash and stays recoverable for 30
 * days. Losing a prompt you spent twenty minutes shaping to a mis-click is the
 * kind of thing that stops people trusting a local-first tool.
 */

import { h, replace } from '../dom.js';
import { icon } from '../icons.js';
import { t } from '../../core/i18n.js';
import { tokenize } from '../../core/utils.js';
import { confirmDialog, openModal } from '../modal.js';
import { emptyState, sectionHead } from '../components.js';
import { toast } from '../toast.js';

function matches(item, term) {
  if (!term) return true;
  const haystack = `${item.engineTitle} ${item.prompt} ${item.note ?? ''}`.toLowerCase();
  return tokenize(term).every((token) => haystack.includes(token));
}

export function renderVault({ app, router }) {
  let term = '';
  const list = h('div', { class: 'grid grid-wide' });

  function noteDialog(item) {
    const input = h('textarea', { class: 'textarea', rows: '3', placeholder: t('vault.notePlaceholder') });
    input.value = item.note ?? '';
    const modal = openModal({
      title: t('vault.addNote'),
      body: input,
      actions: [
        h('button', { class: 'btn', type: 'button', onClick: () => modal.close() }, t('common.cancel')),
        h(
          'button',
          {
            class: 'btn btn-primary',
            type: 'button',
            onClick: () => {
              app.updateVaultItem(item.id, { note: input.value.trim() });
              modal.close();
              paint();
            },
          },
          t('common.confirm'),
        ),
      ],
    });
  }

  function card(item) {
    return h(
      'article',
      { class: 'card vault-card' },
      h(
        'div',
        { class: 'vault-card-head' },
        h(
          'div',
          null,
          h('h3', { class: 'card-title' }, item.engineTitle),
          h('p', { class: 'field-hint' }, app.relativeTime(item.createdAt)),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: '2px' } },
          h(
            'button',
            {
              class: 'icon-btn',
              type: 'button',
              'aria-pressed': String(Boolean(item.pinned)),
              'aria-label': item.pinned ? t('vault.unpin') : t('vault.pin'),
              title: item.pinned ? t('vault.unpin') : t('vault.pin'),
              onClick: () => {
                app.updateVaultItem(item.id, { pinned: !item.pinned });
                paint();
              },
            },
            icon('pin', { size: 16, filled: Boolean(item.pinned) }),
          ),
          h(
            'button',
            {
              class: 'icon-btn',
              type: 'button',
              'aria-label': t('vault.addNote'),
              title: t('vault.addNote'),
              onClick: () => noteDialog(item),
            },
            icon('edit', { size: 16 }),
          ),
        ),
      ),
      item.note ? h('p', { class: 'vault-note' }, item.note) : null,
      h('pre', { class: 'vault-preview', dir: 'auto' }, item.prompt),
      h(
        'div',
        { class: 'btn-row' },
        h(
          'button',
          {
            class: 'btn btn-sm',
            type: 'button',
            onClick: async () => {
              const ok = await app.copy(item.prompt);
              toast(ok ? t('toast.copied') : t('toast.copyFailed'), { tone: ok ? 'success' : 'error' });
            },
          },
          icon('copy', { size: 14 }),
          t('common.copy'),
        ),
        item.engineId && app.registry.has(item.engineId)
          ? h(
              'button',
              {
                class: 'btn btn-sm',
                type: 'button',
                // Reopening restores the original inputs, so a saved prompt is a
                // starting point to adjust rather than a frozen block of text.
                onClick: () => router.go('engine', { engineId: item.engineId }, { v: encodeInputs(item) }),
              },
              icon('refresh', { size: 14 }),
              t('vault.reopen'),
            )
          : null,
        h(
          'button',
          {
            class: 'btn btn-sm btn-danger',
            type: 'button',
            style: { marginInlineStart: 'auto' },
            'aria-label': t('vault.delete'),
            onClick: () => {
              app.deleteVaultItem(item.id);
              toast(t('vault.deleted'));
              paint();
            },
          },
          icon('trash', { size: 14 }),
        ),
      ),
    );
  }

  function paint() {
    const items = app.vault().filter((item) => matches(item, term));
    const sorted = [...items].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.createdAt - a.createdAt);
    countLabel.textContent = t('vault.count', { count: sorted.length });

    if (sorted.length === 0) {
      replace(
        list,
        emptyState({
          iconName: 'bookmark',
          title: t('vault.empty'),
          action: h('button', { class: 'btn btn-primary', type: 'button', onClick: () => router.go('home') }, t('home.startHere')),
        }),
      );
      list.style.display = 'block';
      return;
    }
    list.style.removeProperty('display');
    replace(list, ...sorted.map(card));
  }

  const countLabel = h('p', { class: 'page-lead' });
  const search = h('input', {
    class: 'input',
    type: 'search',
    placeholder: t('vault.searchPlaceholder'),
    onInput: (event) => {
      term = event.target.value;
      paint();
    },
  });

  paint();

  return h(
    'div',
    { class: 'view view-enter' },
    h(
      'div',
      { class: 'page-head' },
      h('div', null, h('h1', { class: 'page-title' }, icon('bookmark', { size: 22 }), t('vault.title')), countLabel),
      h(
        'div',
        { class: 'btn-row' },
        h(
          'button',
          { class: 'btn btn-sm', type: 'button', onClick: () => router.go('trash') },
          icon('trash', { size: 14 }),
          t('vault.trash'),
          app.trash().length ? h('span', { class: 'chip chip-danger' }, app.trash().length) : null,
        ),
      ),
    ),
    h('div', { class: 'search-field' }, icon('search', { size: 16 }), search),
    list,
  );
}

/** Share-style encoding of a saved item's inputs, for "reopen". */
function encodeInputs(item) {
  const payload = { values: item.inputs ?? {}, mods: item.modifiers ?? [] };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function renderTrash({ app, router }) {
  const list = h('div', { class: 'grid grid-wide' });

  function paint() {
    const items = app.trash();
    if (items.length === 0) {
      replace(
        list,
        emptyState({
          iconName: 'trash',
          title: t('vault.trashEmpty'),
          action: h('button', { class: 'btn', type: 'button', onClick: () => router.go('vault') }, t('vault.title')),
        }),
      );
      list.style.display = 'block';
      return;
    }
    list.style.removeProperty('display');
    replace(
      list,
      ...items.map((item) =>
        h(
          'article',
          { class: 'card vault-card' },
          h(
            'div',
            { class: 'vault-card-head' },
            h(
              'div',
              null,
              h('h3', { class: 'card-title' }, item.engineTitle),
              h('p', { class: 'field-hint' }, app.relativeTime(item.deletedAt)),
            ),
          ),
          h('pre', { class: 'vault-preview', dir: 'auto' }, item.prompt),
          h(
            'div',
            { class: 'btn-row' },
            h(
              'button',
              {
                class: 'btn btn-sm',
                type: 'button',
                onClick: () => {
                  app.restoreFromTrash(item.id);
                  toast(t('toast.restored'), { tone: 'success' });
                  paint();
                },
              },
              icon('restore', { size: 14 }),
              t('vault.restore'),
            ),
            h(
              'button',
              {
                class: 'btn btn-sm btn-danger',
                type: 'button',
                style: { marginInlineStart: 'auto' },
                onClick: async () => {
                  const ok = await confirmDialog({
                    title: t('vault.deleteForever'),
                    message: item.engineTitle,
                    confirmLabel: t('common.delete'),
                    danger: true,
                  });
                  if (!ok) return;
                  app.purgeFromTrash(item.id);
                  paint();
                },
              },
              icon('trash', { size: 14 }),
              t('vault.deleteForever'),
            ),
          ),
        ),
      ),
    );
  }

  paint();

  return h(
    'div',
    { class: 'view view-enter' },
    h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        null,
        h('h1', { class: 'page-title' }, icon('trash', { size: 22 }), t('vault.trash')),
        h('p', { class: 'page-lead' }, t('vault.trashLead', { days: app.trashRetentionDays })),
      ),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn btn-sm', type: 'button', onClick: () => router.go('vault') }, icon('arrowRight', { size: 14 }), t('vault.title')),
        app.trash().length
          ? h(
              'button',
              {
                class: 'btn btn-sm btn-danger',
                type: 'button',
                onClick: async () => {
                  const ok = await confirmDialog({
                    title: t('vault.emptyTrash'),
                    message: t('vault.confirmEmptyTrash'),
                    confirmLabel: t('common.delete'),
                    danger: true,
                  });
                  if (!ok) return;
                  app.emptyTrash();
                  paint();
                },
              },
              t('vault.emptyTrash'),
            )
          : null,
      ),
    ),
    list,
  );
}
