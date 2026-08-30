/**
 * Composable prompt modifiers ("boosters").
 *
 * Every engine produces a solid base prompt. Modifiers are reusable instruction
 * fragments that can be layered on top of *any* engine - the same composition
 * idea CLI prompt libraries call "fragments", reduced to one-click toggles.
 *
 * Groups marked `exclusive` behave like radio buttons: picking one clears the
 * others in that group, because "answer in 3 bullets" and "answer in 800 words"
 * cannot both be true.
 */

import { TECHNIQUES } from './techniques.js';

export const MODIFIER_GROUPS = [
  { id: 'depth', label: 'עומק חשיבה', exclusive: true },
  { id: 'format', label: 'פורמט הפלט', exclusive: true },
  { id: 'length', label: 'אורך', exclusive: true },
  { id: 'language', label: 'שפה', exclusive: true },
  { id: 'control', label: 'בקרת איכות', exclusive: false },
];

export const MODIFIERS = [
  {
    id: 'cot',
    group: 'depth',
    label: 'חשיבה שלב-שלב',
    hint: 'מאלץ פריסת שלבי ביניים לפני התשובה.',
    technique: TECHNIQUES.chainOfThought.id,
    text: 'לפני התשובה הסופית, פרוש בקצרה את שלבי החשיבה שהובילו אליה, ורק אז תן את התוצר. סמן את החלק הסופי בכותרת "התוצר".',
  },
  {
    id: 'options',
    group: 'depth',
    label: '3 גישות שונות',
    hint: 'מייצר כמה מסלולי פתרון ואז ממליץ על אחד.',
    technique: TECHNIQUES.selfConsistency.id,
    text: 'הצע שלוש גישות שונות ועצמאיות למשימה, כתוב שורת יתרון וחיסרון לכל אחת, ולסיום המלץ על אחת ונמק את הבחירה במשפט אחד.',
  },
  {
    id: 'devil',
    group: 'depth',
    label: 'פרקליט השטן',
    hint: 'מוסיף התנגדות מכוונת לתשובה.',
    technique: TECHNIQUES.perspectiveShift.id,
    text: 'אחרי התוצר, הוסף פסקה בשם "התנגדות" שבה אתה תוקף את התשובה שלך עצמך: מה הכי סביר שלא יעבוד כאן, ולמה.',
  },
  {
    id: 'fmt-bullets',
    group: 'format',
    label: 'נקודות קצרות',
    hint: 'רשימה סרוקה במקום פסקאות.',
    technique: TECHNIQUES.outputFormat.id,
    text: 'החזר את התשובה כרשימת נקודות בלבד. כל נקודה משפט אחד, בלי פסקאות מקדימות ובלי סיכום בסוף.',
  },
  {
    id: 'fmt-table',
    group: 'format',
    label: 'טבלה',
    hint: 'פלט מובנה להשוואה.',
    technique: TECHNIQUES.outputFormat.id,
    text: 'החזר את התשובה כטבלת Markdown. הגדר בעצמך את העמודות המתאימות למשימה, והוסף שורת סיכום אחת מתחת לטבלה.',
  },
  {
    id: 'fmt-json',
    group: 'format',
    label: 'JSON',
    hint: 'פלט לצריכה על ידי קוד.',
    technique: TECHNIQUES.outputFormat.id,
    text: 'החזר JSON תקין בלבד, בלי טקסט לפניו או אחריו ובלי גדרות קוד. הגדר סכימה קבועה והישאר נאמן לה בכל האובייקטים.',
  },
  {
    id: 'fmt-steps',
    group: 'format',
    label: 'צ׳ק ליסט',
    hint: 'צעדים לביצוע עם תיבות סימון.',
    technique: TECHNIQUES.outputFormat.id,
    text: 'החזר את התשובה כצ׳ק ליסט ממוספר עם תיבות סימון (- [ ]). כל שורה היא פעולה אחת שאפשר לבצע, בזמן עבר-הווה ("לפתוח", "לנסח").',
  },
  {
    id: 'len-short',
    group: 'length',
    label: 'קצר וחד',
    hint: 'עד 150 מילים.',
    text: 'הגבל את התשובה ל-150 מילים לכל היותר. תעדיף מידע על פני נימוסים, וותר על הקדמות וסיכומים.',
  },
  {
    id: 'len-long',
    group: 'length',
    label: 'מפורט',
    hint: 'עומק והרחבה.',
    text: 'תן תשובה מפורטת ומעמיקה. הרחב כל טענה עם הסבר קצר או דוגמה, ואל תסתפק בכותרות.',
  },
  {
    id: 'lang-en',
    group: 'language',
    label: 'פלט באנגלית',
    hint: 'שומר על העברית בהוראות.',
    text: 'Write the final deliverable in natural, native-level English, even though these instructions are in Hebrew. Do not translate literally - write as an English speaker would.',
  },
  {
    id: 'lang-both',
    group: 'language',
    label: 'עברית + אנגלית',
    hint: 'שתי גרסאות לאותו תוצר.',
    text: 'ספק את התוצר פעמיים: קודם בעברית טבעית, ואז גרסה מקבילה באנגלית ברמת דובר יליד. אל תתרגם מילולית - כתוב מחדש.',
  },
  {
    id: 'ask-first',
    group: 'control',
    label: 'תשאל לפני שתתחיל',
    hint: 'עוצר ניחושים כשחסר מידע.',
    text: 'אם חסר לך מידע קריטי כדי לבצע את המשימה היטב, אל תנחש. שאל אותי עד שלוש שאלות ממוקדות, וחכה לתשובה לפני שאתה מתחיל.',
  },
  {
    id: 'no-fluff',
    group: 'control',
    label: 'בלי מליצות',
    hint: 'חוסם ניסוח רובוטי.',
    technique: TECHNIQUES.negativeConstraints.id,
    text: 'אסור להשתמש בביטויים: "בעולם של היום", "חשוב לציין", "לסיכום", "בואו נצלול", "המפתח הוא". בלי אימוג׳ים, בלי הקדמות ובלי משפטי מעבר ריקים.',
  },
  {
    id: 'grounded',
    group: 'control',
    label: 'רק לפי מה שנתתי',
    hint: 'מונע המצאות.',
    technique: TECHNIQUES.grounding.id,
    text: 'הסתמך אך ורק על המידע שסיפקתי. אם משהו לא מופיע בו, כתוב במפורש "לא סופק מידע על כך" במקום להשלים מהידע הכללי שלך.',
  },
  {
    id: 'self-check',
    group: 'control',
    label: 'ביקורת עצמית',
    hint: 'סבב תיקון אחרי התשובה.',
    technique: TECHNIQUES.reflexion.id,
    text: 'אחרי שסיימת, עבור על התשובה שלך ואתר את שתי החולשות הגדולות ביותר שלה. תקן אותן והצג רק את הגרסה המתוקנת.',
  },
  {
    id: 'examples',
    group: 'control',
    label: 'צרף דוגמאות',
    hint: 'קונקרטיזציה של כל טענה.',
    technique: TECHNIQUES.fewShot.id,
    text: 'לכל טענה או המלצה, צרף דוגמה קונקרטית אחת ומנוסחת במלואה. דוגמה איננה הסבר - היא הטקסט או המספר עצמו.',
  },
];

