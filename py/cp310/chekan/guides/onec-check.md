## Что это и когда брать

Проверка обработки 1С перед сдачей: ловушки, статический анализ (разбор кода без запуска) через BSL Language Server и компиляция настоящей платформой. Бери после любой правки `.epf`, `.erf` или `.bsl`.

Когда НЕ брать: проверка расчёта на данных — это тест на копии базы. Распаковка и сборка — учебник `onec`.

## Установка и проверка

```bash
ls /opt/1cv8
```

Нужны платформа 1С, Java 21 и `bsl-language-server.jar` из релизов `1c-syntax/bsl-language-server`. Ставить что-либо — только после «да» пользователя.

## Порядок работы

1. Компилируй только в тестовой файловой базе: она названа в `chekan-1c.json` и помечена файлом `.chekan-testbase`. Боевую и серверную не трогай.
2. Прогони ловушки. Каждую находку исправь или объясни.
3. Прогони BSL LS. `ParseError` (код не разбирается) блокирует сдачу. `UnusedLocalMethod` — мёртвый код.
4. Скомпилируй платформой. Сборка из XML и HTTP 200 сервиса сборки пропускают даже вызов несуществующей функции.
5. Пустая база ругается на общие модули. Чистый итог даёт база с конфигурацией заказчика.
6. Имена в запросах сверь с выгрузкой конфигурации: платформа их не проверяет.

## Готовые команды

Пустая тестовая база и выгрузка в XML (macOS):

```bash
V8=$(ls -d /opt/1cv8/8.3.*/1cv8.app/Contents/MacOS/1cv8 | tail -1)
IB="$PWD/ib"
"$V8" CREATEINFOBASE "File=$IB" /Out create.log
v8() { log=$1; shift; rm -f "$log"
  "$V8" DESIGNER /F "$IB" /DisableStartupDialogs "$@" /Out "$log" & pid=$!
  for i in $(seq 300); do kill -0 $pid 2>/dev/null || break; sleep 1; done
  kill $pid 2>/dev/null; cat "$log"; }
mkdir -p xml && v8 dump.log /DumpExternalDataProcessorOrReportToFiles "$PWD/xml/sample.xml" "$PWD/sample.epf"
```

Ловушки: `Строка(` от числа, процедуры без вызова, обработчики формы без процедуры:

```bash
grep -rn --include=*.bsl "Строка(" xml
```

```python
import re
from pathlib import Path
bsl = {p: p.read_text(encoding="utf-8-sig") for p in Path("xml").rglob("*.bsl")}
forms = "".join(p.read_text(encoding="utf-8-sig") for p in Path("xml").rglob("Form.xml"))
every, names = "".join(bsl.values()) + forms, set()
for p, t in bsl.items():
    for name, tail in re.findall(r"^\s*(?:Процедура|Функция)\s+(\w+)\s*\([^)]*\)(.*)$", t, re.M):
        names.add(name)
        if "Экспорт" not in tail and len(re.findall(rf"\b{name}\b", every)) == 1:
            print(f"{p}: {name} — не вызывается и не привязан")
for h in re.findall(r"<(?:Event name=\"\w+\"[^>]*|Action)>(\w+)</", forms):
    if h not in names:
        print(f"форма ссылается на {h}, а процедуры нет")
```

```bash
mkdir -p lint && cd lint && java -jar "$BSL_LS_JAR" --analyze --srcDir ../xml --reporter json >/dev/null; cd ..
python3 -c "import json,collections; d=json.load(open('lint/bsl-json.json')); print(collections.Counter(x['code'] for f in d['fileinfos'] for x in f['diagnostics']).most_common(10))"
```

Компиляция. Платформа проверяет внешнюю обработку только как объект расширения. `wrap_ext.py` меняет метаданные, модули копирует байт-в-байт:

