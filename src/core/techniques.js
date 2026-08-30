/**
 * The prompt-engineering technique taxonomy.
 *
 * Every engine declares which techniques it applies. That turns the portal from
 * a list of canned texts into something teachable: you can filter by technique,
 * and each generated prompt can explain *why* it is shaped the way it is.
 *
 * Names follow the vocabulary used across the public prompt-engineering
 * literature (zero/few-shot, chain-of-thought, self-consistency, role prompting,
 * decomposition, meta-prompting, ReAct, RAG, reflexion).
 */

export const TECHNIQUES = {
  role: {
    id: 'role',
    label: 'פרסונה (Role Prompting)',
    labelEn: 'Role Prompting',
    summary: 'מגדיר למודל מי הוא לפני שהוא עונה, כדי לקבע רמת מומחיות ואוצר מילים.',
    level: 'basic',
  },
  fewShot: {
    id: 'fewShot',
    label: 'למידה מדוגמאות (Few-Shot)',
    labelEn: 'Few-Shot',
    summary: 'מציג 2-5 דוגמאות לפלט הרצוי, כך שהמודל לומד את התבנית במקום לנחש אותה.',
    level: 'basic',
  },
  chainOfThought: {
    id: 'chainOfThought',
    label: 'שרשרת חשיבה (Chain-of-Thought)',
    labelEn: 'Chain-of-Thought',
    summary: 'מחייב את המודל לפרוש שלבי ביניים לפני התשובה, ומשפר משימות ניתוח והיגיון.',
    level: 'intermediate',
  },
  selfConsistency: {
    id: 'selfConsistency',
    label: 'עקביות עצמית (Self-Consistency)',
    labelEn: 'Self-Consistency',
    summary: 'מבקש כמה מסלולי פתרון עצמאיים ואז בחירה בתשובה שחוזרת על עצמה.',
    level: 'advanced',
  },
  decomposition: {
    id: 'decomposition',
    label: 'פירוק משימה (Decomposition)',
    labelEn: 'Decomposition',
    summary: 'מפצל בעיה גדולה לתתי-משימות קטנות שאפשר לבצע או לאמת בנפרד.',
    level: 'intermediate',
  },
  negativeConstraints: {
    id: 'negativeConstraints',
    label: 'אילוצים שליליים (Negative Constraints)',
    labelEn: 'Negative Constraints',
    summary: 'מגדיר במפורש מה אסור לכתוב. הדרך היעילה ביותר לחסל קלישאות וניסוח רובוטי.',
    level: 'basic',
  },
  outputFormat: {
    id: 'outputFormat',
    label: 'פורמט פלט קשיח (Output Contract)',
    labelEn: 'Output Contract',
    summary: 'קובע מראש מבנה מדויק - טבלה, JSON, סעיפים - כדי שהפלט יהיה שמיש מיד.',
    level: 'basic',
  },
  metaPrompting: {
    id: 'metaPrompting',
    label: 'מטא-פרומפטינג (Meta-Prompting)',
    labelEn: 'Meta-Prompting',
    summary: 'משתמש במודל כדי לכתוב או לתקן פרומפט, במקום לנחש בעצמנו מה נשבר.',
    level: 'intermediate',
  },
  reflexion: {
    id: 'reflexion',
    label: 'ביקורת עצמית (Reflexion)',
    labelEn: 'Reflexion',
    summary: 'מוסיף סבב שני שבו המודל מבקר את התשובה שלו עצמו ומתקן אותה.',
    level: 'advanced',
  },
  react: {
    id: 'react',
    label: 'חשיבה ופעולה (ReAct)',
    labelEn: 'ReAct',
    summary: 'משלב חשיבה עם צעדי פעולה או חיפוש, למשימות שדורשות מידע חיצוני.',
    level: 'advanced',
  },
  grounding: {
    id: 'grounding',
    label: 'עיגון במקורות (Grounding)',
    labelEn: 'Grounding',
    summary: 'מחייב הסתמכות על חומר שסופק ואיסור להשלים פערים מהדמיון.',
    level: 'intermediate',
  },
  contrastive: {
    id: 'contrastive',
    label: 'ניגוד מכוון (Contrastive)',
    labelEn: 'Contrastive',
    summary: 'מציג גם דוגמה טובה וגם דוגמה גרועה, כדי לחדד את הגבול ביניהן.',
    level: 'intermediate',
  },
  audienceFraming: {
    id: 'audienceFraming',
    label: 'מיסגור קהל (Audience Framing)',
    labelEn: 'Audience Framing',
    summary: 'מתאר למי הפלט מיועד ומה הוא כבר יודע, כדי לכוון רמת עומק וטון.',
    level: 'basic',
  },
  rubric: {
    id: 'rubric',
    label: 'מחוון הערכה (Rubric)',
    labelEn: 'Rubric',
    summary: 'מספק קריטריונים מדידים שהמודל חייב לציין לפיהם, במקום חוות דעת כללית.',
    level: 'intermediate',
  },
  perspectiveShift: {
    id: 'perspectiveShift',
    label: 'החלפת נקודת מבט',
    labelEn: 'Perspective Shift',
    summary: 'מכריח את המודל לענות מכמה עמדות מנוגדות, כדי לחשוף נקודות עיוורון.',
    level: 'intermediate',
  },
};

export const TECHNIQUE_IDS = Object.keys(TECHNIQUES);

/** Look up a technique, tolerating ids that no longer exist. */
export function getTechnique(id) {
  return TECHNIQUES[id] ?? null;
}

/** Resolve a list of ids to technique objects, dropping unknown ones. */
export function resolveTechniques(ids = []) {
  return ids.map(getTechnique).filter(Boolean);
}

/** Count how many engines use each technique, for the filter chips. */
export function techniqueUsage(engines) {
  const counts = new Map();
  for (const engine of engines) {
    for (const id of engine.techniques ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}
