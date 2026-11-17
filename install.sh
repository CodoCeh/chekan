#!/bin/sh
# Чекан: установка и обновление одной командой на macOS и Linux.
#   curl -fsSL https://raw.githubusercontent.com/CodoCeh/chekan/main/install.sh | sh
#   curl -fsSL .../install.sh | sh -s -- --agents codex,cursor
set -eu

REPO="${CHEKAN_REPO:-https://github.com/CodoCeh/chekan}"
BRANCH="${CHEKAN_BRANCH:-main}"
DEST="${CHEKAN_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/chekan}"

say() { printf '%s\n' "$*"; }
die() { say "✗ $*" >&2; exit 1; }

find_python() {
    for p in python3 python3.14 python3.13 python3.12 python3.11 python3.10 python3.9 python; do
        if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' 2>/dev/null; then
            command -v "$p"
            return 0
        fi
    done
    return 1
}

PY="$(find_python)" || {
    case "$(uname -s)" in
        Darwin) die "нужен Python 3.9 или новее. Поставьте: xcode-select --install (или brew install python), затем повторите команду." ;;
        *) die "нужен Python 3.9 или новее. Поставьте: sudo apt install python3 (или dnf install python3), затем повторите команду." ;;
    esac
}

fetch() {
    if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
    elif command -v wget >/dev/null 2>&1; then wget -qO "$2" "$1"
    else die "нужен curl или wget"
    fi
}

mkdir -p "$(dirname "$DEST")"
if [ -d "$DEST/.git" ] && command -v git >/dev/null 2>&1; then
    say "→ обновляю Чекан в $DEST"
    git -C "$DEST" pull --ff-only --quiet || die "не удалось обновить $DEST: git pull --ff-only"
elif command -v git >/dev/null 2>&1 && [ ! -e "$DEST" ]; then
    say "→ скачиваю Чекан в $DEST"
    git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$DEST" || die "не удалось скачать $REPO"
else
    say "→ скачиваю Чекан архивом в $DEST"
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    case "$REPO" in
        http*) fetch "$REPO/archive/refs/heads/$BRANCH.tar.gz" "$TMP/chekan.tgz" ;;
        *) tar -czf "$TMP/chekan.tgz" -C "$(dirname "$REPO")" "$(basename "$REPO")" ;;
    esac
    mkdir "$TMP/x"
    tar -xzf "$TMP/chekan.tgz" -C "$TMP/x"
    SRC="$(find "$TMP/x" -mindepth 1 -maxdepth 1 -type d | head -1)"
    [ -f "$SRC/install.py" ] || die "в архиве нет install.py"
    if [ -e "$DEST" ]; then
        rm -rf "$DEST.old"
        mv "$DEST" "$DEST.old"
    fi
    mv "$SRC" "$DEST"
    rm -rf "$DEST.old"
fi

if [ -t 0 ]; then
    exec "$PY" "$DEST/install.py" "$@"
elif [ -r /dev/tty ] && (: </dev/tty) 2>/dev/null; then
    exec "$PY" "$DEST/install.py" "$@" </dev/tty
else
    exec "$PY" "$DEST/install.py" "$@"
fi
