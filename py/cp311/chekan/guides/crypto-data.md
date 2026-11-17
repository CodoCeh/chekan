# Публичные данные криптобирж

## Что это и когда брать

Биржи отдают рыночные данные без ключа через публичный REST (запрос по обычному адресу). Это свечи (klines, цены открытия, максимума, минимума и закрытия за период), фандинг (funding rate, плата между покупателями и продавцами бессрочных фьючерсов) и открытый интерес (OI, сколько контрактов открыто). Источники — Binance futures (`fapi.binance.com`), Bybit v5 (`api.bybit.com/v5/market`) и библиотека ccxt, которая говорит с сотней бирж одним языком. Бери, когда нужна история для анализа или бэктеста.

Не бери, если задача требует ключей, ордеров, балансов или переводов. Роль делает только анализ и бумажную (виртуальную) торговлю. Реальные сделки, ордера, переводы и вывод средств делает только человек сам. Ключи API роль не просит и не создаёт.

## Установка и проверка

```bash
uv run -q --with ccxt python -c "import ccxt; print('ccxt', ccxt.__version__)"
```

`uv run --with` ставит ccxt временно и без следа. Если нет самого `uv`, спроси пользователя и ставь только после его «да». Для REST хватит `curl` и `python3`.

## Порядок работы

1. Проверь доступ одной свечой. Ответ 451 или 403 значит, что биржа закрыта для региона. Переходи на другую биржу (Bybit, OKX) и запиши это в отчёт.
2. Качай историю страницами: Binance отдаёт до 1000–1500 свечей, Bybit до 1000. Следующую страницу начинай с конца предыдущей.
3. Отбрасывай незакрытую последнюю свечу.
4. Время бирж — UTC в миллисекундах. Переводи явно.
5. Сохрани CSV, считай по файлу, сверь пару цен с сайтом биржи.

## Готовые команды

Открытый интерес напрямую (у Bybit новые записи идут первыми):

```bash
curl -s -w "\nHTTP %{http_code}\n" "https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1d&limit=2"
curl -s -w "\nHTTP %{http_code}\n" "https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1d&limit=2"
```

REST без библиотек, с честной реакцией на блокировку:

```bash
mkdir -p results && cat > crypto_rest.py <<'EOF'
import json, urllib.request, urllib.error
def get(u):
    try:
        return json.load(urllib.request.urlopen(u, timeout=20))
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, u.split("/")[2], "- регион закрыт или лимит, пробуй другую биржу"); return None
k = get("https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=31")
if k:
    k = k[:-1]
    print("Binance: %d закрытых дн. свечей, close %s -> %s" % (len(k), k[0][4], k[-1][4]))
b = get("https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=200")
if b and b["retCode"] == 0:
    fr = [float(x["fundingRate"]) for x in b["result"]["list"]]
    print("Bybit: %d выплат фандинга, средний %.4f%% за период" % (len(fr), sum(fr) / len(fr) * 100))
EOF
python3 -I crypto_rest.py
```

История свечей через ccxt с пагинацией (`binanceusdm` — фьючерсы Binance, `bybit` — Bybit):

```bash
cat > crypto_ccxt.py <<'EOF'
import sys, csv, ccxt
ex_id, symbol, tf, since, out = sys.argv[1:6]
ex = getattr(ccxt, ex_id)({"enableRateLimit": True})
step = ex.parse_timeframe(tf) * 1000
t, now, rows = ex.parse8601(since + "T00:00:00Z"), ex.milliseconds(), []
while t < now:
    batch = ex.fetch_ohlcv(symbol, tf, since=t, limit=1000)
    if not batch:
        break
    rows += batch; t = batch[-1][0] + step
rows = [r for r in rows if r[0] + step <= now]
with open(out, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["ts", "open", "high", "low", "close", "volume"]); w.writerows(rows)
print(ex_id, symbol, tf, len(rows), "закрытых свечей,", ex.iso8601(rows[0][0]), "->", ex.iso8601(rows[-1][0]))
EOF
uv run -q --with ccxt python -I crypto_ccxt.py binanceusdm BTC/USDT:USDT 4h 2025-01-01 results/btc_4h.csv
```

Фандинг и открытый интерес через ccxt:

```bash
uv run -q --with ccxt python -I -c "
import ccxt
ex = ccxt.bybit({'enableRateLimit': True})
oi = ex.fetch_open_interest_history('BTC/USDT:USDT', '1d', limit=3)
print('OI:', [(x['datetime'], x['openInterestAmount']) for x in oi])
fr = ex.fetch_funding_rate_history('BTC/USDT:USDT', limit=90)
avg = sum(x['fundingRate'] for x in fr) / len(fr)
print('фандинг: %d выплат, средний %.4f%%, ~%.1f%% годовых при 3 выплатах в сутки' % (len(fr), avg*100, avg*3*365*100))"
```

## Частые ошибки

- Считают незакрытую свечу: последняя строка klines ещё меняется. Отрезай её.
- Путают порядок: Bybit отдаёт новые записи первыми, Binance — старые первыми. Сортируй по времени.
- Пишут символ не тем форматом: в REST `BTCUSDT`, в ccxt для бессрочного фьючерса `BTC/USDT:USDT`, для спота `BTC/USDT`.
- Пересчитывают фандинг в годовые как «×3×365» для всех монет. У части монет выплата раз в 4 или 1 час. Смотри интервал по разнице меток времени.
- Молча подменяют биржу после 451/403. Пиши в отчёт, какая биржа не ответила и откуда взяты данные.
- Долбят API без пауз и ловят бан 418/429. В ccxt включай `enableRateLimit`.
- Просят ключ «чтобы было больше данных». Публичных данных хватает, ключи роль не трогает.

## След для Проверяющего

В папку результатов задачи положи: CSV со свечами, вывод команд с кодами ответа, список бирж с пометкой «ответила / 451 / 403», версию ccxt и время запуска в UTC. Отдельной строкой: «только чтение данных, ключей и ордеров не было».
