#!/usr/bin/env bash
set -euo pipefail

# Exemplo de uso:
#   ./deploy/rsync-deploy.sh <SSH_USER> <SSH_HOST> <REMOTE_PATH>
# Onde REMOTE_PATH é a pasta onde o conteúdo do "dist" deve ficar (ex.: /var/www/solonline-front/dist)

SSH_USER=${1:-"root"}
SSH_HOST=${2:-"your.server.ip"}
REMOTE_PATH=${3:-"/var/www/solonline-front/dist"}

if [ ! -d "dist" ]; then
  echo "Pasta dist/ não encontrada. Gere o build antes: npm run build" >&2
  exit 1
fi

echo "Criando pasta no servidor (se não existir): $REMOTE_PATH"
ssh "${SSH_USER}@${SSH_HOST}" "mkdir -p '${REMOTE_PATH}'"

echo "Sincronizando arquivos para ${SSH_USER}@${SSH_HOST}:${REMOTE_PATH} ..."
rsync -avz --delete dist/ "${SSH_USER}@${SSH_HOST}:${REMOTE_PATH}/"

echo "Concluído."
