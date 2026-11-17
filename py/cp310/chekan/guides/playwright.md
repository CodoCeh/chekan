## Что это и когда брать

Playwright (библиотека управления браузером) сам открывает сайт, вводит текст, нажимает кнопки и делает скриншоты — как живой посетитель. Он же ловит ошибки консоли браузера и упавшие запросы. Бери его, когда правка затрагивает сайт или веб-страницу и результат надо увидеть глазами: вёрстку, формы, телефонную ширину.

Когда НЕ брать: задачи без веб-интерфейса. Для проверки одного адреса API хватит `curl` (учебник `http-api`).

## Установка и проверка

```bash
npx --no-install playwright --version
```

Для Python библиотеку не ставь: `uv run --with playwright python ...` берёт её временно. Браузер нужен отдельно. Если на машине есть Google Chrome, запускай с `channel="chrome"` — скачивать ничего не надо. Если Chrome нет, браузер ставит `uv run --with playwright playwright install chromium` (около 150 МБ в кэш; не проверено: на машине автора стоял Chrome, скачивание не понадобилось). Ставить что-либо — только после «да» пользователя.

## Порядок работы

1. Подними сайт локально. Для статической папки хватит `python3 -m http.server <порт> --bind 127.0.0.1 -d <папка>`. Порт выбирай свободный.
2. Опиши сценарий шагами пользователя: открыть, ввести, нажать, дождаться результата.
3. Ищи элементы по смыслу: `#id`, текст, роль. Не по координатам.
4. Жди состояние, а не время: `wait_for_selector`, а не `sleep`.
5. Подпишись на ошибки консоли, `pageerror` и ответы с кодом 400 и выше до `goto`.
6. Прогони на ширине 375 (телефон) и на десктопе. Проверь, нет ли горизонтальной прокрутки.
7. Сделай скриншоты и сам открой их. Скрипт возвращает код 1, если есть ошибки.
8. Погаси свой сервер.

## Готовые команды

Сервер и его остановка:

```bash
python3 -m http.server 56308 --bind 127.0.0.1 -d site >server.log 2>&1 &
echo $! > server.pid
curl -sI http://127.0.0.1:56308/ | head -1
kill $(cat server.pid)
```

Сценарий `check.py`:

```python
import sys
from playwright.sync_api import sync_playwright

url = sys.argv[1]
errors, failed = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": 375, "height": 812})
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("response", lambda r: r.status >= 400 and failed.append(f"{r.status} {r.url}"))
    page.goto(url, wait_until="networkidle")
    page.fill("#name", "Тест")
    page.click("#go")
    page.wait_for_selector("#out:has-text('Привет')", timeout=5000)
    print("out:", page.inner_text("#out"))
    wide = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
    print("horizontal scroll:", wide)
    page.screenshot(path="shot-375.png", full_page=True)
    browser.close()
print("console errors:", errors)
print("failed requests:", failed)
sys.exit(1 if errors or failed else 0)
```

```bash
uv run -q --with playwright python check.py http://127.0.0.1:56308/
npx --no-install playwright screenshot --channel chrome --viewport-size "375,812" http://127.0.0.1:56308/ shot.png
```

Вторая команда — быстрый скриншот без сценария. Без Chrome убери `channel` и `--channel` после установки chromium.

## Частые ошибки

- `time.sleep` вместо ожидания элемента. Тест то проходит, то падает.
- Обработчики консоли подключены после `goto`. Ошибки при загрузке теряются.
- Скриншот сделан, но не просмотрен. Пустая белая страница тоже «скриншот».
- Проверка только на десктопе. На 375 пикселях вылезает горизонтальная прокрутка и наезжают кнопки.
- Картинка или скрипт с ответом 404 не попадает в отчёт, потому что смотрят только консоль. Слушай `response`.
- Сервер забыли погасить. Порт занят, следующий прогон смотрит на старую версию.
- Сценарий гоняют по боевому сайту с отправкой форм. Проверяй на локальной или тестовой копии.

## След для Проверяющего

Положи в папку результатов задачи:

- `check.py` — сам сценарий, чтобы его можно было повторить.
- `playwright-run.txt` — вывод прогона с кодом возврата.
- `shot-375.png` и `shot-1280.png` — скриншоты телефонной и десктопной ширины.
- Список ошибок консоли и сети. Пустой список тоже записывай явно.
