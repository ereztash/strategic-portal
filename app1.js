
        // Database Structure - Added "generic" generator for Comparison Mode
        let appDatabase = [
            {
                id: "cat-engineering", title: "דיבאג ועיבוד נתונים", icon: "fa-database", color: "bg-blue-600", textColor: "text-blue-500", desc: "שליטה מוחלטת ב-AI.",
                prompts: [
                    {
                        id: "prompt-fixer", symptom: "ה-AI ענה בשגיאה (למשל: סריקה נעצרה) או נתן תוצאה לא מדויקת.", symptomIcon: "fa-wrench",
                        title: "מתקן הפרומפטים", shortDesc: "מאלץ את ה-AI לשכתב את הבקשה שלך.",
                        strategy: "Meta-Prompting: משתמש ב-AI כדי לתקן פרומפטים שבורים במקום לנחש בעצמנו.",
                        fields: [
                            { id: "brokenPrompt", label: "הפרומפט שנכשל:", type: "textarea", placeholder: "למשל: נתחו את 20 המשחקים..." },
                            { id: "goal", label: "המטרה:", type: "text", placeholder: "השוואה בטבלה של כמות שחקנים" }
                        ],
                        generate: (data) => `כתבתי פרומפט שמיועד עבורך, אבל הוא נכשל או יצר שגיאה.\nהפרומפט:\n"${data.brokenPrompt}"\n\nהמטרה שלי:\n"${data.goal}"\n\nהתנהג כמהנדס פרומפטים. נתח למה הוא נכשל (העדר הקשר/פורמט/מקור נתונים), וכתוב לי 2 גרסאות חדשות ומדויקות של הפרומפט הזה שכוללות פרסונה והגדרות חזקות כדי שאעתיק אותן.\nאל תבצע את המשימה בעצמך!`,
                        generic: (data) => `הפרומפט הזה לא עבד: "${data.brokenPrompt}". תתקן לי אותו כדי שיעשה: "${data.goal}".`
                    }
                ]
            },
            {
                id: "cat-marketing", title: "שיווק ויצירת תוכן", icon: "fa-bullhorn", color: "bg-rose-600", textColor: "text-rose-500", desc: "כתיבה אנושית.",
                prompts: [
                    {
                        id: "anti-robot", symptom: "הכתיבה מרגישה פלסטית ומלאה קלישאות של AI.", symptomIcon: "fa-robot",
                        title: "מחסל הבולשיט", shortDesc: "כותב תוכן בגובה העיניים.",
                        strategy: "Negative Constraints - חסימת ביטויים צפויים ואילוץ מבנה קצר.",
                        fields: [
                            { id: "topic", label: "נושא:", type: "text", placeholder: "3 טעויות באינסטגרם" },
                            { id: "audience", label: "קהל יעד:", type: "text", placeholder: "בעלי עסקים קטנים" }
                        ],
                        generate: (data) => `כתוב תוכן על: "${data.topic}" עבור "${data.audience}".\nהוראות קריטיות:\n1. טון ישיר, קליל ובגובה העיניים.\n2. איסור מוחלט על קלישאות כגון "בעולם התחרותי של היום", "לסיכום" או "חשוב לציין".\n3. משפטים קצרים (1-2 לפסקה).\n4. התחל בהוק חזק שמושך תשומת לב.\nהטקסט חייב להישמע כאילו נכתב ע"י בן אדם אמיתי.`,
                        generic: (data) => `תכתוב לי פוסט שיווקי על ${data.topic} לקהל של ${data.audience}. שיהיה מעניין.`
                    }
                ]
            },
            {
                id: "cat-strategy", title: "אסטרטגיה ופרודוקטיביות", icon: "fa-chess", color: "bg-amber-600", textColor: "text-amber-500", desc: "שבירת חסמים.",
                prompts: [
                    {
                        id: "micro-tasker", symptom: "יש לי משימה גדולה שאני דוחה מרוב חרדה או עומס.", symptomIcon: "fa-layer-group",
                        title: "מפרק ההרים (דחיינות)", shortDesc: "מפצל פרויקטים למשימות של 10 דקות.",
                        strategy: "פירוק מיקרוסקופי המוריד את העומס הקוגניטיבי (Micro-Stepping).",
                        fields: [
                            { id: "bigTask", label: "הפרויקט:", type: "text", placeholder: "כתיבת הרצאה לזום" },
                            { id: "blocker", label: "החסם:", type: "text", placeholder: "לא יודע מאיפה להתחיל" }
                        ],
                        generate: (data) => `אני סובל מדחיינות לגבי הפרויקט: "${data.bigTask}".\nהחסם העיקרי: "${data.blocker}".\n\nכמומחה לפרודוקטיביות, משימתך היא "לפרק את ההר". \nתן לי צ'ק ליסט של 5 הצעדים הראשונים *בלבד*.\nכל משימה חייבת להיות פעולה קטנה ופשוטה שלוקחת מקסימום 10-15 דקות לביצוע (למשל: לא "לכתוב מבוא" אלא "לפתוח קובץ ולכתוב 3 כותרות").`,
                        generic: (data) => `איך אני מתחיל לעשות את הפרויקט הזה: ${data.bigTask}? קשה לי כי ${data.blocker}. תעזור לי.`
                    }
                ]
            }
        ];

        let currentView = 'home';
        let currentCategory = null;
        let currentTool = null;
        let compareMode = 'strategic';
        let currentGeneratedStrategic = '';
        let currentGeneratedGeneric = '';
        if(!localStorage.getItem('zeroToAi_history')) localStorage.setItem('zeroToAi_history', JSON.stringify([]));
        if(!localStorage.getItem('zeroToAi_stats')) localStorage.setItem('zeroToAi_stats', JSON.stringify({ totalGen: 0, totalCopied: 0, tools: {} }));
        if(!localStorage.getItem('zeroToAi_custom')) localStorage.setItem('zeroToAi_custom', JSON.stringify([]));
        function loadCustomTools() {
            const customTools = JSON.parse(localStorage.getItem('zeroToAi_custom'));
            if(customTools && customTools.length > 0) {
                appDatabase.push({
                    id: "cat-custom", title: "המנועים שלי", icon: "fa-user-astronaut", color: "bg-teal-600", textColor: "text-teal-500", desc: "מנועים שיצרת ב-Builder.",
                    prompts: customTools.map(t => ({
                        ...t,
                        generate: (data) => {
                            let res = t.template;
                            t.fields.forEach(f => { res = res.replace(new RegExp(`{{${f.id}}}`, 'g'), data[f.id]); });
                            return res;
                        },
                        generic: (data) => "מנוע מותאם אישית - אין גרסה גנרית."
                    }))
                });
            }
        }
