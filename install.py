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
import subprocess
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


WIN = os.name == "nt"
BOOT = ("import os,sys;r=sys.argv.pop(1);p=os.path.join(r,'py','cp'+str(sys.version_info[0])+str(sys.version_info[1]));"
        "os.path.isdir(os.path.join(r,'py')) and not os.path.isdir(p) and sys.exit('Чекан: нужен Python 3.9-3.14');"
        "sys.path.insert(0,p if os.path.isdir(p) else r);from chekan.__main__ import main;sys.exit(main())")
SHIM_CMD = '@"{python}" -X utf8 -c "{boot}" "{root}" %*\r\n'
KEEP_BACKUPS = 5


def shim_files() -> list[Path]:
    return [p.with_name(p.name + ".cmd") for p in (shim_path(), short_path())] if WIN else [shim_path(), short_path()]


def shim_body() -> str:
    if WIN:
        return SHIM_CMD.format(python=sys.executable, boot=BOOT, root=ROOT)
    return SHIM.format(root=ROOT)


def add_to_user_path(folder: Path) -> bool:
    import winreg

    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment", 0, winreg.KEY_READ | winreg.KEY_WRITE) as key:
        try:
            value, kind = winreg.QueryValueEx(key, "Path")
        except FileNotFoundError:
            value, kind = "", winreg.REG_EXPAND_SZ
        parts = [x for x in value.split(";") if x]
        if any(os.path.normcase(os.path.expandvars(x)).rstrip("\\") == os.path.normcase(str(folder)) for x in parts):
            return False
        winreg.SetValueEx(key, "Path", 0, kind, ";".join(parts + [str(folder)]))
    try:
        import ctypes

        ctypes.windll.user32.SendMessageTimeoutW(0xFFFF, 0x1A, 0, "Environment", 2, 5000, None)
    except Exception:
        pass
    return True


def add_to_shell_profile(folder: Path) -> Path | None:
    shell = os.path.basename(os.environ.get("SHELL", ""))
    if shell == "zsh":
        rc = Path.home() / ".zshrc"
    elif shell == "bash":
        rc = Path.home() / (".bash_profile" if sys.platform == "darwin" else ".bashrc")
    else:
        rc = Path.home() / ".profile"
    line = f'export PATH="{folder}:$PATH"  # chekan'
    try:
        if line in rc.read_text(encoding="utf-8"):
            return None
    except FileNotFoundError:
        pass
    with open(rc, "a", encoding="utf-8") as fh:
        fh.write(f"\n{line}\n")
    return rc


def save_progress(dry: bool) -> list[str]:
    """Копия настроек, своих ролей и уроков перед каждой установкой и обновлением."""
    src = config_dir()
    if not src.is_dir():
        return []
    lessons = sorted(p.stem for p in (src / "lessons").glob("*.json")) if (src / "lessons").is_dir() else []
    own = []
    try:
        import json

        own = [r.get("title") or r.get("slug") for r in json.loads((src / "roles.json").read_text(encoding="utf-8")).get("role") or []]
    except (OSError, ValueError, AttributeError):
        pass
    logs = [f"→ ваш прогресс в {src} не трогаю: уроки ролей — {len(lessons)}, свои роли — {len(own)}"]
    dest_root = src.parent / "chekan-backups"
    stamp = f"chekan-{datetime.now():%Y%m%d-%H%M%S}"
    dest, n = dest_root / stamp, 1
    while dest.exists():
        n += 1
        dest = dest_root / f"{stamp}-{n}"
    if dry:
        return logs + [f"    перед установкой будет копия в {dest_root}"]
    shutil.copytree(src, dest, ignore=shutil.ignore_patterns("*.log", "*.pid", "*.lock", "__pycache__"))
    old = sorted(p for p in dest_root.iterdir() if p.is_dir() and p.name.startswith("chekan-"))
    for stale in old[:-KEEP_BACKUPS]:
        shutil.rmtree(stale, ignore_errors=True)
    return logs + [f"    копия: {dest}"]


def backup(path: Path) -> Path:
    dest = path.with_name(f"{path.name}.bak-{datetime.now():%Y%m%d-%H%M%S}")
    shutil.copy2(path, dest)
    return dest


def check_python() -> list[str]:
    if (ROOT / "py").is_dir() and PKG == ROOT:
        built = ", ".join(sorted(p.name[2] + "." + p.name[3:] for p in (ROOT / "py").glob("cp*")))
        return [f"для Python {sys.version_info.major}.{sys.version_info.minor} сборки нет, есть: {built}"]
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


def choose_agents(flag: str | None) -> set[str] | None:
    """Куда ставить: флаг `--agents`, иначе вопрос в терминале, иначе во все найденные."""
    sys.path.insert(0, str(PKG))
    from chekan import agents

    if flag is not None:
        return agents.parse_only(flag)
    found = [a for a in agents.registry() if a.present and a.key != "shared"]
    if not found or not sys.stdin.isatty():
        return None
    print("Нашёл агентов:")
    for n, a in enumerate(found, 1):
        print(f"  {n}. {a.name}")
    while True:
        try:
            answer = input("Куда поставить Чекан? Номера через запятую, Enter — во все: ").strip()
        except EOFError:
            raise ValueError("установка отменена")
        if not answer:
            return None
        nums = [x for x in answer.replace(" ", ",").split(",") if x]
        if all(x.isdigit() and 1 <= int(x) <= len(found) for x in nums):
            return {found[int(x) - 1].key for x in nums}
        print(f"  Не понял. Номера от 1 до {len(found)}, например: 1,3")


