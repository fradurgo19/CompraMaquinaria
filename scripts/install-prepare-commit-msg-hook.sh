#!/bin/sh
# Instala el hook prepare-commit-msg que quita "Co-authored-by: Cursor" del mensaje.
# Ejecutar desde la raíz del repo: sh scripts/install-prepare-commit-msg-hook.sh
HOOK_SRC="scripts/prepare-commit-msg-hook.sh"
HOOK_DST=".git/hooks/prepare-commit-msg"
if [ -f "$HOOK_SRC" ]; then
  cp "$HOOK_SRC" "$HOOK_DST"
  chmod +x "$HOOK_DST"
  echo "Hook instalado en $HOOK_DST"
else
  echo "No se encontró $HOOK_SRC"
  exit 1
fi
