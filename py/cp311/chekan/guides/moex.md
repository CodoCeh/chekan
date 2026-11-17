# Данные Мосбиржи (ISS API)

## Что это и когда брать

ISS (Informational & Statistical Server, информационный сервер биржи) — бесплатный открытый API Мосбиржи по адресу iss.moex.com. Он отдаёт свечи акций и индексов, котировки облигаций с доходностью, НКД (накопленный купонный доход) и дюрацией (средний срок возврата денег), а также графики купонов. Бери его, когда нужна история цен российских бумаг для анализа или бэктеста.

Не бери для торговли: ISS только читает данные. Для анонимного пользователя текущие котировки идут с задержкой около 15 минут. Для иностранных акций и крипты ISS не подходит.

Правило без исключений: роль делает только анализ и бумажную (виртуальную) торговлю. Реальные сделки, ордера и переводы денег делает только человек сам.

## Установка и проверка

Нужны только `curl` и `python3`. Проверка доступа:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://iss.moex.com/iss/index.json?iss.meta=off"
```

Ответ `200` — API доступен. Если `curl` или `python3` нет, спроси пользователя и ставь только после его «да».

## Порядок работы

1. Найди путь: акции — `engines/stock/markets/shares/boards/TQBR`, ОФЗ — `markets/bonds/boards/TQOB`, индекс — `markets/index/boards/SNDX`.
2. Всегда добавляй `.json` и `iss.meta=off`, лишние таблицы отсекай через `iss.only=` и `<таблица>.columns=`.
3. Листай страницы через `start=`, пока не придёт пустой список. Свечи отдаются по 500 строк, купоны — по 20.
4. Сохрани сырые данные в CSV, считай уже по файлу.
5. Помни: время в ответах — московское (МСК, UTC+3), без пометки пояса.
6. Сверь пару чисел с сайтом биржи, прежде чем делать выводы.

## Готовые команды

Свечи с пагинацией (`interval`: 1, 10, 60 минут, 24 — день):

```bash
mkdir -p results && cat > moex_candles.py <<'EOF'
import json, sys, csv, urllib.request
sec, frm, till, interval, out = sys.argv[1:6]
base = (f"https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/"
        f"securities/{sec}/candles.json?from={frm}&till={till}&interval={interval}&iss.meta=off")
rows, start = [], 0
while True:
    d = json.load(urllib.request.urlopen(f"{base}&start={start}", timeout=30))["candles"]
    if not d["data"]:
        break
    rows += d["data"]; start += len(d["data"])
with open(out, "w", newline="") as f:
    w = csv.writer(f); w.writerow(d["columns"]); w.writerows(rows)
print(sec, len(rows), "свечей,", rows[0][6], "->", rows[-1][6])
EOF
python3 -I moex_candles.py SBER 2025-01-01 2025-12-31 24 results/sber_d1.csv
python3 -I moex_candles.py SBER 2025-10-01 2025-12-31 60 results/sber_h1.csv
```

Итог за год — доходность, волатильность и максимальная просадка:

```bash
uv run -q --with pandas python -I -c "
import pandas as pd
df = pd.read_csv('results/sber_d1.csv')
r = df.close.pct_change().dropna()
dd = (df.close / df.close.cummax() - 1).min()
print('доходность %.1f%%, волатильность %.1f%%, просадка %.1f%%' % ((df.close.iloc[-1]/df.close.iloc[0]-1)*100, r.std()*252**.5*100, dd*100))"
```

Индекс IMOEX и купоны ОФЗ (`limit=100` снимает страницы по 20):

```bash
curl -s "https://iss.moex.com/iss/engines/stock/markets/index/boards/SNDX/securities/IMOEX/candles.json?from=2025-01-01&till=2025-12-31&interval=24&iss.meta=off" | python3 -c "import json,sys;d=json.load(sys.stdin)['candles']['data'];print(len(d),d[0][1],d[-1][1])"
curl -s "https://iss.moex.com/iss/statistics/engines/stock/markets/bonds/bondization/SU26207RMFS9.json?iss.meta=off&iss.only=coupons&limit=100" | python3 -c "import json,sys;d=json.load(sys.stdin)['coupons']['data'];print(len(d),'купонов, последний',d[-1][3])"
```

ОФЗ-ПД: цена в процентах от номинала, доходность, НКД, дюрация в годах:

```bash
cat > moex_ofz.py <<'EOF'
import json, urllib.request
u = ("https://iss.moex.com/iss/engines/stock/markets/bonds/boards/TQOB/securities.json"
     "?iss.meta=off&iss.only=securities,marketdata_yields"
     "&securities.columns=SECID,SHORTNAME,MATDATE,FACEUNIT,ACCRUEDINT"
     "&marketdata_yields.columns=SECID,PRICE,EFFECTIVEYIELD,DURATION")
d = json.load(urllib.request.urlopen(u, timeout=30))
y = {r[0]: r for r in d["marketdata_yields"]["data"]}
rows = [s + y[s[0]][1:] for s in d["securities"]["data"]
        if s[0].startswith("SU26") and s[0] in y and y[s[0]][2]]
for sec, name, mat, cur, nkd, price, ytm, dur in sorted(rows, key=lambda r: r[2])[:8]:
    print(f"{name:12} {mat} цена {price:7.3f}% доходн {ytm:6.2f}% НКД {nkd:6.2f} {cur} дюрация {dur/365:4.2f} г")
EOF
python3 -I moex_ofz.py | tee results/ofz.txt
```

## Частые ошибки

- Берут только первую страницу: 500 часовых свечей вместо 1350 за квартал. Листай `start=` до пустого ответа.
- Забывают `iss.meta=off` и тонут в метаданных. Без `.json` приходит XML.
- Путают пояс: время ISS — МСК, а не UTC. При склейке с криптой переводи явно.
- `DURATION` в ответе — в днях, не в годах. `FACEUNIT` `SUR` означает рубль.
- Считают дивиденды из ISS: путь `securities/<бумага>/dividends.json` сейчас возвращает только описание бумаги, без таблицы `dividends`. Нет таблицы — нет данных, не придумывай. Бери дивиденды из отчётности эмитента и укажи источник.
- Принимают ответ 200 за успех: часть путей отдаёт HTML-страницу с кодом 200. Проверяй, что пришёл JSON с нужной таблицей.
- Последняя дневная свеча в торговый день ещё не закрыта. Отбрасывай её в расчётах.

## След для Проверяющего

В папку результатов задачи положи: CSV со свечами, вывод скриптов (`results/ofz.txt` и итог расчёта), точные URL запросов с датами и время запуска по МСК. Отдельной строкой укажи: «только анализ, сделок не было».
