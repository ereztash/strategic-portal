# מ-0 ל-AI · פורטל אסטרטגי

**מכאב לפרומפט שעובד.**

רוב הכלים לפרומפטים מבקשים ממך לדעת מה לחפש. הפורטל הזה מתחיל מהמקום שבו אנשים
באמת נמצאים: *"הטקסט נשמע רובוטי"*, *"ה-AI ממציא עובדות"*, *"אני דוחה את זה שבועיים"*.
אתם מתארים את הסימפטום, מקבלים פרומפט מהונדס, ורואים שורה-מול-שורה במה הוא שונה
ממה שהייתם כותבים לבד.

50 מנועים ב-10 תחומים. הכל נשמר במכשיר שלכם, ועובד גם בלי חיבור לרשת.

---

## מה יש כאן

| | |
|---|---|
| **חיפוש לפי כאב** | חיפוש משוקלל שמכיר תחיליות בעברית (ו/ה/ב/ל/מ/כ/ש) וסובל שגיאות כתיב. אפשר לכתוב משפט שלם, לא רק מילת מפתח. |
| **מצב השוואה** | לכל מנוע יש גם "גרסה גנרית" - איך רוב האנשים היו מנסחים את זה - ותצוגת diff שמראה בדיוק מה ההנדסה מוסיפה. |
| **שכבות (Modifiers)** | 16 שכבות הוראה שאפשר להרכיב על כל מנוע: חשיבה שלב-שלב, פורמט פלט, ביקורת עצמית, בלי מליצות. קבוצות מסוימות בלעדיות זו לזו. |
| **טקסונומיית טכניקות** | כל מנוע מצהיר באילו טכניקות הוא משתמש (Few-Shot, Chain-of-Thought, Negative Constraints, Rubric...), ואפשר לסנן לפיהן. |
| **כספת** | שמירת פרומפטים עם הערות ונעיצה. מחיקה היא רכה: סל מיחזור עם שחזור למשך 30 יום. "פתח מחדש" משחזר גם את הקלט המקורי. |
| **בונה מנועים** | בניית מנוע אישי בלי קוד, כולל זיהוי אוטומטי של משתנים מהתבנית, תצוגה מקדימה חיה, שכפול, ייצוא וייבוא. |
| **קישורי שיתוף** | כל פרומפט שחוללתם ניתן לשיתוף בקישור אחד שמקודד את הקלט - הצד השני נוחת על אותו מנוע עם אותם ערכים. |
| **אנליטיקס מקומי** | כמה חוללתם, כמה באמת העתקתם, ומצעד מנועים. אף בית לא עוזב את הדפדפן. |
| **PWA** | מותקן כאפליקציה, עובד ללא רשת. |
| **נגישות ו-i18n** | ניווט מלא במקלדת, ARIA, מצב כהה/בהיר, וממשק בעברית או אנגלית עם החלפת כיוון. |

## קיצורי מקלדת

| | |
|---|---|
| `Ctrl/⌘ + K` | חלונית פקודות |
| `/` | מיקוד בחיפוש |
| `Ctrl/⌘ + Enter` | חילול פרומפט |
| `Ctrl/⌘ + Shift + C` | העתקת התוצאה |
| `Ctrl/⌘ + S` | שמירה לכספת |
| `G` ואז `H` | חזרה לראשי |
| `?` | כל הקיצורים |

---

## Architecture

No build step, no runtime dependencies, no backend. The whole thing is ES modules
served as static files, which is what makes it deployable anywhere and auditable
in one sitting.

```
index.html            app shell: boot script, theme pre-paint, loader
styles.css            design system - tokens, light/dark, logical properties for RTL/LTR
sw.js                 offline cache (generated precache list - see scripts/build-sw.js)
src/
  core/               pure logic, no DOM, fully unit tested
    template.js       {{var}} · {{var ?? fallback}} · [[optional]] · <<fragment>>
    search.js         weighted symptom-first search with Hebrew prefix handling
    store.js          schema-versioned localStorage, pub/sub, backup, v1 migration
    registry.js       merges built-in and custom engines, builds prompts
    modifiers.js      composable instruction fragments
    techniques.js     prompt-engineering taxonomy
    diff.js tokens.js i18n.js targets.js utils.js
  data/
    categories.js     the ten fronts
    engines/*.js      the library - 50 engines, pure data
  ui/
    dom.js            ~60 line element builder; text always via textContent
    router.js         hash router, deep links, share-state encoding
    app.js            controller: settings, favourites, vault, stats, clipboard
    components.js icons.js modal.js palette.js toast.js shortcuts.js
    views/*.js        one module per route
  main.js             wires it together, renders the chrome
tests/                80+ cases under `node --test`
```

### Engines are data, not code

v1 stored each prompt as a JavaScript closure, so an engine could not be
exported, imported, diffed or tested. Every engine is now a plain object:

```js
{
  id: 'anti-robot',
  categoryId: 'content',
  title: 'מחסל הבולשיט',
  symptom: 'הכתיבה יוצאת פלסטית, מלאה ב"בעולם התחרותי של היום"...',
  strategy: 'אילוצים שליליים: רשימת ביטויים אסורה חוסמת בדיוק את...',
  techniques: ['negativeConstraints', 'audienceFraming', 'outputFormat'],
  level: 'basic',
  fields: [{ id: 'topic', label: 'הנושא', type: 'text', required: true }, ...],
  template: 'כתוב תוכן ל{{platform}} בנושא: {{topic}}[[\nהתובנה: {{insight}}]]...',
  generic: 'תכתוב לי פוסט שיווקי על {{topic}}...',
  example: { topic: '...', audience: '...' },
}
```

Because it is data, the test suite can walk the entire library and fail the
build on an undeclared template variable, a stale technique id, a select whose
default is not one of its options, or an example that leaves a required field
empty — rather than letting it render blank in someone's browser.

### Template syntax

| | |
|---|---|
| `{{name}}` | interpolate; empty when missing |
| `{{name ?? ברירת מחדל}}` | interpolate, or use the literal fallback |
| `[[ ... {{name}} ... ]]` | optional block; removed entirely when every variable inside is empty |
| `<<fragment>>` | expand a named fragment (used by the modifiers) |

Optional blocks are what let one template serve a half-filled form and a fully
filled one without leaving dangling labels like `רקע:` with nothing after it.

---

## Development

```bash
npm test          # 89 cases, no dependencies
npm run serve     # http://localhost:4173
npm run build:sw  # regenerate the service worker precache list
```

`npm run build:sw` must be re-run whenever a file is added under `src/` or
`assets/`; a test fails if the committed `sw.js` has drifted from the tree.

### Adding an engine

1. Add an object to the right file in `src/data/engines/`.
2. Run `npm test` — the integrity suite checks metadata, fields, template
   variables, the baseline, and that the example renders a complete prompt.

### Data and privacy

Everything lives in `localStorage` under `sp.v2.*` and leaves only through an
explicit JSON export in Settings. Data written by v1 (`zeroToAi_*`) is migrated
on first load; the legacy keys are deliberately left in place so an older cached
deploy cannot lose anyone's prompts. If storage is blocked (private mode), the
app falls back to memory and says so instead of failing silently.

## Deployment

Static hosting, no build. `vercel.json` sets `cleanUrls`, a CSP, and a
`no-store` policy for `sw.js` so updates are picked up.
