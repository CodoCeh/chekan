## Что это и когда брать
python-docx (библиотека Python для файлов Word) создаёт и правит `.docx`: заголовки, списки, таблицы, колонтитулы. Бери её, когда заказчик ждёт именно Word: договор, письмо, отчёт под правку. Не бери, когда хватает текста в чате или нужен готовый к печати PDF без правок — тогда учебник `pdf`.

## Установка и проверка
```bash
python3 -c "import docx; print('docx есть')"
```
Если нет — работай без установки: `uv run --with python-docx python script.py`. Ставить что-либо в систему — только после «да» пользователя.

## Порядок работы
1. Чужой документ сначала прочитай: стили абзацев, таблицы, колонтитулы. Работай с копией, оригинал не трогай.
2. Новый документ строй на стилях Word (`Heading 1`, `List Number`, `Table Grid`), а не на ручном жирном шрифте. Тогда работает оглавление и навигация.
3. Правку существующего делай внутри runs (кусков текста с одним форматированием). Так шрифт и выделение не слетают.
4. Правки, которые юрист должен увидеть и принять, вноси режимом исправлений (tracked changes). python-docx умеет его только через XML, см. ниже.
5. Перечитай результат кодом и посмотри картинкой.

## Готовые команды
Новый документ: стили, нумерация, таблица, колонтитул.
```python
from docx import Document
from docx.shared import Pt, Cm
doc = Document()
doc.styles["Normal"].font.name = "Arial"; doc.styles["Normal"].font.size = Pt(11)
sec = doc.sections[0]; sec.left_margin = Cm(3); sec.right_margin = Cm(1.5)
sec.header.paragraphs[0].text = "ООО «Пример» — договор № 15/2026"
doc.add_heading("Договор оказания услуг", level=1)
doc.add_heading("1. Предмет договора", level=2)
for item in ["Подготовка отчёта.", "Сверка расчётов."]:
    doc.add_paragraph(item, style="List Number")
t = doc.add_table(rows=0, cols=3); t.style = "Table Grid"
for r in [("Услуга", "Кол-во", "Сумма, ₽"), ("Отчёт", "1", "15 000,00")]:
    for c, v in zip(t.add_row().cells, r): c.text = v
doc.save("dogovor.docx")
```
Номер страницы в нижнем колонтитуле (поле PAGE):
```python
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
doc = Document("dogovor.docx")
p = doc.sections[0].footer.paragraphs[0]; p.text = "Страница "
run = p.add_run()
for kind, text in (("begin", None), (None, "PAGE"), ("end", None)):
    el = OxmlElement("w:fldChar" if kind else "w:instrText")
    if kind: el.set(qn("w:fldCharType"), kind)
    else: el.text = text
    run._r.append(el)
doc.save("dogovor.docx")
```
Замена текста с сохранением форматирования (абзацы, таблицы, колонтитулы):
```python
from docx import Document
doc = Document("dogovor.docx")
paras = list(doc.paragraphs) + [p for t in doc.tables for r in t.rows for c in r.cells for p in c.paragraphs]
for s in doc.sections: paras += s.header.paragraphs + s.footer.paragraphs
for p in paras:
    for run in p.runs:
        if "15/2026" in run.text: run.text = run.text.replace("15/2026", "16/2026")
    if "15/2026" in p.text: print("фраза разбита на runs, правь вручную:", p.text[:60])
doc.save("dogovor_v2.docx")
```
Вставка в режиме исправлений. Удаление (`w:del`) делается так же, но текст внутри — `w:delText`.
```python
import datetime
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
doc = Document("dogovor_v2.docx")
p = next(p for p in doc.paragraphs if p.text.startswith("Подготовка"))
ins = OxmlElement("w:ins")
for k, v in (("w:id", "1001"), ("w:author", "Юрист"),
             ("w:date", datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"))):
    ins.set(qn(k), v)
r = OxmlElement("w:r"); t = OxmlElement("w:t"); t.set(qn("xml:space"), "preserve")
t.text = " В срок до 10 дней."; r.append(t); ins.append(r); p._p.append(ins)
doc.save("dogovor_v3.docx")
```
```bash
unzip -p dogovor_v3.docx word/document.xml | grep -o '<w:ins[^>]*>'
```
Проверка картинкой:
```bash
soffice --headless --convert-to pdf dogovor_v3.docx   # затем pdftoppm и посмотри страницы глазами
pdftoppm -png -r 80 dogovor_v3.pdf page
# грубая замена на macOS: только текст и таблицы, стили теряются
textutil -convert html dogovor_v3.docx -output preview.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --no-pdf-header-footer --print-to-pdf=preview.pdf preview.html 2>/dev/null
pdftoppm -png -r 80 preview.pdf page
```

## Частые ошибки
- `p.text = "..."` стирает всё форматирование абзаца. Меняй `run.text`.
- Фраза разбита Word на несколько runs, поиск по одному run её не видит. Скрипт должен сообщать об этом.
- Забыты таблицы и колонтитулы: `doc.paragraphs` их не содержит.
- `p.text` не показывает вставки из режима исправлений. Проверяй XML.
- Исправление на весь абзац (`w:del` всего текста + `w:ins` нового) автор читать не сможет. Режь run на части и оборачивай в `w:del`/`w:ins` только изменённый фрагмент.
- Принять или отклонить чужие исправления python-docx не умеет. Комментарии Word — только в новых версиях библиотеки.
- Номер страницы вписан числом, а не полем PAGE — на второй странице он неверный.
- Шрифт без кириллицы в стиле `Normal` даёт квадраты при печати на другой машине.

## След для Проверяющего
В папку результатов задачи: итоговый `.docx`, скрипт генерации, PNG первой и последней страницы, вывод проверки (список стилей абзацев или `grep` по `w:ins`). Если PDF не собрался — так и напиши, с причиной.
