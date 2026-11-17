## Что это и когда брать
pypdf (библиотека Python для PDF) извлекает текст, склеивает и режет файлы. pdftoppm (программа из набора poppler) рисует страницы в PNG, чтобы увидеть их глазами. Новый PDF собирают через reportlab (генератор PDF на Python) или из HTML через Chrome. Не бери PDF, пока документ ещё правится — сначала Word, учебник `docx`. Сканы без текстового слоя требуют распознавания (OCR), здесь его нет.

## Установка и проверка
```bash
python3 -c "import pypdf; print(pypdf.__version__)"; pdftoppm -v 2>&1 | head -1
```
Если нет — без установки: `uv run --with pypdf --with reportlab python script.py`. poppler ставится через пакетный менеджер — только после «да» пользователя.

## Порядок работы
1. Найди шрифт с кириллицей и знаком ₽. Стандартные шрифты PDF кириллицу не знают.
2. Собери PDF. Сложную вёрстку (таблицы, переносы, колонтитулы) делай через HTML: так быстрее.
3. Отрисуй каждую страницу в PNG и посмотри все. Это обязательно после любой генерации.
4. Проверь текстовый слой: `pdftotext` должен отдать читаемый текст.
5. Проверь, что шрифты встроены: колонка `emb` в `pdffonts` равна `yes`.

## Готовые команды
Найти шрифт, в котором есть кириллица и ₽ (U+20BD):
```bash
FONT=$(fc-match -f '%{file}' 'sans-serif:charset=20bd:lang=ru'); echo "$FONT"
```
Счёт через reportlab, путь к шрифту — первым аргументом. Сохрани как `make_pdf.py`:
```python
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle
pdfmetrics.registerFont(TTFont("Body", sys.argv[1]))
st = getSampleStyleSheet()
for s in st.byName.values(): s.fontName = "Body"
t = Table([["Услуга", "Сумма"], ["Аудит договора", "15 000,00 ₽"], ["Итого", "15 000,00 ₽"]], colWidths=[300, 120])
t.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), "Body"), ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                       ("ALIGN", (1, 0), (-1, -1), "RIGHT")]))
SimpleDocTemplate(sys.argv[2], pagesize=A4, initialFontName="Body").build([Paragraph("Счёт № 7 от 15.01.2026", st["Title"]), t])
```
```bash
uv run -q --with reportlab python make_pdf.py "$FONT" schet.pdf
```
HTML в PDF через Chrome без установки Playwright. В HTML укажи `<meta charset="utf-8">`, шрифт и `@page{size:A4;margin:20mm}`:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --no-pdf-header-footer --print-to-pdf=akt.pdf akt.html 2>/dev/null
# Linux: chromium --headless --no-pdf-header-footer --print-to-pdf=akt.pdf akt.html
npx --no-install playwright pdf akt.html akt.pdf   # (не проверено: браузер Playwright не скачан на машине автора)
```
Рендер, текст, шрифты, лист-превью всех страниц:
```bash
pdftoppm -png -r 100 schet.pdf page && ls page-*.png
pdftotext -layout schet.pdf - | head -20
pdffonts schet.pdf
magick montage -font "$FONT" page-*.png -tile 4x -geometry 300x+8+8 pages_sheet.png
```
Текст, склейка, нарезка — сохрани как `pdf_tools.py`:
```python
import sys
from pypdf import PdfReader, PdfWriter
cmd, f = sys.argv[1], sys.argv[2]
if cmd == "text":
    for i, page in enumerate(PdfReader(f).pages, 1): print(f"--- стр. {i} ---\n{page.extract_text()}")
elif cmd == "merge":
    w = PdfWriter()
    for src in sys.argv[3:]: w.append(src)
    w.write(f)
elif cmd == "split":
    for i, page in enumerate(PdfReader(f).pages, 1):
        w = PdfWriter(); w.add_page(page); w.write(f"{sys.argv[3]}-{i}.pdf")
```
```bash
python3 pdf_tools.py merge pack.pdf schet.pdf akt.pdf
python3 pdf_tools.py split pack.pdf part
python3 pdf_tools.py text pack.pdf
```

## Частые ошибки
- Шрифт без ₽: на месте знака пустой квадрат. Arial из macOS его не содержит.
- `pdftotext` показывает ₽, даже когда на странице квадрат. Текст глифы не проверяет — только картинка.
- Шрифт не встроен (`emb no`): у получателя документ откроется другим шрифтом.
- Последняя строка таблицы уехала на отдельную страницу. Смотри все страницы, а не первую.
- Колонтитулы Chrome (дата, адрес файла) попали в документ: забыт `--no-pdf-header-footer`.
- `extract_text()` на скане даёт пустую строку. Это не ошибка кода, а отсутствие текстового слоя.

## След для Проверяющего
В папку результатов задачи: итоговый PDF, исходник (скрипт или HTML), PNG каждой страницы или лист-превью `pages_sheet.png`, вывод `pdffonts` и `pdfinfo` (число страниц).
