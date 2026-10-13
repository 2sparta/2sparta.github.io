# Джерела монгольського і могольського шарів

WebP — повні карти з легендами: SVG відрендеровано на білому тлі, PNG перекодовано. Автори, оригінальні назви, URL, SHA256 і ліцензії: manifest.json та scripts/atlas/mongol-originals.json.

- Cattette, [Expansion of the Mongol Empire.svg](https://commons.wikimedia.org/wiki/File:Expansion_of_the_Mongol_Empire.svg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Прямі векторні контури 1206, 1219, 1223, 1227, 1237, 1259, 1294. Після 1260 сукупний контур не означає єдиної держави.
- Gabagool, Ecthelion83 та Commons contributors, [MongolEmpireDivisions1300.png](https://commons.wikimedia.org/wiki/File:MongolEmpireDivisions1300.png), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). За Oxford Atlas of World History. Оцифровані чотири кольорові території зі збереженням великих озер. Пряме управління й васальна залежність у джерелі поєднані; локальні кордони приблизні.
- Elvonudinium, [Northern Yuan and Golden Horde.svg](https://commons.wikimedia.org/wiki/File:Northern_Yuan_and_Golden_Horde.svg), CC BY-SA 4.0. Схема XV–XVI ст. доступна окремо: **не застосована як точні одночасні полігони одного року**.
- Avantiputra7, [1530](https://commons.wikimedia.org/wiki/File:Mughal_Empire,_1530.png), [1605](https://commons.wikimedia.org/wiki/File:Mughal_Empire,_1605.png), [1707](https://commons.wikimedia.org/wiki/File:Mughal_Empire,_1707.png), CC BY-SA 4.0. За Joseph E. Schwartzberg, A Historical Atlas of South Asia; для 1707 також Truschke та Alam/Subrahmanyam. Контури вручну оцифровані в координатах оригіналів, непідкорені анклави 1605 збережені. Дрібні вигини й узбережжя приблизні.
- André Ourednik та Historical Basemaps contributors, [зафіксована версія](https://github.com/aourednik/historical-basemaps/tree/da7a4b735ecef70aebdc9c73e409d8a2500d50f3), GPL-3.0. Із 1500, 1600, 1700 імпортовано лише ординські наступники й Могольську імперію; це пунктирні оглядові межі з окремим авторством. Геометрії інших держав не змінені й не імпортовані.

[Навала: Encyclopedia of Ukraine](https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CT%5CA%5CTatars.htm). Позначки міст і битв не задають точного фронту. Червоний пунктир князівства означає розорення головного осередку, не ліквідацію всієї держави. Калка приблизна; день падіння Києва — традиційна дата цього джерела.

Старі полігони прибираються після істотних змін, навіть якщо держава існувала далі. За відсутності обґрунтованих пізніших меж показані осередки й події. Незалежність, номінальна зверхність, втрата столиці та зникнення династії розрізняються. Моголи Індії — окрема тимуридська держава.

Похідні дані CC BY-SA джерел поширюються за CC BY-SA 4.0, Basemaps — GPL-3.0; це не змінює автоматично ліцензію всього застосунку.

Відтворення: `python scripts/build-mongol-atlas.py SOURCE_DIRECTORY`. Python-залежності: NumPy, SciPy, pyproj, svgpathtools, Shapely, lxml, Pillow, opencv-python-headless, cairosvg. Точні назви Commons і SHA256 — у каталозі; контрольні точки та ручні контури — scripts/atlas/mongol-*.json. Геоприв’язка має відкладені контрольні точки; її похибка описує суміщення джерела, не точність історичного кордону. Між датами немає річної інтерполяції.
