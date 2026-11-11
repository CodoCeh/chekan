#!/usr/bin/env python3
"""Установка Чекана на эту машину.

Ставится одной командой и удаляется одной. Ничего не перезаписывает без копии рядом:
у чужих инструментов установщики затирали CLAUDE.md без бэкапа, уничтожали .claude.json
и удаляли .gitignore — здесь это невозможно.

    python3 install.py            поставить
    python3 install.py --check    что будет сделано, без записи
    python3 install.py --uninstall  снять
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PKG = ROOT / "py" / f"cp{sys.version_info[0]}{sys.version_info[1]}"
PKG = PKG if (ROOT / "py").is_dir() else ROOT
MIN_PYTHON = (3, 9)


def bin_dir() -> Path:
    return Path.home() / ".local" / "bin"


def shim_path() -> Path:
    return bin_dir() / "chekan"


# Короткое имя кириллицей: ни с чем в PATH не сталкивается (латинские `c`, `ts`
# и `z` заняты чужими утилитами), а печатается одной клавишей.
SHORT_NAME = "ч"
OLD_SHIMS = ("ceh", "ц")


def short_path() -> Path:
    return bin_dir() / SHORT_NAME


def config_dir() -> Path:
    return Path(os.environ.get("CHEKAN_CONFIG_DIR", Path.home() / ".config" / "chekan"))


def old_config_dir() -> Path:
    return Path(os.environ.get("OLD_CHEKAN_CONFIG_DIR", Path.home() / ".config" / ("auto" + "ceh")))


# Шим несёт путь к пакету в себе. Глобальный PYTHONPATH не трогаем: он влияет на
# каждый Python на машине, а нам нужна ровно одна команда.
SHIM = """#!/bin/sh
# Чекан — запуск CLI. Сгенерировано install.py, правки перезапишутся.
exec "{root}/bin/chekan" "$@"
"""


def backup(path: Path) -> Path:
    dest = path.with_name(f"{path.name}.bak-{datetime.now():%Y%m%d-%H%M%S}")
    shutil.copy2(path, dest)
    return dest


def check_python() -> list[str]:
    if sys.version_info[:2] < MIN_PYTHON:
        return [
            f"нужен Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]} или новее, "
            f"а этот {sys.version_info.major}.{sys.version_info.minor}"
        ]
    return []


def migrate_config(dry: bool) -> list[str]:
    """Разовый безопасный перенос ~/.config/старый-конфиг/ в ~/.config/chekan/."""
    src = old_config_dir()
    dst = config_dir()
    logs = []
    if not src.is_dir():
        return logs

    logs.append(f"→ перенос настроек: {src} → {dst}")
    if not dry:
        dst.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(dst, 0o700)
        except OSError:
            pass

        for item in src.iterdir():
            target = dst / item.name
            if not target.exists():
                if item.is_dir():
                    shutil.copytree(item, target)
                else:
                    shutil.copy2(item, target)
                # Права 0600 на файлы конфигурации и секретов
                try:
                    if target.is_file():
                        os.chmod(target, 0o600)
                except OSError:
                    pass
                logs.append(f"    скопирован: {item.name}")

        # Создаём копию старого каталога рядом и убираем старый
        bak_dst = src.with_name(f"{src.name}.bak-{datetime.now():%Y%m%d-%H%M%S}")
        try:
            shutil.copytree(src, bak_dst)
            shutil.rmtree(src)
            logs.append(f"    создана копия: {bak_dst}")
        except Exception as exc:
            logs.append(f"    не удалось создать копию {bak_dst}: {exc}")
    else:
        logs.append("    будет скопирован с сохранением прав 0600 и копией рядом")
    return logs


def install(dry: bool) -> int:
    problems = check_python()
    if problems:
        for p in problems:
            print(f"✗ {p}")
        return 1

    print(f"Пакет: {ROOT}")
    print("Режим: проверка, без записи" if dry else "Режим: установка")
    print()

    mig_logs = migrate_config(dry)
    for l in mig_logs:
        print(l)
    if mig_logs:
        print()

    body = SHIM.format(root=ROOT)
    print(f"→ команды `chekan` и `{SHORT_NAME}` в {bin_dir()}")
    print(f"    путь к пакету зашит в сам шим, профиль оболочки не трогаем")
    print(f"    `{SHORT_NAME}` — то же самое, короче на два знака; без аргументов")
    print("      любая из двух открывает разговорный режим")
    if not dry:
        bin_dir().mkdir(parents=True, exist_ok=True)
        for shim in (shim_path(), short_path()):
            if shim.exists():
                print(f"    копия старой: {backup(shim)}")
            shim.write_text(body, encoding="utf-8")
            shim.chmod(0o755)
        print("    записано")

    print()
    print("→ раскладка по агентам (скиллы, плагины и указатели)")
    sys.path.insert(0, str(PKG))
    try:
        from chekan import agents

        agents.apply(ROOT, dry=dry, remove=False)
    except Exception as exc:
        print(f"    раскладка не удалась ({exc}) — вручную: python3 -m chekan agents --apply")

    print()
    print("→ плагин Claude Code (скилл + хуки)")
    print("    из терминала:")
    print(f"      claude plugin marketplace add {ROOT}")
    print("      claude plugin install chekan@codoceh --scope user -y")
    print("    либо в сессии: /plugin marketplace add … и /plugin install …")

    if str(bin_dir()) not in os.environ.get("PATH", ""):
        print()
        print(f"! {bin_dir()} нет в PATH — добавьте, иначе команда `chekan` не найдётся")

    print()
    print("Проверить установку: `chekan doctor`" if not dry else "Ничего не записано.")
    return 0


def uninstall(dry: bool) -> int:
    print("Снятие Чекана")
    print()
    all_shims = [shim_path(), short_path(), *(bin_dir() / s for s in OLD_SHIMS)]
    for shim in all_shims:
        if shim.exists():
            print(f"→ удалить {shim}")
            if not dry:
                shim.unlink()
                print("    удалено")
        else:
            print(f"  {shim} — нет, пропущено")

    print()
    print("→ раскладка по агентам (скиллы и указатели)")
    sys.path.insert(0, str(PKG))
    try:
        from chekan import agents

        agents.apply(ROOT, dry=dry, remove=True)
    except Exception as exc:
        print(f"    снять не удалось ({exc}) — вручную: python3 -m chekan agents --remove --apply")

    stale_patterns = ["chekan.bak-*", f"{SHORT_NAME}.bak-*", "ceh.bak-*", "ц.bak-*"]
    stale = []
    for pat in stale_patterns:
        stale.extend(bin_dir().glob(pat))
    stale = sorted(set(stale))
    if stale:
        print()
        print(f"→ старые копии шима в PATH ({len(stale)})")
        for f in stale:
            print(f"    {f}")
            if not dry:
                f.unlink()
        if not dry:
            print("    удалены")

    print()
    print("Оставлено намеренно (ваши данные, не наши):")
    print("  · каталоги .chekan/ в проектах — история прогонов")
    print("  · сам каталог пакета")
    print("  · настройки в ~/.config/chekan/")
    print()
    print("Плагин Claude Code снимается отдельно:")
    print("  claude plugin uninstall chekan@codoceh")
    print("  или в сессии: /plugin uninstall chekan@codoceh")
    return 0


def main() -> int:
    import sys as _sys

    args = _sys.argv[1:]
    want_service = "--service" in args
    args = [a for a in args if a != "--service"]
    ap = argparse.ArgumentParser(description="Установка Чекана")
    ap.add_argument("--check", action="store_true", help="показать, что будет сделано")
    ap.add_argument("--uninstall", action="store_true", help="снять")
    ap.add_argument("--service", action="store_true",
                    help="поставить фоновый сервис Телеграма: бот отвечает всегда, "
                         "а не пока запущена панель")
    parsed = ap.parse_args(args)
    code = uninstall(parsed.check) if parsed.uninstall else install(parsed.check)
    if code == 0 and want_service and not parsed.uninstall and not parsed.check:
        from chekan import service

        print()
        print("→ фоновый сервис Телеграма")
        print("    " + service.install())
        print("    Проверка: `chekan service status`; лог: ~/.config/chekan/service.log")
    return code


if __name__ == "__main__":
    sys.exit(main())
