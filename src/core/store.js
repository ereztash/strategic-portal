/**
 * Local-first persistence layer.
 *
 * The portal has no backend by design: everything a person creates lives in
 * their own browser and leaves only through an explicit JSON export. This
 * module owns the storage schema, migrations from the v1 layout, a small
 * pub/sub so views can react to writes, and an in-memory fallback for
 * browsers that throw on localStorage (private mode, blocked site data).
 */

export const SCHEMA_VERSION = 2;
const PREFIX = 'sp.v2.';
const LEGACY_KEYS = {
  history: 'zeroToAi_history',
  stats: 'zeroToAi_stats',
  custom: 'zeroToAi_custom',
};

/** Days a deleted vault item stays recoverable before it is purged. */
export const TRASH_RETENTION_DAYS = 30;

export const DEFAULTS = {
  settings: {
    theme: 'dark', // 'dark' | 'light' | 'system'
    locale: 'he', // 'he' | 'en'
    defaultTarget: 'chatgpt',
    livePreview: true,
    reducedMotion: false,
    onboarded: false,
  },
  vault: [],
  trash: [],
  customEngines: [],
  favorites: [],
  recents: [],
  stats: { totalGenerated: 0, totalCopied: 0, totalSaved: 0, engines: {}, daily: {} },
};

/** localStorage-compatible object that never throws. */
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

function resolveStorage(candidate) {
  const target = candidate ?? (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!target) return { storage: createMemoryStorage(), persistent: false };
  try {
    const probe = `${PREFIX}__probe__`;
    target.setItem(probe, '1');
    target.removeItem(probe);
    return { storage: target, persistent: true };
  } catch {
    return { storage: createMemoryStorage(), persistent: false };
  }
}

