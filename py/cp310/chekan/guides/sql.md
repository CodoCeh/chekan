## Что это и когда брать

SQL (язык запросов к базам данных) достаёт, считает и меняет данные в таблицах. SQLite (база в одном файле) работает через утилиту `sqlite3` и встроенный модуль Python `sqlite3`. PostgreSQL (серверная база) работает через `psql`. Бери SQL, когда данные лежат в базе: отчёт, сверка, поиск медленного запроса, миграция (изменение структуры таблиц).

Когда НЕ брать: данные в одной таблице Excel или CSV на сотню строк — хватит учебника `xlsx`. Боевую базу без бэкапа и «да» пользователя не меняй.

## Установка и проверка

```bash
sqlite3 --version
```

Если нет, `sqlite3` ставят пакетом `sqlite3` или `sqlite`. Ставить что-либо — только после «да» пользователя.

## Порядок работы

1. Посмотри структуру: `.tables`, `.schema <таблица>`. Не угадывай имена колонок.
2. Пиши выборку с `LIMIT`, пока не уверен в результате.
3. Медленный запрос разбирай через `EXPLAIN QUERY PLAN`. `SCAN` — чтение всей таблицы, `SEARCH ... USING INDEX` — поиск по индексу (оглавлению таблицы).
4. Перед любым изменением сделай бэкап и проверь его: `PRAGMA integrity_check` и число строк.
5. Меняй данные внутри транзакции (группы команд «всё или ничего»): `BEGIN; ... COMMIT;`.
6. После миграции сверь результат запросом: сколько строк изменилось, что стало.
7. В коде подставляй значения только параметрами (`?` или `:имя`). Склейка строк открывает SQL-инъекцию (подмену запроса через ввод пользователя).

## Готовые команды

Выборки, JOIN (соединение таблиц), GROUP BY (группировка):

```bash
sqlite3 -header -column shop.db "SELECT name, city FROM customers WHERE city = 'Москва' ORDER BY name;"
sqlite3 -header -column shop.db "SELECT c.name, COUNT(o.id) AS orders, ROUND(SUM(o.amount),2) AS total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING total > 0 ORDER BY total DESC;"
sqlite3 shop.db ".schema orders"
```

Индекс и план запроса:

```bash
sqlite3 shop.db "EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 2 AND created >= '2026-06-01';"
sqlite3 shop.db "CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders(customer_id, created);"
```

После индекса план меняется с `SCAN orders` на `SEARCH orders USING INDEX`.

Миграция с бэкапом. `-bail` останавливает файл на первой ошибке, и незавершённая транзакция откатывается:

```bash
sqlite3 shop.db ".backup shop.backup-before-migration.db"
sqlite3 shop.backup-before-migration.db "PRAGMA integrity_check; SELECT COUNT(*) FROM orders;"
sqlite3 -bail shop.db <<'EOF'
BEGIN;
ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
UPDATE orders SET status = 'paid' WHERE amount > 0;
COMMIT;
EOF
sqlite3 shop.db ".restore shop.backup-before-migration.db"
sqlite3 shop.db "PRAGMA integrity_check; PRAGMA foreign_key_check;"
sqlite3 shop.db ".mode csv" ".headers on" ".once orders.csv" "SELECT id, customer_id, amount FROM orders LIMIT 5;"
```

`.restore` возвращает базу из бэкапа. Последняя команда выгружает выборку в CSV.

Python: параметры против инъекции и транзакция через `with`:

```python
import sqlite3
con = sqlite3.connect("shop.db")
evil = "Анна' OR '1'='1"
bad = con.execute(f"SELECT COUNT(*) FROM customers WHERE name = '{evil}'").fetchone()[0]
good = con.execute("SELECT COUNT(*) FROM customers WHERE name = ?", (evil,)).fetchone()[0]
print("f-string:", bad, "| param:", good)
try:
    with con:
        con.execute("INSERT INTO customers(name, city) VALUES (?, ?)", ("Дина", "Омск"))
        con.execute("INSERT INTO customers(name) VALUES (NULL)")
except sqlite3.IntegrityError as e:
    print("rolled back:", e)
con.close()
```

Склейка находит все строки (`3`), параметр — ни одной (`0`). Ошибка во второй вставке откатывает и первую.

PostgreSQL (не проверено: нет psql на машине автора):

```bash
psql "$DATABASE_URL" -c "\dt"
psql "$DATABASE_URL" -c "EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 2;"
pg_dump "$DATABASE_URL" -Fc -f backup.dump
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f migration.sql
```

## Частые ошибки

- `UPDATE` или `DELETE` без `WHERE` меняет всю таблицу. Сначала выполни тот же `WHERE` через `SELECT COUNT(*)`.
- Миграция без бэкапа или с непроверенным бэкапом. Откатиться не к чему.
- Значения в запрос вставлены через f-строку или `+`. Это SQL-инъекция.
- В SQLite внешние ключи выключены по умолчанию. Включай `PRAGMA foreign_keys=ON` в каждом соединении, иначе ссылки на несуществующие записи проходят.
- `COUNT(o.id)` и `COUNT(*)` в `LEFT JOIN` дают разное. `COUNT(*)` считает клиента без заказов за одну строку.
- Индекс создан, но план не проверен. Индекс на `(created, customer_id)` не помогает поиску только по `customer_id`.

## След для Проверяющего

Положи в папку результатов задачи:

- `migration.sql` — текст изменений целиком.
- `sql-run.txt` — вывод запусков: число строк до и после, `PRAGMA integrity_check`.
- `explain-before.txt` и `explain-after.txt` — планы запроса, если ускорял запрос.
- Имя файла бэкапа и команду восстановления. Саму базу с личными данными не прикладывай.
