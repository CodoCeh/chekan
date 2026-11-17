# Бэктест стратегии на pandas

## Что это и когда брать

Бэктест (проверка стратегии на истории) прогоняет правила входа и выхода по прошлым свечам и считает итог сделок. Бери, чтобы честно оценить идею до бумажной торговли: есть ли перевес после комиссий на новых данных. Данные бери по учебникам `moex` и `crypto-data`.

Не выдавай бэктест за доказательство будущей прибыли. Роль делает только анализ и бумажную (виртуальную) торговлю. Реальные сделки, ордера и переводы денег делает только человек сам.

## Установка и проверка

```bash
uv run -q --with pandas python -c "import pandas; print('pandas', pandas.__version__)"
```

`uv run --with` ставит pandas временно и без следа. Если нет `uv`, спроси пользователя и ставь только после его «да».

## Порядок работы

1. Запиши правила и сетку параметров до запуска.
2. Сдвигай сигнал: решение по закрытию свечи `i` исполняй по открытию свечи `i+1` (`shift(1)`).
3. Закладывай комиссию и проскальзывание (разницу между желаемой и фактической ценой).
4. Считай результат в R: прибыль сделки, делённая на риск до стопа.
5. Смотри PF (profit factor, прибыли / убытки), средний R, максимальную просадку и число сделок.
6. Делай walk-forward (скользящая проверка): подбирай параметры на окне обучения, проверяй на следующем окне. В итог идёт только проверка.

## Готовые команды

Скрипт ждёт CSV со столбцами `open, high, low, close`:

```bash
mkdir -p results && cat > backtest.py <<'EOF'
import sys
import pandas as pd
FEE, SLIP = 0.0005, 0.0005

def trades(df, fast, slow, k=2.0, tp=None, first=1):
    c = df.close
    tr = pd.concat([df.high - df.low, (df.high - c.shift()).abs(), (df.low - c.shift()).abs()], axis=1).max(axis=1)
    atr = tr.rolling(14).mean().shift(1)
    sig = (c.rolling(fast).mean() > c.rolling(slow).mean()).shift(1, fill_value=False)
    out, pos = [], None
    for i in range(1, len(df)):
        o, h, l = df.open.iat[i], df.high.iat[i], df.low.iat[i]
        if pos is None:
            if i >= first and sig.iat[i] and not sig.iat[i - 1] and atr.iat[i] > 0:
                e, risk = o * (1 + SLIP), k * atr.iat[i]
                pos = (e, e - risk, e + tp * risk if tp else None, risk)
            continue
        e, stop, take, risk = pos
        if l <= stop:
            x = min(o, stop) * (1 - SLIP)
        elif take and h >= take:
            x = max(o, take) * (1 - SLIP)
        elif not sig.iat[i]:
            x = o * (1 - SLIP)
        else:
            continue
        out.append((x - e - FEE * (e + x)) / risk)
        pos = None
    return pd.Series(out, dtype=float)

def stats(r):
    if r.empty:
        return "нет сделок"
    eq = r.cumsum()
    pf = r[r > 0].sum() / -r[r < 0].sum() if (r < 0).any() else float("inf")
    return (f"сделок {len(r):3} выигрышей {(r > 0).mean()*100:3.0f}% итог {r.sum():+6.1f}R "
            f"средний {r.mean():+.2f}R PF {pf:4.2f} просадка {(eq - eq.cummax()).min():5.1f}R")

df = pd.read_csv(sys.argv[1])
grid = [(f, s) for f in (10, 20, 30) for s in (50, 100, 200)]
print("Вся история 20/100:         ", stats(trades(df, 20, 100)))
print("Ловушка винрейта, тейк 0.3R:", stats(trades(df, 20, 100, tp=0.3)))
train, test, oos = 1500, 500, []
for s in range(0, len(df) - train - test + 1, test):
    best = max(grid, key=lambda p: trades(df.iloc[s:s + train].reset_index(drop=True), *p).sum())
    oos.append(trades(df.iloc[s + train - 200:s + train + test].reset_index(drop=True), *best, first=200))
    print(f"окно {s:4}: параметры {best}, проверка: {stats(oos[-1])}")
print("Walk-forward, только проверка:", stats(pd.concat(oos, ignore_index=True)))
EOF
uv run -q --with pandas python -I backtest.py results/btc_4h.csv | tee results/backtest.txt
```

На 4-часовых свечах BTC (2025–2026) правило 20/100 дало PF 0,93. С тейком 0,3R выигрышей стало 72%, а PF остался ниже 1. Без сдвига сигнала итог вырос с −1,3R до +1,9R: это заглядывание в будущее. Часовые свечи SBER 2024–2025 в walk-forward: 60 сделок, PF 0,78.

## Частые ошибки

- Нет сдвига сигнала: сделка входит по цене, которую ещё нельзя было знать.
- Ловушка винрейта: близкий тейк и далёкий стоп дают 70–90% выигрышей, но один стоп съедает три–пять тейков. Смотри PF и средний R.
- Нет комиссий и проскальзывания. На частых сделках они превращают плюс в минус.
- Параметры подобраны на всей истории, и тот же отрезок выдают за проверку. Это подгонка.
- Сделки периода разгона индикаторов попадают в итог проверки. Считай их только с `first`.
- Вывод по 20–30 сделкам. Окно с PF 5 — шум.
- Стоп и тейк в одной свече засчитывают как тейк. Считай, что первым сработал стоп.

## След для Проверяющего

В папку результатов задачи положи: исходный CSV (или его URL и даты), `backtest.py`, `results/backtest.txt`, принятые комиссию и проскальзывание, сетку параметров и размеры окон. Отдельной строкой: «только бэктест и бумажная торговля, реальных сделок не было».