export function createStore(options = {}) {
  const { storage: injected, now = () => Date.now() } = options;
  const { storage, persistent } = resolveStorage(injected);
  const listeners = new Map();
  const cache = new Map();

  function readRaw(slice) {
    try {
      const raw = storage.getItem(PREFIX + slice);
      if (raw === null) return undefined;
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  function writeRaw(slice, value) {
    try {
      storage.setItem(PREFIX + slice, JSON.stringify(value));
      return true;
    } catch (error) {
      // Quota exceeded or storage disabled: keep the value in memory so the
      // session stays usable, and let the caller surface a warning.
      cache.set(slice, value);
      return false;
    }
  }

  function emit(slice, value) {
    for (const listener of listeners.get(slice) ?? []) listener(value, slice);
    for (const listener of listeners.get('*') ?? []) listener(value, slice);
  }

  function defaultFor(slice) {
    const fallback = DEFAULTS[slice];
    return Array.isArray(fallback) ? [...fallback] : { ...fallback };
  }

  const api = {
    persistent,

    /** Read a slice, falling back to defaults (objects are shallow-merged). */
    get(slice) {
      if (cache.has(slice)) return cache.get(slice);
      const stored = readRaw(slice);
      const fallback = DEFAULTS[slice];
      let value;
      if (stored === undefined) value = defaultFor(slice);
      else if (Array.isArray(fallback)) value = Array.isArray(stored) ? stored : [];
      else if (fallback && typeof fallback === 'object') value = { ...fallback, ...stored };
      else value = stored;
      cache.set(slice, value);
      return value;
    },

    /** Overwrite a slice and notify subscribers. */
    set(slice, value) {
      cache.set(slice, value);
      const ok = writeRaw(slice, value);
      emit(slice, value);
      return ok;
    },

    /** Read-modify-write helper. The updater may mutate or return a new value. */
    update(slice, updater) {
      const current = api.get(slice);
      const next = updater(current) ?? current;
      return api.set(slice, next);
    },

    /** Subscribe to writes on one slice, or `'*'` for all of them. */
    subscribe(slice, listener) {
      if (!listeners.has(slice)) listeners.set(slice, new Set());
      listeners.get(slice).add(listener);
      return () => listeners.get(slice)?.delete(listener);
    },

    /** Restore one slice, or the whole store, to defaults. */
    reset(slice) {
      const slices = slice ? [slice] : Object.keys(DEFAULTS);
      for (const name of slices) {
        cache.delete(name);
        try {
          storage.removeItem(PREFIX + name);
        } catch {
          /* memory fallback already cleared via cache.delete */
        }
        emit(name, api.get(name));
      }
    },

    /** Full snapshot suitable for writing to a JSON backup file. */
    exportAll() {
      const data = {};
      for (const slice of Object.keys(DEFAULTS)) data[slice] = api.get(slice);
      return {
        format: 'strategic-portal-backup',
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date(now()).toISOString(),
        data,
      };
    },

    /**
     * Restore a backup. `merge` keeps existing rows and appends unseen ids,
     * which is what people expect when importing a library from another device.
     */
    importAll(backup, { merge = false } = {}) {
      const payload = backup?.data ?? backup;
      if (!payload || typeof payload !== 'object') {
        throw new Error('INVALID_BACKUP');
      }
      const applied = [];
      for (const slice of Object.keys(DEFAULTS)) {
        if (!(slice in payload)) continue;
        const incoming = payload[slice];
        const fallback = DEFAULTS[slice];

        if (Array.isArray(fallback)) {
          if (!Array.isArray(incoming)) continue;
          if (!merge) {
            api.set(slice, incoming);
          } else {
            const existing = api.get(slice);
            const seen = new Set(existing.map((row) => row?.id ?? JSON.stringify(row)));
            const added = incoming.filter((row) => !seen.has(row?.id ?? JSON.stringify(row)));
            api.set(slice, [...existing, ...added]);
          }
        } else if (incoming && typeof incoming === 'object') {
          api.set(slice, merge ? { ...api.get(slice), ...incoming } : { ...fallback, ...incoming });
        }
        applied.push(slice);
      }
      return applied;
    },

    /** Drop trash entries past the retention window. Returns the purged count. */
    purgeExpiredTrash() {
      const cutoff = now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const trash = api.get('trash');
      const kept = trash.filter((item) => Number(item.deletedAt ?? 0) >= cutoff);
      if (kept.length !== trash.length) api.set('trash', kept);
      return trash.length - kept.length;
    },
  };

  /**
   * Migrate the v1 keys (`zeroToAi_*`) written by the first version of the
   * portal. Runs once; the legacy keys are left in place so an older deploy
   * served from cache does not lose the user's data.
   */
  function migrate() {
    const meta = readRaw('meta');
    if (meta?.schemaVersion === SCHEMA_VERSION) return { migrated: false };

    const report = { migrated: true, from: meta?.schemaVersion ?? 1, imported: {} };

    const readLegacy = (key) => {
      try {
        const raw = storage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
      } catch {
        return null;
      }
    };

    const legacyHistory = readLegacy(LEGACY_KEYS.history);
    if (Array.isArray(legacyHistory) && legacyHistory.length && api.get('vault').length === 0) {
      api.set(
        'vault',
        legacyHistory.map((item) => ({
          id: String(item.id ?? now()),
          engineId: item.engineId ?? null,
          engineTitle: item.toolTitle ?? item.engineTitle ?? 'מנוע לא ידוע',
          prompt: String(item.prompt ?? ''),
          inputs: item.inputs ?? {},
          note: '',
          tags: [],
          pinned: false,
          createdAt: Number(item.id) || now(),
        })),
      );
      report.imported.vault = legacyHistory.length;
    }

    const legacyStats = readLegacy(LEGACY_KEYS.stats);
    if (legacyStats && typeof legacyStats === 'object') {
      const engines = {};
      for (const [engineId, data] of Object.entries(legacyStats.tools ?? {})) {
        engines[engineId] = {
          generated: Number(data.generates ?? 0),
          copied: Number(data.copies ?? 0),
          saved: 0,
        };
      }
      api.set('stats', {
        ...DEFAULTS.stats,
        totalGenerated: Number(legacyStats.totalGen ?? 0),
        totalCopied: Number(legacyStats.totalCopied ?? 0),
        totalSaved: 0,
        engines,
        daily: {},
      });
      report.imported.stats = Object.keys(engines).length;
    }

    const legacyCustom = readLegacy(LEGACY_KEYS.custom);
    if (Array.isArray(legacyCustom) && legacyCustom.length && api.get('customEngines').length === 0) {
      api.set(
        'customEngines',
        legacyCustom.map((engine) => ({
          id: engine.id ?? `custom_${now()}`,
          title: engine.title ?? 'מנוע אישי',
          shortDesc: engine.shortDesc ?? '',
          symptom: engine.symptom ?? '',
          icon: 'spark',
          tags: [],
          techniques: [],
          fields: (engine.fields ?? []).map((field) => ({
            id: field.id,
            label: field.label ?? field.id,
            type: field.type === 'textarea' ? 'textarea' : 'text',
            placeholder: field.placeholder ?? '',
            required: false,
          })),
          template: engine.template ?? '',
          createdAt: now(),
          updatedAt: now(),
        })),
      );
      report.imported.customEngines = legacyCustom.length;
    }

    writeRaw('meta', { schemaVersion: SCHEMA_VERSION, migratedAt: new Date(now()).toISOString() });
    return report;
  }

  api.migrationReport = migrate();
  api.purgeExpiredTrash();
  return api;
}

/** The singleton every view imports. Tests build their own with `createStore`. */
export const store = createStore();
