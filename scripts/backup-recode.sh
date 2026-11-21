#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE="$ROOT/js/recode.js"
BACKUP_DIR="$ROOT/.backups"

if [ ! -f "$SOURCE" ]; then
    printf 'Cannot back up missing file: %s\n' "$SOURCE" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="$BACKUP_DIR/recode-$STAMP.js"
cp "$SOURCE" "$BACKUP"
ln -sfn "$(basename "$BACKUP")" "$BACKUP_DIR/recode.latest.js"
printf '%s\n' "$BACKUP"
