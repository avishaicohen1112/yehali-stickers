# הנדאוף — "הפתיל האחרון" (The Last Wick)

אתה ממשיך פרויקט קיים. קרא את הקובץ הזה ואז את `last-wick/README.md` ו־`last-wick/ART_BRIEF.md`.

## מה זה
מטרויידבניה דו־ממדית בסגנון Hollow Knight, ב־JS וניל + Canvas 2D (בלי build, נפתח גם מ־file://), עברית.
- ריפו: `avishaicohen1112/yehali-stickers`, **ענף `ccr-46d5e42a-c9dnse`**, תיקייה `last-wick/` (שאר הריפו = משחק ישן, לא לגעת).
- מבנה: `js/` (main, player, enemies, bosses, objects, world, render, scenery, puppet, fx, ui, text, audio, input, assets, data.js מג'ונרט), `tools/` (פייתון), `assets/`.
- נתונים: `tools/world.py` מגדיר את כל החדרים (ASCII מחוצב: `#` מוצק, `=` פלטפורמה חד־כיוונית, `^` קוצים, `~` מים/ים אש קטלני, `x` שער צל). אחרי כל שינוי: `python3 tools/build_data.py` (יוצר `js/data.js`).

## מצב נוכחי
- 3 עולמות, 44 חדרים, 13 בוסים, 18 אויבים, 3 יכולות שער לכל עולם (dash, djump, wall · glide, shadow), פורטלים בין עולמות, מפה לכל עולם, חנות, מזבחות שמירה, NPC, מוזיקה פרוצדורלית לכל אזור (`js/audio.js`).
  - לומנהולד: crypts/gardens/nave/spire/hearth · בוסים knight, moth, angler, vesper, extinguisher + אופציונליים choir, colossus.
  - ים הגחלים: shore/galleon/lighthouse · leviathan, captain, keeper. עולם החלום: paper/clock/core · paperking, clockmaker, firstflame (סוף).
- כל הלוגיקה עובדת ונבדקה בבוטים (בלי שגיאות, אין היתקעויות).
- **הגרפיקה כרגע זמנית**: רינדורים מבלנדר (`tools/*3d.py`) לעולם 1, ובלוקים/כתמים בעולמות 2–3. המשתמש **לא אוהב** את האמנות התלת־ממדית — הוחלט שהאמנות תגיע מצ'אט GPT (מודל תמונות). **אסור לייצר אמנות בעצמך יותר** — רק לתאר, לבנות מנועים ולשלב.

## זרימת האמנות (הדבר העיקרי עכשיו)
1. המשתמש פתח בצ'אט GPT פרויקט עם `last-wick/ART_BRIEF.md` (המגילה: ~130 תמונות, לפי IDs: A00 סגנון, A01 גיבור, A02–A03 גיליונות 4×4 של הגיבור, B דמויות, C גיליונות אויבים 4×4 (שורה=אויב, 4 תנוחות), D בוסים (איור + גיליון 4×2 + דף חלקים), E–P אזורים (רקע רחוק, צלליות, אמצע, קדמי, אלמנטים, ערכת קרקע, מרקם, אביזרים), J כללי).
2. המשתמש שולח לך את התמונות **במייל לעצמו עם נושא "לקלוד"** כקבצים מצורפים. אתה מושך עם Gmail MCP: `search_threads` ← `get_thread` ← `download_gmail_attachment`. (גוגל דוקס חסום מהסביבה — קישורי דוקס לא עובדים.)
3. שילוב:
   - `tools/ingest.py` — מסיר רקע (שקוף/ירוק/לבן, עם despill), מפצל גיליון לרכיבים ומסדר לפי סדר קריאה. `sheet` / `single` / `layer --tile`.
   - **חסר עדיין**: כלי לגיליונות תנוחות → אטלס עם **עוגן נפרד לכל פריים** (קו רגליים + מרכז). להוסיף תמיכה ב־`G.Sprite.draw` ב־`anims[a].o[fi]` (עוגן לפריים). שמות אנימציות של הגיבור: idle run jump fall land dash slash slashup slashdown wall hurt focus cast sit death (+ glide). קצב ריצה לפי מהירות (`phase += dt*|vx|*0.055`).
   - `tools/rigtool.py` + `js/puppet.js` — ריג חלקים (cutout) עם קפיצים לבד/צעיף ועיוות רשת (chain). לבוסים: אפשר גם לחתוך חלקים מאיור מלא.
   - `js/scenery.js` — רקעים בשכבות (`assets/scenes.json` → `window.SCENES`): שכבות עם parallax, tile, ערפל נע, קרני אור, אלמנטים מונפשים (sway/bob/flicker/chain), ושכבות קדמיות (`front:true`).
   - `tools/terrain2d.py` — צובע קרקע לכל חדר מערכת קרקע: `assets/art/<area>/rock.png, trim_top.png, trim_bottom.png, plat.png, spikes.png` (+ `kit.json`). להריץ לכל החדרים כשהערכה מגיעה.
   - `tools/place_props.py` — מיקום אביזרים אוטומטי; `assets/props/manifest.json`.
   - אטלסים: `assets/sprites/<name>.webp/.json` → `build_data.py` אוסף ל־`window.ATLAS`. אויבים `e_<kind>`, בוסים `b_<kind>`, NPC `n_<id>`, גיבור `wick`.

## בדיקות (חובה אחרי שינויים)
- `tools/tests/reach.js ROOM '{"dash":true,...}' X Y` — BFS על הפיזיקה האמיתית: אילו יציאות נגישות עם אילו יכולות.
- `tools/tests/monkey.js` — בוט אקראי בזירות בוסים (תופס שגיאות). `tools/tests/sim.js` — תרחישים.
- צילומי מסך: playwright (מותקן, `chromium.launch()`), URL debug: `index.html?room=c3&x=24&y=23&abil=all`.
- `for f in js/*.js; do node --check $f; done`.

## כללים
- לדבר עם המשתמש בעברית, קצר וברור; הוא לא טכני. לעדכן אותו כל כמה דקות.
- commit + push לענף אחרי כל שלב (hook דורש). לא PR בלי בקשה.
- הבא בתור: לבנות את כלי הגיליונות+עוגנים, ואז לשלב כל מנה של תמונות שמגיעה (בסדר: A00–A03 גיבור, אחר כך עולם 1).
