## Что это и когда брать

HTTP API (программный интерфейс сайта) отдаёт и принимает данные запросами, обычно в формате JSON. Запросы шлют из терминала через `curl`, а ответ разбирают через `jq` (утилита для JSON). В коде на Python для этого есть библиотеки `httpx` и `requests`. Бери их, когда нужно проверить или вызвать API: свой сервер, внешний сервис, вебхук.

Когда НЕ брать: проверка вида страницы, кнопок и вёрстки — это учебник `playwright`. Боевые API с платежами и отправкой сообщений без «да» пользователя не вызывай.

## Установка и проверка

```bash
curl --version | head -1 && jq --version
```

`httpx` и `requests` не ставь: `uv run --with httpx python ...` берёт их временно. Если нет `jq`, его ставят пакетом `jq` из системного менеджера пакетов. Ставить что-либо — только после «да» пользователя.

## Порядок работы

1. Прочитай документацию API: адрес, метод (GET читает, POST создаёт), обязательные заголовки, лимиты.
2. Сделай один пробный GET и посмотри код ответа и заголовки.
3. Всегда ставь таймаут (предел ожидания). Без него запрос может висеть вечно.
4. Проверь коды: 2xx — успех, 4xx — ошибка запроса (повтор не поможет), 429 и 5xx — временная ошибка (можно повторить).
5. Повторяй с растущей паузой: 1, 2, 4 секунды. Если сервер прислал `Retry-After`, жди столько.
6. Разбирай ответ через `jq` или `.json()`, а не поиском по тексту.
7. Токены бери из переменной окружения. В команды, логи и отчёты их не пиши.

## Готовые команды

```bash
curl -sS -o /dev/null -w "%{http_code} %{time_total}s\n" https://httpbin.org/get
curl -sS --max-time 10 https://httpbin.org/get -H "Accept: application/json" -H "X-Demo: 1" | jq '.headers["X-Demo"]'
curl -sS --max-time 10 -X POST https://httpbin.org/post -H "Content-Type: application/json" -d '{"name":"test","n":2}' | jq '.json'
curl -sS -G https://httpbin.org/get --data-urlencode "q=привет мир" | jq -r .url
curl -sS --fail-with-body --max-time 10 https://httpbin.org/status/500; echo "rc=$?"
curl -sS --max-time 2 https://httpbin.org/delay/5; echo "rc=$?"
curl -sS --fail --max-time 20 --retry 2 --retry-delay 1 -o /dev/null https://httpbin.org/status/503; echo "rc=$?"
```

`--fail-with-body` даёт код возврата 22 на ответ 4xx/5xx. Без него `curl` считает любой ответ успехом. Код 28 — сработал таймаут. `--retry` повторяет при 429 и 5xx.

GitHub без токена (лимит 60 запросов в час):

```bash
curl -sSI https://api.github.com/repos/python/cpython | grep -i -E "^(HTTP|x-ratelimit-remaining|content-type)"
curl -sS https://api.github.com/repos/python/cpython | jq '{name: .full_name, stars: .stargazers_count}'
curl -sS "https://api.github.com/repos/python/cpython/commits?per_page=3" | jq -r '.[] | .sha[0:7] + " " + (.commit.message | split("\n")[0])'
```

Python с повтором при 429/5xx (`client.py`, запуск `uv run -q --with httpx python client.py`):

```python
import time
import httpx

RETRY = {429, 500, 502, 503, 504}

def get_json(url, tries=4, **kw):
    with httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0),
                      headers={"Accept": "application/json"}) as c:
        for attempt in range(1, tries + 1):
            wait = 2 ** (attempt - 1)
            try:
                r = c.get(url, **kw)
            except httpx.TransportError:
                if attempt == tries:
                    raise
            else:
                if r.status_code not in RETRY or attempt == tries:
                    r.raise_for_status()
                    return r.json()
                after = r.headers.get("Retry-After", "")
                wait = int(after) if after.isdigit() else wait
            time.sleep(wait)

print(get_json("https://httpbin.org/get", params={"q": "test"})["args"])
```

То же на `requests`:

```python
import requests
r = requests.post("https://httpbin.org/post", json={"name": "test"}, timeout=10)
print(r.status_code, r.json()["json"])
```

## Частые ошибки

- Нет таймаута. Скрипт висит, и никто не знает почему.
- `curl` без `--fail` вернул 0 на ответе 500. Скрипт решил, что всё хорошо.
- Повтор на 400 или 401. Ошибка в запросе или ключе, повтор только тратит лимит.
- Повтор без паузы. Сервер отвечает новым 429 и может заблокировать.
- POST повторили после таймаута, и заказ создался дважды. Повторяй только безопасные запросы или используй ключ идемпотентности (метку, по которой сервер узнаёт повтор).
- Токен виден в `curl -v`, в истории терминала или в отчёте. Передавай через переменную и не включай подробный вывод при сдаче.
- Кириллица и пробелы в адресе без кодирования. Используй `--data-urlencode` или `params=`.

## След для Проверяющего

Положи в папку результатов задачи:

- `api-calls.txt` — команды без секретов и коды ответа каждой (`-w "%{http_code}"`).
- `api-response.json` — пример ответа после `jq`, без личных данных.
- Скрипт клиента, если он писался, и вывод его запуска с кодом возврата.
