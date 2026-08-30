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
function linkNode(link, { compact = false, primary = false } = {}) {
  return h(
    'a',
    {
      class: `${compact ? 'contact-row' : 'card contact-card'}${primary ? ' is-primary' : ''}`,
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

/** The one link we actually want clicked. */
export function primaryLink() {
  return CONTACT.links.find((link) => link.primary) ?? CONTACT.links[0];
}

/** Everything else, deliberately quieter so the primary action stands alone. */
function secondaryLinks() {
  return CONTACT.links.filter((link) => !link.primary);
}

/** The big button. One action, so there is nothing to choose between. */
function joinButton(app, { label } = {}) {
  const link = primaryLink();
  return h(
    'a',
    {
      class: 'btn btn-primary btn-lg join-btn',
      href: link.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      onClick: () => app?.markInviteAccepted(),
    },
    icon('whatsapp', { size: 19 }),
    label ?? t('contact.join'),
  );
}

/**
 * The invitation shown after a prompt is copied - the one moment the visitor
 * has just been given something. Dismissible, and a dismissal is remembered.
 */
export function inviteCard(app, { onClose } = {}) {
  const card = h(
    'aside',
    { class: 'panel invite', dataset: { accent: 'emerald' }, role: 'note' },
    h(
      'div',
      { class: 'invite-body' },
      h('h3', { class: 'invite-title' }, icon('whatsapp', { size: 18 }), t('invite.title')),
      h('p', { class: 'page-lead' }, t('invite.body')),
    ),
    h(
      'div',
      { class: 'invite-actions' },
      joinButton(app, { label: t('invite.cta') }),
      h(
        'button',
        {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          onClick: () => {
            app.dismissInvite();
            card.remove();
            onClose?.();
          },
        },
        t('invite.dismiss'),
      ),
    ),
  );
  app.markInviteShown();
  return card;
}

/** The invitation block at the foot of the home view: one action, then the rest. */
export function communityBlock(app) {
  return h(
    'section',
    { class: 'panel community', dataset: { accent: 'emerald' } },
    h(
      'div',
      { class: 'community-head' },
      h('span', { class: 'hero-icon' }, icon('whatsapp', { size: 24 })),
      h(
        'div',
        null,
        h('h2', { style: { fontSize: '1.25rem', marginBottom: '4px' } }, t('contact.title')),
        h('p', { class: 'page-lead' }, t('contact.lead')),
      ),
    ),
    joinButton(app),
    h(
      'details',
      { class: 'community-more' },
      h('summary', null, t('contact.more')),
      h('div', { class: 'footer-links' }, ...secondaryLinks().map((link) => linkNode(link, { compact: true }))),
    ),
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
      h(
        'div',
        { class: 'footer-links' },
        ...CONTACT.links.map((link) =>
          linkNode(link, { compact: true, primary: Boolean(link.primary) }),
        ),
      ),
    ),
  );
}
