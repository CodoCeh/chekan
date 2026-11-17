## Что это и когда брать
matplotlib (библиотека Python для графиков) рисует столбцы, линии и доли и сохраняет их в PNG. Бери её, когда цифр больше пяти и важна динамика или сравнение. Не бери, когда цифр три-четыре: хватит строки текста или маленькой таблицы. Для живого дашборда на сайте нужен другой инструмент.

## Установка и проверка
```bash
python3 -c "import matplotlib; print(matplotlib.__version__)"
```
Если нет — без установки: `uv run --with matplotlib python chart.py`. Ставить что-либо в систему — только после «да» пользователя.

## Порядок работы
1. Сформулируй одну мысль графика. Она же — заголовок: «Выручка выросла вдвое», а не «Выручка».
2. Выбери форму. Сравнение категорий — столбцы. Динамика во времени — линия. Доли — столбцы с процентами; круговую бери, только если долей две-три.
3. Подпиши оси с единицами: «Выручка, млн ₽», «Доля, %».
4. Столбцы всегда от нуля. Линию можно начать не с нуля, но тогда шкала должна быть видна.
5. Задай шрифт с кириллицей и знаком ₽. Запускай с `-W error::UserWarning`: пропавший символ остановит скрипт.
6. Сохрани PNG с dpi 150–200 и открой картинку. Сверь заголовок с данными.

## Готовые команды
Столбцы с подписями значений и запятой в дробях. Сохрани как `bar_chart.py`:
```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
plt.rcParams["font.family"] = "DejaVu Sans"
months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"]
revenue = [1.2, 1.5, 1.4, 1.9, 2.3, 2.1]
comma = lambda v: f"{v:.1f}".replace(".", ",")
fig, ax = plt.subplots(figsize=(8, 4.5))
bars = ax.bar(months, revenue, color="#3B6EA5")
ax.bar_label(bars, labels=[comma(v) for v in revenue], padding=3)
ax.set_ylim(0, max(revenue) * 1.15)
ax.set_ylabel("Выручка, млн ₽")
ax.set_title("Выручка выросла почти вдвое за полгода")
ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: comma(v)))
ax.spines[["top", "right"]].set_visible(False)
fig.tight_layout()
fig.savefig("revenue.png", dpi=170)
```
Линия с пометкой события. Сохрани как `line_chart.py`:
```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams["font.family"] = "DejaVu Sans"
weeks = list(range(1, 9))
share = [12.0, 12.4, 13.1, 12.8, 14.2, 15.0, 15.3, 16.1]
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(weeks, share, marker="o", color="#3B6EA5")
ax.set_xlabel("Неделя")
ax.set_ylabel("Доля повторных заказов, %")
ax.set_title("Повторные заказы растут четыре недели подряд")
ax.annotate("запуск рассылки", xy=(5, 14.2), xytext=(2.2, 15.4), arrowprops={"arrowstyle": "->"})
ax.grid(axis="y", alpha=0.3)
fig.tight_layout()
fig.savefig("share.png", dpi=170)
```
Запуск со строгой проверкой глифов и проверка файла:
```bash
python3 -W error::UserWarning bar_chart.py && python3 -W error::UserWarning line_chart.py
magick identify -format "%f %wx%h %b\n" revenue.png share.png
python3 -c "import matplotlib.font_manager as f; print(sorted({x.name for x in f.fontManager.ttflist if 'DejaVu' in x.name}))"
```

## Частые ошибки
- Шрифт без ₽ или кириллицы: вместо букв квадраты. Arial из macOS ₽ не содержит, DejaVu Sans (идёт с matplotlib) — содержит.
- Столбцы начинаются не с нуля. Разница в 5% выглядит как двукратная.
- Ось без единиц: читатель не знает, тысячи это или миллионы.
- Заголовок не совпадает с данными. Пример: «растёт шесть недель подряд», а на четвёртой неделе был спад. Пересчитай утверждение по цифрам.
- Пять линий на одном графике. Одна мысль — один график, остальное разнеси.
- Точка вместо запятой в русских дробях. Используй форматтер, как в примере.
- Без `matplotlib.use("Agg")` скрипт на сервере падает из-за отсутствия экрана.
- dpi 72: текст размыт в документе и на печати.
- Заголовок или подписи обрезаны краем картинки. Сохраняй с `bbox_inches="tight"` и смотри готовый PNG глазами перед словом «сверил».

## След для Проверяющего
В папку результатов задачи: PNG графиков, скрипт, таблицу исходных данных (CSV или xlsx) и одну строку на график: мысль из заголовка и цифры, которые её подтверждают.