```python
import re, shutil, sys, uuid
from pathlib import Path
src, out = Path(sys.argv[1]), Path(sys.argv[2])
root = next(p for p in src.glob("*.xml") if (src / p.stem).is_dir())
t = root.read_text(encoding="utf-8-sig")
kind = "Report" if "<ExternalReport " in t else "DataProcessor"
fix = lambda s: s.replace("External" + kind, kind)
t, u = fix(t), lambda: str(uuid.uuid4())
name = re.search(r"<Name>([^<]+)</Name>", t)[1]
gen = "".join(f'<xr:GeneratedType name="{kind}{c}.{name}" category="{c}"><xr:TypeId>{u()}'
              f'</xr:TypeId><xr:ValueId>{u()}</xr:ValueId></xr:GeneratedType>' for c in ("Object", "Manager"))
t = re.sub(r"<InternalInfo>.*?</InternalInfo>", f"<InternalInfo>{gen}</InternalInfo>", t, count=1, flags=re.S)
t = t.replace("<Properties>", "<Properties><ObjectBelonging>Native</ObjectBelonging>", 1)
d = out / f"{kind}s"
shutil.rmtree(out, ignore_errors=True)
shutil.copytree(src / root.stem, d / name)
for f in (d / name).rglob("*.xml"):
    f.write_text(fix(f.read_text(encoding="utf-8-sig")), encoding="utf-8-sig")
(d / f"{name}.xml").write_text(t, encoding="utf-8-sig")
ids = "9cd510cd-abfc-11d4-9434-004095e12fc7 9fcd25a0-4822-11d4-9414-008048da11f9 e3687481-0a87-462c-a166-9f34594f9bba 9de14907-ec23-4a07-96f0-85521cb6b53b 51f2d5d8-ea4d-4064-8892-82951750031e e68182ea-4237-4383-967f-90c1e3370bc7 fb282519-d103-4dd3-bc12-cb271d631dfc"
co = "".join(f"<xr:ContainedObject><xr:ClassId>{c}</xr:ClassId><xr:ObjectId>{u()}</xr:ObjectId></xr:ContainedObject>" for c in ids.split())
ns = re.search(r"<MetaDataObject ([^>]*)>", t)[1]
(out / "Configuration.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><MetaDataObject {ns}><Configuration uuid="{u()}"><InternalInfo>{co}</InternalInfo><Properties><ObjectBelonging>Adopted</ObjectBelonging><Name>Проверка</Name><NamePrefix/><ConfigurationExtensionCompatibilityMode>Version8_3_27</ConfigurationExtensionCompatibilityMode><ConfigurationExtensionPurpose>Customization</ConfigurationExtensionPurpose><ScriptVariant>Russian</ScriptVariant></Properties><ChildObjects><{kind}>{name}</{kind}></ChildObjects></Configuration></MetaDataObject>', encoding="utf-8-sig")
```

```bash
python3 wrap_ext.py xml ext
v8 load.log /LoadConfigFromFiles "$PWD/ext" -Extension Проверка
v8 check.log /CheckModules -Extension Проверка -ThinClient -Server -ThickClientManagedApplication -ExtendedModulesCheck
```

Пустой `load.log` — загружено. Успех: `Синтаксических ошибок не обнаружено!`. `Version8_3_27` — не выше версии платформы.

Реквизит из запроса есть, если счёт больше нуля. `Ссылка`, `Дата`, `Номер` в выгрузку не пишутся:

```bash
grep -c "<Name>Сумма</Name>" conf/Documents/Заказ.xml
```

## Частые ошибки

- Чистый round-trip или HTTP 200 принимают за компиляцию.
- `Строка(1234567)` даёт `1 234 567` с неразрывным пробелом, и ключи не совпадают. Пиши `Формат(Х, "ЧГ=")`.
- Обработчик не привязан к форме. Кнопка молчит.
- Правка в процедуре, которую никто не вызывает. Код не выполняется.
- `Справочники.НетТакого` и чужой метод общего модуля платформа не ловит.
- BSL LS 1.0 на Java 17 падает с `UnsupportedClassVersionError`. Нужна Java 21.
- Конфигуратор на macOS иногда не завершается сам. Функция `v8` останавливает его.

## След для Проверяющего

В папку результатов задачи:

- `traps.txt` — вывод ловушек и решение по каждой находке.
- `lint/bsl-json.json`, `load.log`, `check.log` без правок.
- Версию платформы и путь к тестовой базе, без логинов и паролей.
- Что не проверено и почему.
