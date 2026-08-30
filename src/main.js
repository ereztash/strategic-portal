/**
 * Boot and shell.
 *
 * Wires the store, registry, router and views together, renders the persistent
 * chrome (header, search, breadcrumbs), and installs global shortcuts. Views
 * are pure functions of app state: the router hands them params and they return
 * a detached element, which this module swaps into the main region.
 */

import { createApp } from './ui/app.js';
import { createRouter } from './ui/router.js';
import { installIconSprite, icon } from './ui/icons.js';
import { h, replace } from './ui/dom.js';
import { t } from './core/i18n.js';
import { debounce } from './core/utils.js';
import { getCategory } from './data/categories.js';
import { toast } from './ui/toast.js';
import { openPalette } from './ui/palette.js';
import { installShortcuts } from './ui/shortcuts.js';
import { renderFooter } from './ui/footer.js';

import { renderHome } from './ui/views/home.js';
import { renderCategory } from './ui/views/category.js';
import { renderGenerator } from './ui/views/generator.js';
import { renderSearch } from './ui/views/search.js';
import { renderVault, renderTrash } from './ui/views/vault.js';
import { renderBuilder } from './ui/views/builder.js';
import { renderStats } from './ui/views/stats.js';
import { renderSettings } from './ui/views/settings.js';

const VIEWS = {
  home: renderHome,
  category: renderCategory,
  engine: renderGenerator,
  search: renderSearch,
  vault: renderVault,
  trash: renderTrash,
  builder: renderBuilder,
  builderEdit: renderBuilder,
  stats: renderStats,
  settings: renderSettings,
};