def claude_plugin(dry: bool) -> None:
    claude = shutil.which("claude")
    steps = [["plugin", "marketplace", "add", str(ROOT)], ["plugin", "install", "chekan@codoceh", "--scope", "user", "-y"]]
    if dry or not claude:
        if not dry:
            print("    команды `claude` нет в PATH — поставьте вручную:")
        for st in steps:
            print("      claude " + " ".join(st))
        return
    for st in steps:
        res = subprocess.run([claude, *st], capture_output=True, text=True, timeout=300)
        tail = (res.stdout + res.stderr).strip().splitlines()[-1:] or [""]
        print(f"    claude {' '.join(st[:2])}: {'готово' if res.returncode == 0 else 'ошибка'} {tail[0][:160]}")
        if res.returncode != 0:
            print("      вручную: claude " + " ".join(st))
            return
    print("    хуки включатся в следующей сессии Claude Code")


def install(dry: bool, only: set[str] | None = None) -> int:
    problems = check_python()
    if problems:
        for p in problems:
            print(f"✗ {p}")
        return 1

    print(f"Пакет: {ROOT}")
    print("Режим: проверка, без записи" if dry else "Режим: установка")
    print()

    mig_logs = migrate_config(dry) + save_progress(dry)
    for l in mig_logs:
        print(l)
    if mig_logs:
        print()

    body = shim_body()
    print(f"→ команды `chekan` и `{SHORT_NAME}` в {bin_dir()}")
    print("    путь к пакету зашит в сам шим")
    print(f"    `{SHORT_NAME}` — то же самое, короче на два знака; без аргументов")
    print("      любая из двух открывает разговорный режим")
    if not dry:
        bin_dir().mkdir(parents=True, exist_ok=True)
        for shim in shim_files():
            if shim.exists() and shim.read_bytes() == body.encode("utf-8"):
                continue
            if shim.exists():
                print(f"    копия старой: {backup(shim)}")
            with open(shim, "w", encoding="utf-8", newline="") as fh:
                fh.write(body)
            shim.chmod(0o755)
        print("    записано")
        if WIN and add_to_user_path(bin_dir()):
            print(f"    {bin_dir()} добавлен в PATH: команда заработает в новом окне терминала")

    if only is None or "claude" in only:
        print()
        print("→ плагин Claude Code (скилл + хуки)")
        claude_plugin(dry)
    print()
    print("→ раскладка по агентам (скиллы, плагины и указатели)")
    sys.path.insert(0, str(PKG))
    try:
        from chekan import agents

        agents.apply(ROOT, dry=dry, remove=False, only=only)
    except Exception as exc:
        print(f"    раскладка не удалась ({exc}) — вручную: python3 -m chekan agents --apply")


    if not WIN and str(bin_dir()) not in os.environ.get("PATH", "").split(os.pathsep):
        print()
        rc = None if dry else add_to_shell_profile(bin_dir())
        if dry:
            print(f"→ {bin_dir()} нет в PATH: будет добавлен в профиль оболочки")
        elif rc:
            print(f"→ {bin_dir()} добавлен в PATH через {rc}: команда заработает в новом окне терминала")

    print()
    print("Проверить установку: `chekan doctor`" if not dry else "Ничего не записано.")
    return 0


def uninstall(dry: bool) -> int:
    print("Снятие Чекана")
    print()
    all_shims = [*shim_files(), *(bin_dir() / s for s in OLD_SHIMS)]
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

    stale_patterns = ["chekan.bak-*", f"{SHORT_NAME}.bak-*", "chekan.cmd.bak-*", f"{SHORT_NAME}.cmd.bak-*", "ceh.bak-*", "ц.bak-*"]
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
    ap.add_argument("--agents", default=None,
                    help="куда ставить: claude,codex,cursor,antigravity,opencode,grok (без флага — спросит)")
    ap.add_argument("--service", action="store_true",
                    help="поставить фоновый сервис Телеграма: бот отвечает всегда, "
                         "а не пока запущена панель")
    parsed = ap.parse_args(args)
    for problem in check_python():
        print(f"✗ {problem}")
        return 1
    if parsed.uninstall:
        code = uninstall(parsed.check)
    else:
        try:
            only = choose_agents(parsed.agents)
        except ValueError as exc:
            print(f"✗ {exc}")
            return 2
        code = install(parsed.check, only)
    if code == 0 and want_service and not parsed.uninstall and not parsed.check:
        from chekan import service

        print()
        print("→ фоновый сервис Телеграма")
        print("    " + service.install())
        print("    Проверка: `chekan service status`; лог: ~/.config/chekan/service.log")
    return code


if __name__ == "__main__":
    sys.exit(main())
