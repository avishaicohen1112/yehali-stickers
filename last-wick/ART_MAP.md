# מפת האמנות — איזו תמונה נכנסה לאן

כל תמונה נשמרת ב־`art_src/<ID>.webp`. כשמגיעה גרסה חדשה לאותו ID, מחליפים את הקובץ ומריצים מחדש את הכלי שבטבלה.

## תדריך 1 (נכנס למשחק)
| ID | מה זה | לאן במשחק | כלי |
|---|---|---|---|
| A02, A03 | גיליונות הגיבור | `assets/sprites/wick` | `posesheet.py tools/sheets/wick.json` |
| A00, A01 | דף סגנון, הגיבור המלא | רפרנס בלבד | — |
| B01–B07 | דמויות שיחה (מלא/ראש/גוף) | `n_merchant, n_gardener, n_monk, n_glassmaker, n_astronomer, n_ferryman, n_dreamer` | `posesheet.py tools/sheets/n_*.json` |
| C-A..C-E | אויבים, 4 תנוחות בשורה | `e_*` (18 אויבים) | `posesheet.py tools/sheets/e_*.json` |
| D01–D05, D07, D09–D12 `-poses` | בוסים, 8 תנוחות | `b_knight, b_moth, b_angler, b_vesper, b_extinguisher, b_colossus, b_captain, b_keeper, b_paperking, b_clockmaker` | `posesheet.py tools/sheets/b_*.json` |
| D06 | מקהלת הנרות | props `gb_choir_s0..2, gb_choir_note` | `general.py bosses` |
| D08-parts | לווייתן (חלקים) | props `gb_leviathan_*` | `general.py bosses` |
| D13-form1/2/3, D13-effects | השלהבת הראשונה | props `gb_firstflame_*` | `general.py bosses` |
| D*-full, D*-parts (חוץ מ־D08) | איורים מלאים / חלקים | רפרנס בלבד כרגע | — |
| E–P 1..8 | 11 אזורים: רקע, צלליות, אמצע, קדמי, אלמנטים, קרקע, מרקם, אביזרים | `assets/scn/<area>`, `assets/art/<area>`, props `<area>_*`, `assets/scenes.json` | `area.py <אות> --rooms` |
| J01 | מזבח שמירה | prop `bench` | `general.py` |
| J02 | לוח כתובת | prop `tablet` | `general.py` |
| J03 | המדורה הגדולה | prop `brazier` | `general.py` |
| J04 | פריטים | props `item_heart, item_vessel, item_spell, item_drop` | `general.py` |
| J05 | ממשק | props `ui_ring, ui_mask, ui_mask_empty, ui_divider` | `general.py` |
| J06 | שער בין עולמות | prop `portal` | `general.py` |

## תדריך 2 (בעבודה אצל GPT) — לאן כל דבר ייכנס
| ID | לאן | מצב |
|---|---|---|
| C2-01..C2-22 | מחליפים את `e_*` (16 תנוחות) | מתכונים מוכנים: `tools/sheets/e2_*.json` |
| A04, A05 | תנוחות חדשות לגיבור: open, windwalk, blown, lever, point, ride, bored, dance, sleep | צריך להוסיף ל־`tools/sheets/wick.json` (הקוד כבר מחובר) |
| X9–X12 | פרטים חיים, פלטפורמות, קיר שני, פינות לכל אזור | צריך להרחיב את `area.py` |
| R01–R04 | תיבות (בסיס + מכסה) | הקוד מחפש props `chest_<kind>_base/_lid` — צריך כלי חיתוך |
| C-F, C19–C22 | אויבי רוח | צריך מתכונים `e_gustwraith, e_windmoth, e_anchorgrub, e_barkthrower` |
| W01 | אפקטי רוח | props `fx_wind_curl0..3` (הקוד כבר מחובר) |
| U1–U13 | תיאטרון הצללים | `area.py` (להוסיף אות U = theatre) |
| T01–T05 | בוסים ענקיים | props `gb_<boss>_<part>` לפי השמות ב־`js/giants.js` |
| B08, B09 | הסדרנית, הלחשן | מתכוני `n_usher` (צריך להוסיף) |