function boot() {
  installIconSprite();

  const router = createRouter(handleRoute);
  const app = createApp({ router });
  app.applyTheme();
  app.applyMotion();
  app.applyLocale();

  /* --- chrome ----------------------------------------------------------- */

  const searchInput = h('input', {
    id: 'global-search',
    class: 'input',
    type: 'search',
    placeholder: t('home.searchPlaceholder'),
    'aria-label': t('nav.search'),
    autocomplete: 'off',
    onInput: debounce((event) => {
      const value = event.target.value.trim();
      if (value.length < 2) return;
      router.silent('search', {}, { q: value });
      renderView({ name: 'search', params: {}, query: { q: value } });
    }, 260),
    onKeyDown: (event) => {
      if (event.key === 'Enter') router.go('search', {}, { q: event.target.value.trim() });
      if (event.key === 'Escape') event.target.blur();
    },
  });

  const navButtons = [
    { route: 'vault', iconName: 'bookmark', label: t('nav.vault') },
    { route: 'builder', iconName: 'hammer', label: t('builder.title') },
    { route: 'stats', iconName: 'barChart', label: t('nav.stats') },
    { route: 'settings', iconName: 'settings', label: t('nav.settings') },
  ].map((item) =>
    h(
      'button',
      {
        class: 'icon-btn',
        type: 'button',
        title: item.label,
        'aria-label': item.label,
        dataset: { route: item.route },
        onClick: () => router.go(item.route),
      },
      icon(item.iconName, { size: 19 }),
    ),
  );

  const breadcrumbs = h('nav', { class: 'breadcrumbs', 'aria-label': t('nav.menu') });

  const header = h(
    'header',
    { class: 'app-header' },
    h(
      'div',
      { class: 'shell header-bar' },
      h(
        'button',
        { class: 'brand', type: 'button', onClick: () => router.go('home'), 'aria-label': t('nav.home') },
        h('span', { class: 'brand-mark' }, icon('spark', { size: 21, filled: true })),
        h(
          'span',
          null,
          h('span', { class: 'brand-name' }, t('app.title')),
          h('span', { class: 'brand-sub' }, t('app.tagline')),
        ),
      ),
      h(
        'div',
        { class: 'header-search search-field' },
        icon('search', { size: 16 }),
        searchInput,
        h('kbd', null, '/'),
      ),
      h(
        'div',
        { class: 'header-actions' },
        h(
          'button',
          {
            class: 'icon-btn',
            type: 'button',
            title: t('nav.palette'),
            'aria-label': t('nav.palette'),
            onClick: () => openPalette({ app, router }),
          },
          icon('command', { size: 19 }),
        ),
        ...navButtons,
      ),
    ),
    h('div', { class: 'shell' }, breadcrumbs),
  );

  const main = h('main', { class: 'app-main shell', id: 'main', tabindex: '-1' });

  document.body.append(
    h('a', { class: 'skip-link', href: '#main' }, t('app.skipToContent')),
    header,
    main,
    renderFooter(),
  );

  /* --- rendering -------------------------------------------------------- */

  function crumb(label, onClick) {
    return onClick
      ? h('button', { type: 'button', onClick }, label)
      : h('span', { class: 'crumb-current' }, label);
  }

  function paintBreadcrumbs(route) {
    const trail = [crumb(t('nav.home'), route.name === 'home' ? null : () => router.go('home'))];

    if (route.name === 'category') {
      const category = getCategory(route.params.categoryId);
      if (category) trail.push(crumb(category.title));
    } else if (route.name === 'engine') {
      const engine = app.registry.get(route.params.engineId);
      if (engine) {
        const category = getCategory(engine.categoryId);
        if (category) trail.push(crumb(category.title, () => router.go('category', { categoryId: category.id })));
        trail.push(crumb(engine.title));
      }
    } else if (route.name === 'trash') {
      trail.push(crumb(t('vault.title'), () => router.go('vault')));
      trail.push(crumb(t('vault.trash')));
    } else if (route.name !== 'home') {
      const labels = {
        vault: t('vault.title'),
        builder: t('builder.title'),
        builderEdit: t('builder.edit'),
        stats: t('stats.title'),
        settings: t('settings.title'),
        search: t('search.title'),
        notFound: t('search.none'),
      };
      trail.push(crumb(labels[route.name] ?? route.name));
    }

    const nodes = [];
    trail.forEach((node, index) => {
      if (index > 0) nodes.push(h('span', { class: 'crumb-sep' }, '/'));
      nodes.push(node);
    });
    replace(breadcrumbs, ...nodes);
  }

  function paintNavState(route) {
    for (const button of navButtons) {
      const active = button.dataset.route === route.name || (button.dataset.route === 'vault' && route.name === 'trash');
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }

  function renderView(route) {
    const render = VIEWS[route.name] ?? VIEWS.home;
    let view;
    try {
      view = render({ app, router, params: route.params ?? {}, query: route.query ?? {} });
    } catch (error) {
      // Without this the throw escapes before `replace` runs, so the previous
      // view stays on screen while the address bar and the nav both move on.
      // The app then quietly claims to be somewhere it never rendered, which
      // reads as a click that did nothing rather than as a fault.
      view = recoveryView(error);
    }
    replace(main, view);
    paintBreadcrumbs(route);
    paintNavState(route);
  }

  /**
   * What a visitor gets when a view cannot render.
   *
   * Everything is local, so the data behind the failure is theirs and still on
   * the device: the way out is a route that does not depend on it, not a
   * reload that would land right back here. The message stays plain, and the
   * detail goes to the console for whoever is actually debugging.
   */
  function recoveryView(error) {
    console.error('view failed to render', error);
    return h(
      'div',
      { class: 'panel view-error', role: 'alert' },
      h('h2', { class: 'section-title' }, t('error.title')),
      h('p', { class: 'field-hint' }, t('error.body')),
      h(
        'div',
        { class: 'output-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => router.go('home') }, t('error.home')),
        h('button', { class: 'btn', type: 'button', onClick: () => router.go('settings') }, t('error.settings')),
      ),
    );
  }

  function handleRoute(route) {
    renderView(route);
    if (route.name === 'search') searchInput.value = route.query.q ?? '';
    window.scrollTo({ top: 0, behavior: app.settings().reducedMotion ? 'auto' : 'smooth' });
    document.title = `${t('app.title')} · ${t('app.subtitle')}`;
  }

  /* --- shortcuts -------------------------------------------------------- */

  installShortcuts({
    onPalette: () => openPalette({ app, router }),
    onSearch: () => searchInput.focus(),
    onHome: () => router.go('home'),
    onGenerate: () => main.querySelector('.btn-primary.btn-lg')?.click(),
    onCopy: () => main.querySelector('.output-actions .btn-primary')?.click(),
    onSave: () => main.querySelector('.output-actions .btn:nth-child(2)')?.click(),
  });

  /* --- start ------------------------------------------------------------ */

  router.start();

  const migration = app.store.migrationReport;
  if (migration?.migrated) {
    const count = Object.values(migration.imported ?? {}).reduce((sum, value) => sum + value, 0);
    if (count > 0) toast(t('toast.migrated', { count }), { tone: 'success', duration: 4200 });
  }
  if (!app.store.persistent) toast(t('settings.storageWarning'), { tone: 'error', duration: 5200 });

  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.dataset.done = 'true';
    setTimeout(() => loader.remove(), 450);
  }

  installServiceWorker();
}

/**
 * Register the service worker, and - just as importantly - handle its updates.
 *
 * The worker caches the shell so the portal opens offline, which means a
 * returning visitor is served the build they cached last. Without the handler
 * below, a deploy is invisible to them: the first reload still renders the old
 * version, because the new worker only takes over once the page it was meant to
 * update has already been drawn. They would have to reload twice, with nothing
 * telling them to.
 *
 * `controllerchange` fires the moment the new worker claims this page, so that
 * is where the update is picked up. Reloading is silent when nothing would be
 * lost; if the visitor has typed anything, they get a toast instead and decide
 * for themselves, because throwing away a half-written prompt to apply an
 * update is a bad trade.
 */
function installServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.location.protocol.startsWith('http')) return;

  let typed = false;
  document.addEventListener('input', () => { typed = true; }, { capture: true, once: true });

  // `clients.claim()` also fires controllerchange on a page that had no
  // controller - a first visit, where the worker is not replacing an older
  // build and there is nothing to pick up. Reloading there costs a round trip
  // and a flash of the page redrawing, which on a phone is the worst place to
  // spend both. Only a controller that *replaces* one means a new build.
  const hadController = Boolean(navigator.serviceWorker.controller);

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    // Guards a reload loop: controllerchange fires again on the fresh page.
    if (reloading) return;
    reloading = true;

    if (!typed) {
      window.location.reload();
      return;
    }
    toast(t('toast.updateReady'), {
      tone: 'info',
      action: () => window.location.reload(),
      actionLabel: t('toast.updateAction'),
    });
  });

  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* offline support is a bonus, never a hard requirement */
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