const BY_ID = new Map(MODIFIERS.map((modifier) => [modifier.id, modifier]));

export function getModifier(id) {
  return BY_ID.get(id) ?? null;
}

export function getGroup(id) {
  return MODIFIER_GROUPS.find((group) => group.id === id) ?? null;
}

/**
 * Toggle a modifier, enforcing exclusivity inside its group.
 * @returns {string[]} the new list of active ids
 */
export function toggleModifier(activeIds, id) {
  const modifier = getModifier(id);
  if (!modifier) return activeIds;
  const active = new Set(activeIds);
  if (active.has(id)) {
    active.delete(id);
    return [...active];
  }
  const group = getGroup(modifier.group);
  if (group?.exclusive) {
    for (const other of MODIFIERS) {
      if (other.group === modifier.group) active.delete(other.id);
    }
  }
  active.add(id);
  // Keep declaration order so the rendered prompt is deterministic.
  return MODIFIERS.filter((item) => active.has(item.id)).map((item) => item.id);
}

/** Resolve active ids to the instruction strings appended to the prompt. */
export function modifierTexts(activeIds = []) {
  return activeIds.map((id) => getModifier(id)?.text).filter(Boolean);
}

/** Techniques contributed by the active modifiers, for the technique badges. */
export function modifierTechniques(activeIds = []) {
  const ids = new Set();
  for (const id of activeIds) {
    const technique = getModifier(id)?.technique;
    if (technique) ids.add(technique);
  }
  return [...ids];
}
