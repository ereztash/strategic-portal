/**
 * Site footer and the community block.
 *
 * Both read from `src/data/contact.js`, so the links live in one place. Every
 * outbound link carries `rel="noopener noreferrer"` and an explicit
 * "opens in a new tab" label for screen readers.
 */

import { h } from './dom.js';
import { icon } from './icons.js';
import { CONTACT } from '../data/contact.js';
import { getLocale, t } from '../core/i18n.js';

function label(link) {
  return getLocale() === 'en' ? link.labelEn : link.label;
}

function description(link) {
  return getLocale() === 'en' ? link.descEn : link.desc;
}

/** One outbound link, rendered as a card or as a compact row. */
function linkNode(link, { compact = false } = {}) {
  return h(
    'a',
    {
      class: compact ? 'contact-row' : 'card contact-card',
      href: link.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      dataset: { accent: link.primary ? 'emerald' : 'blue' },
    },
    h('span', { class: 'card-icon' }, icon(link.icon, { size: compact ? 16 : 20 })),
    h(
      'span',
      { class: 'contact-body' },
      h('span', { class: 'contact-label' }, label(link)),
      compact ? null : h('span', { class: 'card-desc' }, description(link)),
    ),
    icon('external', { size: 14, className: 'contact-out', title: t('contact.openIn') }),
  );
}

/** The invitation block, shown at the foot of the home view. */
export function communityBlock() {
  return h(
    'section',
    { class: 'panel community' },
    h(
      'div',
      { class: 'community-head' },
      h('span', { class: 'hero-icon' }, icon('whatsapp', { size: 24 })),
      h(
        'div',
        null,
        h('h2', { style: { fontSize: '1.2rem', marginBottom: '4px' } }, t('contact.title')),
        h('p', { class: 'page-lead' }, t('contact.lead')),
      ),
    ),
    h('div', { class: 'grid grid-cards' }, ...CONTACT.links.map((link) => linkNode(link))),
  );
}

/** The persistent footer, rendered once below the main region. */
export function renderFooter() {
  return h(
    'footer',
    { class: 'app-footer' },
    h(
      'div',
      { class: 'shell footer-inner' },
      h(
        'div',
        { class: 'footer-about' },
        h(
          'span',
          { class: 'footer-brand' },
          icon('spark', { size: 15, filled: true }),
          t('app.title'),
        ),
        h('p', { class: 'footer-note' }, t('contact.footerNote')),
        h(
          'p',
          { class: 'footer-note' },
          `${t('contact.builtBy')} `,
          h(
            'a',
            { href: CONTACT.links.find((link) => link.id === 'linkedin').url, target: '_blank', rel: 'noopener noreferrer' },
            getLocale() === 'en' ? CONTACT.nameEn : CONTACT.name,
          ),
          ' · ',
          h('a', { href: `tel:${CONTACT.phone.tel}`, dir: 'ltr' }, CONTACT.phone.display),
        ),
      ),
      h('div', { class: 'footer-links' }, ...CONTACT.links.map((link) => linkNode(link, { compact: true }))),
    ),
  );
}
