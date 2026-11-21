#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BACKUP_DIR="$ROOT/.backups"
TARGET="$ROOT/js/recode.js"

if [ -n "${1:-}" ]; then
    BACKUP=$1
else
    BACKUP="$BACKUP_DIR/recode.latest.js"
fi

if [ ! -f "$BACKUP" ]; then
    printf 'Cannot restore missing backup: %s\n' "$BACKUP" >&2
    exit 1
fi

mkdir -p "$(dirname "$TARGET")"
cp "$BACKUP" "$TARGET"
printf 'Restored %s\n' "$TARGET"
