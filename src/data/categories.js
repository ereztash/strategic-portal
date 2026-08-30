/**
 * Categories are "fronts" - the areas of work where people get stuck with AI.
 * `accent` maps to a CSS custom property defined in the stylesheet, so themes
 * can restyle every category from one place.
 */

export const CATEGORIES = [
  {
    id: 'debug',
    title: 'דיבאג ואיכות פלט',
    titleEn: 'Debugging AI output',
    desc: 'ה-AI ענה לא נכון, המציא, או פשוט לא הבין מה רציתם.',
    icon: 'wrench',
    accent: 'blue',
  },
  {
    id: 'content',
    title: 'שיווק ותוכן',
    titleEn: 'Marketing & content',
    desc: 'טקסט שנשמע אנושי, משכנע, ולא כמו מכונה.',
    icon: 'megaphone',
    accent: 'rose',
  },
  {
    id: 'strategy',
    title: 'אסטרטגיה והחלטות',
    titleEn: 'Strategy & decisions',
    desc: 'לחשוב לעומק, לבחון חלופות, ולא לפספס נקודות עיוורון.',
    icon: 'chess',
    accent: 'amber',
  },
  {
    id: 'productivity',
    title: 'פרודוקטיביות וחסמים',
    titleEn: 'Productivity & blockers',
    desc: 'לשבור דחיינות, לפרק משימות, ולסגור פינות.',
    icon: 'layers',
    accent: 'violet',
  },
  {
    id: 'code',
    title: 'קוד ופיתוח',
    titleEn: 'Code & engineering',
    desc: 'באגים, ריפקטור, ריוויו וכתיבת טסטים.',
    icon: 'code',
    accent: 'cyan',
  },
  {
    id: 'research',
    title: 'מחקר וניתוח',
    titleEn: 'Research & analysis',
    desc: 'לקרוא הרבה חומר, להוציא ממנו את העיקר, ולא להאמין לכל דבר.',
    icon: 'microscope',
    accent: 'emerald',
  },
  {
    id: 'communication',
    title: 'תקשורת ומיילים',
    titleEn: 'Communication',
    desc: 'מיילים קשים, משוב, ושיחות שנדחות שבועיים.',
    icon: 'mail',
    accent: 'sky',
  },
  {
    id: 'learning',
    title: 'למידה והוראה',
    titleEn: 'Learning & teaching',
    desc: 'להבין נושא חדש מהר, ולהסביר אותו למישהו אחר.',
    icon: 'book',
    accent: 'indigo',
  },
  {
    id: 'data',
    title: 'נתונים וטבלאות',
    titleEn: 'Data & tables',
    desc: 'לנקות דאטה, לבנות נוסחאות, ולהוציא תובנה ממספרים.',
    icon: 'table',
    accent: 'teal',
  },
  {
    id: 'business',
    title: 'קריירה ומכירות',
    titleEn: 'Career & sales',
    desc: 'הצעות מחיר, פרופיל מקצועי, ושיחות שסוגרות עסקה.',
    icon: 'briefcase',
    accent: 'orange',
  },
];

export const CUSTOM_CATEGORY = {
  id: 'custom',
  title: 'המנועים שלי',
  titleEn: 'My engines',
  desc: 'מנועים שבניתם בעצמכם בבונה המנועים.',
  icon: 'spark',
  accent: 'lime',
};

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

export function getCategory(id) {
  if (id === CUSTOM_CATEGORY.id) return CUSTOM_CATEGORY;
  return CATEGORIES.find((category) => category.id === id) ?? null;
}
