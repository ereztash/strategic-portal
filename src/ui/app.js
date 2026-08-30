/**
 * Application controller.
 *
 * Owns everything that outlives a single view: settings, favourites, recents,
 * usage stats, the vault and its trash, clipboard and backup plumbing. Views
 * receive this object and never touch the store directly, so persistence rules
 * live in one place.
 */

import { createRegistry } from '../core/registry.js';
import { store as defaultStore, TRASH_RETENTION_DAYS } from '../core/store.js';
import { getLocale, localeMeta, setLocale, t, timeStrings } from '../core/i18n.js';
import { formatRelative, uid } from '../core/utils.js';
import { toast } from './toast.js';

const MAX_RECENTS = 8;
const STATS_DAYS = 60;
const VAULT_LIMIT = 500;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function createApp({ store = defaultStore, router } = {}) {
  const registry = createRegistry(store.get('customEngines'));
  let mediaQuery = null;

  const app = {
    store,
    registry,
    router,

    /* --- settings ------------------------------------------------------- */

    settings() {
      return store.get('settings');
    },

    setSetting(key, value) {
      store.update('settings', (settings) => ({ ...settings, [key]: value }));
      if (key === 'theme') app.applyTheme();
      if (key === 'reducedMotion') app.applyMotion();
      if (key === 'locale') app.applyLocale(value);
    },

    /** Resolve 'system' against the OS preference, and follow it while set. */
    applyTheme() {
      const { theme } = app.settings();
      const root = document.documentElement;
      if (theme === 'system') {
        mediaQuery ??= window.matchMedia('(prefers-color-scheme: light)');
        root.dataset.theme = mediaQuery.matches ? 'light' : 'dark';
        mediaQuery.onchange = () => {
          if (app.settings().theme === 'system') root.dataset.theme = mediaQuery.matches ? 'light' : 'dark';
        };
      } else {
        if (mediaQuery) mediaQuery.onchange = null;
        root.dataset.theme = theme;
      }
    },

    applyMotion() {
      document.documentElement.dataset.motion = app.settings().reducedMotion ? 'reduced' : 'full';
    },

    applyLocale(locale = app.settings().locale) {
      setLocale(locale);
      const meta = localeMeta(locale);
      document.documentElement.lang = meta.id;
      document.documentElement.dir = meta.dir;
    },

    /* --- favourites and recents ----------------------------------------- */

    favorites() {
      return store.get('favorites');
    },

    isFavorite(engineId) {
      return store.get('favorites').includes(engineId);
    },

    toggleFavorite(engineId) {
      let now = false;
      store.update('favorites', (favorites) => {
        const set = new Set(favorites);
        if (set.has(engineId)) set.delete(engineId);
        else {
          set.add(engineId);
          now = true;
        }
        return [...set];
      });
      return now;
    },

    recents() {
      return store
        .get('recents')
        .map((id) => registry.get(id))
        .filter(Boolean);
    },

    pushRecent(engineId) {
      store.update('recents', (recents) => [engineId, ...recents.filter((id) => id !== engineId)].slice(0, MAX_RECENTS));
    },

    /* --- usage stats ---------------------------------------------------- */

    track(action, engineId) {
      store.update('stats', (stats) => {
        const next = { ...stats, engines: { ...stats.engines }, daily: { ...stats.daily } };
        const engine = next.engines[engineId] ?? { generated: 0, copied: 0, saved: 0 };
        const day = next.daily[today()] ?? { generated: 0, copied: 0, saved: 0 };

        if (action === 'generate') {
          next.totalGenerated += 1;
          engine.generated += 1;
          day.generated += 1;
        } else if (action === 'copy') {
          next.totalCopied += 1;
          engine.copied += 1;
          day.copied += 1;
        } else if (action === 'save') {
          next.totalSaved += 1;
          engine.saved += 1;
          day.saved += 1;
        }

        next.engines[engineId] = engine;
        next.daily[today()] = day;

        // Keep the activity history bounded so the record cannot grow forever.
        const days = Object.keys(next.daily).sort();
        if (days.length > STATS_DAYS) {
          for (const stale of days.slice(0, days.length - STATS_DAYS)) delete next.daily[stale];
        }
        return next;
      });
    },

    stats() {
      return store.get('stats');
    },

    resetStats() {
      store.reset('stats');
    },

    /* --- vault ---------------------------------------------------------- */

    vault() {
      return store.get('vault');
    },

    saveToVault({ engineId, engineTitle, prompt, inputs, modifiers }) {
      const entry = {
        id: uid('v'),
        engineId,
        engineTitle,
        prompt,
        inputs: inputs ?? {},
        modifiers: modifiers ?? [],
        note: '',
        pinned: false,
        createdAt: Date.now(),
      };
      const ok = store.update('vault', (vault) => [entry, ...vault].slice(0, VAULT_LIMIT));
      if (!ok) toast(t('toast.storageFull'), { tone: 'error' });
      else app.track('save', engineId);
      return entry;
    },

    updateVaultItem(id, patch) {
      store.update('vault', (vault) => vault.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },

    /** Soft delete: the item moves to the trash and stays recoverable. */
    deleteVaultItem(id) {
      const item = store.get('vault').find((row) => row.id === id);
      if (!item) return;
      store.update('vault', (vault) => vault.filter((row) => row.id !== id));
      store.update('trash', (trash) => [{ ...item, deletedAt: Date.now() }, ...trash]);
    },

    trash() {
      return store.get('trash');
    },

    restoreFromTrash(id) {
      const item = store.get('trash').find((row) => row.id === id);
      if (!item) return;
      const { deletedAt, ...restored } = item;
      store.update('trash', (trash) => trash.filter((row) => row.id !== id));
      store.update('vault', (vault) => [restored, ...vault]);
    },

    purgeFromTrash(id) {
      store.update('trash', (trash) => trash.filter((row) => row.id !== id));
    },

    emptyTrash() {
      store.set('trash', []);
    },

    trashRetentionDays: TRASH_RETENTION_DAYS,

    /* --- custom engines ------------------------------------------------- */

    customEngines() {
      return store.get('customEngines');
    },

    saveCustomEngine(engine) {
      const now = Date.now();
      store.update('customEngines', (engines) => {
        const index = engines.findIndex((item) => item.id === engine.id);
        if (index === -1) return [...engines, { ...engine, createdAt: now, updatedAt: now }];
        const next = [...engines];
        next[index] = { ...next[index], ...engine, updatedAt: now };
        return next;
      });
      registry.refresh(store.get('customEngines'));
    },

    deleteCustomEngine(id) {
      store.update('customEngines', (engines) => engines.filter((engine) => engine.id !== id));
      store.update('favorites', (favorites) => favorites.filter((favorite) => favorite !== id));
      store.update('recents', (recents) => recents.filter((recent) => recent !== id));
      registry.refresh(store.get('customEngines'));
    },

    /* --- clipboard and files -------------------------------------------- */

    /** Async clipboard with a selection fallback for non-secure contexts. */
    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        try {
          const scratch = document.createElement('textarea');
          scratch.value = text;
          scratch.setAttribute('readonly', '');
          scratch.style.position = 'fixed';
          scratch.style.opacity = '0';
          document.body.append(scratch);
          scratch.select();
          const ok = document.execCommand('copy');
          scratch.remove();
          return ok;
        } catch {
          return false;
        }
      }
    },

    download(filename, contents, type = 'application/json') {
      const blob = new Blob([contents], { type: `${type};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    exportBackup() {
      const stamp = new Date().toISOString().slice(0, 10);
      app.download(`strategic-portal-backup-${stamp}.json`, JSON.stringify(store.exportAll(), null, 2));
    },

    async importBackup(file, { merge = false } = {}) {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const applied = store.importAll(parsed, { merge });
      registry.refresh(store.get('customEngines'));
      app.applyLocale();
      app.applyTheme();
      app.applyMotion();
      return applied;
    },

    wipe() {
      store.reset();
      registry.refresh([]);
    },

    /* --- misc ------------------------------------------------------------ */

    relativeTime(timestamp) {
      return formatRelative(timestamp, timeStrings());
    },

    locale() {
      return getLocale();
    },
  };

  return app;
}
