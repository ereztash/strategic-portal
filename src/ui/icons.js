/**
 * Inline SVG icon set.
 *
 * The v1 portal pulled Font Awesome from a CDN for a couple of dozen glyphs.
 * These are hand-drawn on a 24x24 grid in a single stroke style, injected once
 * as a `<symbol>` sprite, and referenced with `<use>` - which means no network
 * request, no flash of missing icons, and correct colour in both themes because
 * every stroke is `currentColor`.
 */

/** Path markup for each icon. Trusted constants - never user input. */
export const ICONS = {
  // Navigation and chrome
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z"/>',
  hammer: '<path d="m13 8 3-3 5 5-3 3z"/><path d="m14.5 9.5-9 9a2.1 2.1 0 0 1-3-3l9-9"/><path d="m11 6 4-4 3 3"/>',
  barChart: '<path d="M4 20h16"/><path d="M7 20v-6"/><path d="M12 20V6"/><path d="M17 20v-9"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1Z"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  close: '<path d="M6 6 18 18"/><path d="M18 6 6 18"/>',
  chevronLeft: '<path d="m14 6-6 6 6 6"/>',
  chevronRight: '<path d="m10 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 10 6 6 6-6"/>',
  arrowLeft: '<path d="M20 12H4"/><path d="m10 6-6 6 6 6"/>',
  arrowRight: '<path d="M4 12h16"/><path d="m14 6 6 6-6 6"/>',
  command: '<path d="M15 9V6a3 3 0 1 1 3 3h-3Zm0 0v6m0-6H9m6 6v3a3 3 0 1 0 3-3h-3Zm0 0H9m0 0v3a3 3 0 1 1-3-3h3Zm0 0V9m0 0V6a3 3 0 1 0-3 3h3Z"/>',
  keyboard:
    '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M17 10h.01M7 14h10"/>',

  // Actions
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/>',
  check: '<path d="m5 13 4.5 4.5L19 7"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6.5 7v12A1.5 1.5 0 0 0 8 20.5h8a1.5 1.5 0 0 0 1.5-1.5V7"/><path d="M10 11v6M14 11v6"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  download: '<path d="M12 3v12"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 16V4"/><path d="m7.5 8 4.5-4.5L16.5 8"/><path d="M4 20h16"/>',
  external: '<path d="M14 4h6v6"/><path d="m20 4-8.5 8.5"/><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h5"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4"/><path d="m8.2 13.2 7.6 4"/>',
  star: '<path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9Z"/>',
  pin: '<path d="M9 4h6l-.7 5.2 3.2 3.3H6.5l3.2-3.3Z"/><path d="M12 12.5V20"/>',
  edit: '<path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5Z"/><path d="m14 6.5 3.5 3.5"/>',
  duplicate: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  restore: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v5h5"/>',
  refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4v5h-5"/>',
  filter: '<path d="M4 5h16l-6.2 7.3V19l-3.6-2v-4.7Z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="M21 3l-6.8 18-3.7-7.5L3 9.8Z"/>',
  play: '<path d="M8 5.5 18.5 12 8 18.5Z"/>',
  sortDown: '<path d="M7 4v16"/><path d="m3.5 16.5 3.5 3.5 3.5-3.5"/><path d="M13 6h8M13 11h6M13 16h4"/>',

  // Theme and locale
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z"/>',

  // Category icons
  wrench: '<path d="M15.5 3.5a5.5 5.5 0 0 0-6.8 7L3.5 15.7a2.4 2.4 0 0 0 3.4 3.4l5.2-5.2a5.5 5.5 0 0 0 7-6.8l-3.2 3.2-3-.6-.6-3Z"/>',
  megaphone: '<path d="M4 10v4a2 2 0 0 0 2 2h2l8 4V4L8 8H6a2 2 0 0 0-2 2Z"/><path d="M19 9.5a3.5 3.5 0 0 1 0 5"/>',
  chess: '<path d="M9 4h6l-1 3h1.5l1 3H7.5l1-3H10Z"/><path d="M8 10c0 4-1 5-1 7h10c0-2-1-3-1-7"/><path d="M5.5 17h13v3h-13Z"/>',
  layers: '<path d="m12 3 8.5 4.5L12 12 3.5 7.5Z"/><path d="m4 12 8 4.3 8-4.3"/><path d="m4 16.5 8 4.3 8-4.3"/>',
  code: '<path d="m8.5 8-5 4 5 4"/><path d="m15.5 8 5 4-5 4"/><path d="m13.5 4-3 16"/>',
  microscope: '<path d="M8 18h9"/><path d="M4 21h16"/><path d="M11 18a6 6 0 0 0 6-6 5 5 0 0 0-5-5"/><path d="M9 4.5 7 6.5l3.5 3.5 2-2Z"/><path d="M8 12h3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v16H5.5A1.5 1.5 0 0 0 4 20.5Z"/><path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H19"/>',
  table: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9.5h18M3 14.5h18M9.5 9.5v10M15 9.5v10"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2"/><path d="M3 12.5h18"/>',
  spark: '<path d="M12 3 13.8 9 20 10.8 13.8 12.6 12 19 10.2 12.6 4 10.8 10.2 9Z"/>',

  // Symptom and engine icons
  shield: '<path d="M12 3.5 19.5 6v6c0 4.2-3 7.3-7.5 8.5C7.5 19.3 4.5 16.2 4.5 12V6Z"/>',
  shieldCheck: '<path d="M12 3.5 19.5 6v6c0 4.2-3 7.3-7.5 8.5C7.5 19.3 4.5 16.2 4.5 12V6Z"/><path d="m9 12 2 2 4-4.5"/>',
  braces:
    '<path d="M8.5 4c-2 0-2.5 1-2.5 2.5v2C6 10 5 10.5 4 10.5c1 0 2 .5 2 2v2C6 16 6.5 20 8.5 20"/><path d="M15.5 4c2 0 2.5 1 2.5 2.5v2c0 1.5 1 2 2 2-1 0-2 .5-2 2v2c0 1.5-.5 5.5-2.5 5.5"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 7.7-1.5"/><path d="M12 14.5v2"/>',
  robot: '<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 4v4"/><circle cx="12" cy="3" r="1.2"/><path d="M9 12.5h.01M15 12.5h.01"/><path d="M9.5 16h5"/>',
  anchor: '<circle cx="12" cy="5.5" r="2.5"/><path d="M12 8v13"/><path d="M5 12h14"/><path d="M4.5 14a7.5 7.5 0 0 0 15 0"/>',
  quote: '<path d="M9.5 6C7 7 5.5 9 5.5 11.5V18h6v-6h-3c0-2 .8-3.5 2.5-4.3Z"/><path d="M19.5 6C17 7 15.5 9 15.5 11.5V18h6v-6h-3c0-2 .8-3.5 2.5-4.3Z"/>',
  recycle: '<path d="m7 9-2.6 4.4a2 2 0 0 0 1.7 3.1H9"/><path d="m14 5.5 2.6 4.4"/><path d="M17.5 17.5H12"/><path d="m9.5 6.5 2-3.4a2 2 0 0 1 3.4 0"/><path d="m19 10 2 3.4a2 2 0 0 1-1.7 3.1"/><path d="m10.5 20 2.5-2.5-2.5-2.5"/><path d="m6.5 6.5 1 3.5 3.5-1"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  scale: '<path d="M12 4v16"/><path d="M7 20h10"/><path d="M4 8h16"/><path d="m4 8-2.5 5.5h5Z"/><path d="m20 8-2.5 5.5h5Z"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5Z"/>',
  atom: '<circle cx="12" cy="12" r="1.8"/><ellipse cx="12" cy="12" rx="9" ry="4" /><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)"/>',
  network:
    '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 7.5v4"/><path d="M12 11.5 6.3 16"/><path d="m12 11.5 5.7 4.5"/>',
  inbox: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 13.5h4l1.5 3h7l1.5-3h4"/>',
  clipboard:
    '<rect x="5" y="5" width="14" height="15" rx="2"/><path d="M9 5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1Z"/><path d="M9 11h6M9 15h4"/>',
  crosshair: '<circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>',
  repeat: '<path d="M4 9V7.5A2.5 2.5 0 0 1 6.5 5H18"/><path d="m15 2 3 3-3 3"/><path d="M20 15v1.5a2.5 2.5 0 0 1-2.5 2.5H6"/><path d="m9 22-3-3 3-3"/>',
  bug: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M8 11H4M20 11h-4M8 15H4.5M20 15h-3.5M9 7.5 7.5 5M15 7.5 16.5 5"/>',
  checkList: '<path d="M10 7h10M10 12h10M10 17h6"/><path d="m3.5 7 1.5 1.5L7.5 6"/><path d="m3.5 12 1.5 1.5L7.5 11"/><path d="m3.5 17 1.5 1.5L7.5 16"/>',
  flask: '<path d="M9.5 3v6.5L4.6 18a1.8 1.8 0 0 0 1.6 2.7h11.6a1.8 1.8 0 0 0 1.6-2.7L14.5 9.5V3"/><path d="M8.5 3h7"/><path d="M7.2 14.5h9.6"/>',
  wand: '<path d="m4 20 11-11"/><path d="m14 5 1.5 1.5"/><path d="M18 3v3M18 9v3M15 6h3M19.5 6H21"/><path d="m12.5 8.5 3 3"/>',
  fileText:
    '<path d="M6 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20Z" transform="translate(0 -1)"/><path d="M13 2.5v5h5"/><path d="M9 12h6M9 16h4"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/>',
  columns: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M9 4.5v15M15 4.5v15"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.4a2.4 2.4 0 0 1 4.6.8c0 1.6-2.3 2.1-2.3 3.6"/><path d="M12 17h.01"/>',
  merge: '<path d="M7 21V13l-3-3V3"/><path d="M17 21V13l3-3V3"/><path d="M7 13h10"/>',
  messageSquare: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4Z"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M17 14.2a5 5 0 0 1 4 4.8v1"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  presentation: '<path d="M3 4h18"/><path d="M4.5 4v10.5h15V4"/><path d="m9 20 3-5.5 3 5.5"/>',
  brain:
    '<path d="M9.5 4.5A2.5 2.5 0 0 0 7 7a2.5 2.5 0 0 0-1.5 4.5A2.8 2.8 0 0 0 6 17a2.5 2.5 0 0 0 3.5 2.3V4.5Z"/><path d="M14.5 4.5A2.5 2.5 0 0 1 17 7a2.5 2.5 0 0 1 1.5 4.5A2.8 2.8 0 0 1 18 17a2.5 2.5 0 0 1-3.5 2.3V4.5Z"/>',
  route: '<circle cx="6" cy="18.5" r="2.5"/><circle cx="18" cy="5.5" r="2.5"/><path d="M15.5 5.5H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H8.5"/>',
  sparkles: '<path d="m10 3 1.4 4.6L16 9l-4.6 1.4L10 15l-1.4-4.6L4 9l4.6-1.4Z"/><path d="m17.5 13.5.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8Z"/>',
  graduation: '<path d="M12 4 2.5 8.5 12 13l9.5-4.5Z"/><path d="M6.5 10.7V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-5.3"/><path d="M21.5 8.5V14"/>',
  calculator:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7"/><path d="M9 11.5h.01M12 11.5h.01M15 11.5h.01M9 15h.01M12 15h.01M15 15h.01M9 18h.01M12 18h.01M15 18h.01"/>',
  broom: '<path d="m14 3-8 8"/><path d="m10.5 10.5 3 3"/><path d="M9 12 4.5 16.5 7 21l10-4-3.5-3.5Z"/><path d="m9.5 17 2-2M12.5 18.5l2-2"/>',
  trending: '<path d="m3 17 5.5-5.5 3.5 3.5L21 6"/><path d="M15.5 6H21v5.5"/>',
  database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  chart: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3.5" height="6" rx="1"/><rect x="11" y="6" width="3.5" height="11" rx="1"/><rect x="16.5" y="14" width="3.5" height="3" rx="1"/>',
  fileSignature:
    '<path d="M18 10.5V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V4.5A1.5 1.5 0 0 1 7.5 3H12"/><path d="M12 3v4.5h4.5"/><path d="M9 16c1.5-3 3-3 4.5 0s3 1.5 4.5 0"/>',
  phone: '<path d="M6 3.5h3l1.5 4L8.7 9.2a11 11 0 0 0 5.6 5.6l1.7-1.8 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.7 2 2 0 0 1 6 3.5Z"/>',
  userCard:
    '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="2"/><path d="M5 16a3.5 3.5 0 0 1 7 0"/><path d="M14.5 10h4M14.5 13.5h4"/>',
  tag: '<path d="M3.5 11V4.5A1 1 0 0 1 4.5 3.5H11l9 9-7.5 7.5Z"/><circle cx="8" cy="8" r="1.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/>',

  // Social. Drawn in the same stroke style as the rest rather than lifted from
  // the brands' own marks, so they sit consistently beside the other icons.
  whatsapp:
    '<path d="M3.5 20.5 5 16.4A8.2 8.2 0 1 1 8.1 19.4Z"/><path d="M9.2 9.1c.3 1.6 1.2 3 2.5 4 .9.7 1.9 1.1 3 1.3l.9-1.6 2 .9-.4 1.4a1.4 1.4 0 0 1-1.4 1 8 8 0 0 1-7.6-7.6 1.4 1.4 0 0 1 1-1.4l1.4-.4.9 2Z"/>',
  linkedin:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16"/><path d="M8 7.6h.01"/><path d="M11.8 16v-3.2a2.2 2.2 0 0 1 4.4 0V16"/><path d="M11.8 10.5V16"/>',
  alert: '<path d="M12 3.5 21 19.5H3Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
};

export const ICON_NAMES = Object.keys(ICONS);
const SPRITE_ID = 'sp-icon-sprite';
const PREFIX = 'si-';

/**
 * Inject the sprite once. The markup is a module constant, never user data,
 * so a single innerHTML assignment here is safe and keeps everything else in
 * the app free of raw HTML.
 */
export function installIconSprite(doc = document) {
  if (doc.getElementById(SPRITE_ID)) return;
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', SPRITE_ID);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  svg.innerHTML = Object.entries(ICONS)
    .map(([name, body]) => `<symbol id="${PREFIX}${name}" viewBox="0 0 24 24">${body}</symbol>`)
    .join('');
  doc.body.prepend(svg);
}

/**
 * Build an icon element.
 * @param {string} name key from ICONS; unknown names fall back to a neutral glyph
 * @param {{ size?: number, className?: string, title?: string, filled?: boolean }} options
 */
export function icon(name, options = {}) {
  const { size = 20, className = '', title = '', filled = false } = options;
  const resolved = ICONS[name] ? name : 'spark';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', filled ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('focusable', 'false');
  if (title) {
    svg.setAttribute('role', 'img');
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    label.textContent = title;
    svg.append(label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${PREFIX}${resolved}`);
  svg.append(use);
  return svg;
}
