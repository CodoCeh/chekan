## Что это и когда брать
openpyxl (библиотека Python для файлов Excel) читает и пишет `.xlsx`: формулы, форматы, листы, фильтры. Бери её для реестров, сверок, отчётов, разбора выгрузок из 1С. Не бери, когда таблица на десять строк и её достаточно показать в тексте. Для графиков есть учебник `charts`.

## Установка и проверка
```bash
python3 -c "import openpyxl; print(openpyxl.__version__)"
```
Если нет — без установки: `uv run --with openpyxl python script.py`. Ставить что-либо в систему — только после «да» пользователя.

## Порядок работы
1. Исходник не правь. Читай его, результат пиши в новый файл.
2. Итоги и производные считай формулами Excel (`=SUM(...)`), а не готовыми числами. Тогда заказчик видит, откуда цифра, и может поправить строку.
3. Даты пиши объектами `date`, деньги — числами. Вид задаёт формат ячейки, а не текст.
4. Закрепи шапку, включи фильтр, задай ширину колонок.
5. Пересчитай формулы и сверь итог со своим расчётом в Python. Расхождение больше копейки — ошибка.
6. Файл с одними формулами без Excel показывает пустые ячейки. Есть `soffice` — пересчитай им (команда ниже). Нет — добавь лист «Итоги (значения)» с цифрами из сверки и подпиши, что это значения на дату расчёта.

## Готовые команды
Отчёт с формулами, форматами и двумя листами:
```python
import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font
wb = Workbook(); ws = wb.active; ws.title = "Продажи"
ws.append(["Дата", "Товар", "Кол-во", "Цена, ₽", "Сумма, ₽"])
data = [(dt.date(2026, 1, 15), "Бумага", 10, 350.5), (dt.date(2026, 2, 3), "Ручки", 120, 25.0),
        (dt.date(2026, 2, 20), "Папки", 40, 89.9)]
for i, (d, name, qty, price) in enumerate(data, start=2):
    ws.append([d, name, qty, price, f"=C{i}*D{i}"])
last = ws.max_row
ws.append(["Итого", None, f"=SUM(C2:C{last})", None, f"=SUM(E2:E{last})"])
for c in ws[1] + ws[ws.max_row]: c.font = Font(bold=True)
for c in ws["A"][1:last]: c.number_format = "DD.MM.YYYY"
for col in "DE":
    for c in ws[col][1:]: c.number_format = "#,##0.00"
ws.freeze_panes = "A2"; ws.auto_filter.ref = f"A1:E{last}"
for col, w in zip("ABCDE", (12, 18, 9, 12, 14)): ws.column_dimensions[col].width = w
s = wb.create_sheet("Свод"); s["A1"] = "Всего, ₽"; s["B1"] = f"=Продажи!E{ws.max_row}"
wb.save("report.xlsx")
```
Пересчёт формул без Excel (пакет formulas) — сохрани как `recalc.py`:
```python
import sys, formulas
sol = formulas.ExcelModel().loads(sys.argv[1]).finish().calculate()
want = {a.upper() for a in sys.argv[2:]}
for ref, cell in sol.items():
    short = ref.split("]", 1)[1].replace("'", "").upper()
    if short in want: print(short, "=", cell.value[0][0])
```
```bash
uv run -q --with formulas --with openpyxl python recalc.py report.xlsx 'Продажи!E5' 'Свод!B1' 2>/dev/null
soffice --headless --convert-to xlsx --outdir recalc report.xlsx   # пересчитанная копия ляжет в recalc/; читай её с data_only=True
```
Чтение выгрузки 1С: объединённые ячейки, числа текстом вида `1 234 567,89`. Сохрани как `read_1c.py`, второй аргумент — номер строки шапки:
```python
import re, sys
from openpyxl import load_workbook
def to_number(v):
    if v is None or isinstance(v, (int, float)): return v
    s = re.sub(r"[\s  ]", "", str(v)).replace(",", ".")
    try: return float(s)
    except ValueError: return v
ws = load_workbook(sys.argv[1]).active
for rng in list(ws.merged_cells.ranges):
    top = ws.cell(rng.min_row, rng.min_col).value
    ws.unmerge_cells(str(rng))
    for row in ws.iter_rows(min_row=rng.min_row, max_row=rng.max_row, min_col=rng.min_col, max_col=rng.max_col):
        for c in row: c.value = top
rows = [[r[0]] + [to_number(v) for v in r[1:]] for r in ws.iter_rows(min_row=int(sys.argv[2]) + 1, values_only=True)]
body = [r for r in rows if r[0] != "Итого"]
total = next(r for r in rows if r[0] == "Итого")
calc = sum(r[1] or 0 for r in body)
print("сумма строк:", calc, "| итог 1С:", total[1], "| совпало:", abs(calc - total[1]) < 0.005)
```
```bash
python3 read_1c.py osv.xlsx 4
```

## Частые ошибки
- Вписаны готовые числа вместо формул. Заказчик правит строку, а итог не меняется.
- `load_workbook(..., data_only=True)` у файла, созданного openpyxl, даёт `None` вместо итогов: значения формул считает только Excel или пересчёт выше.
- Сохранение файла, открытого с `data_only=True`, навсегда заменяет формулы числами.
- Код счёта или ИНН превращён в число: `60` стал `60.0`, ведущие нули пропали. Числа приводи только в денежных колонках.
- Пробел-разделитель в выгрузке 1С неразрывный (` `). Обычный `replace(" ", "")` его не убирает.
- Дата записана строкой `"15.01.2026"` — сортировка и фильтр по датам ломаются.
- Ссылка на лист с пробелом или дефисом без кавычек. Нужно так: `='Мой лист'!B1`.
- Формулы сохранены без значений: в превью и на телефоне ячейки пустые. Если файл будут смотреть не в Excel, пересчитай его (`soffice --headless --convert-to xlsx`) или продублируй итоги значениями на отдельном листе.

## След для Проверяющего
В папку результатов задачи: итоговый `.xlsx`, скрипт генерации, вывод пересчёта (адрес ячейки и значение) и строку сверки «сумма строк / итог / совпало». При разборе 1С приложи исходную выгрузку без изменений.
