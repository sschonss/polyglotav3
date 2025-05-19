#!/bin/bash

# Script para atualizar o servidor com as últimas mudanças
# Uso: bash update-server.sh

echo "=== Iniciando atualização do servidor ==="

# Verifica se estamos em um repositório git
if [ ! -d ".git" ]; then
  echo "ERRO: Este diretório não é um repositório Git."
  exit 1
fi

# Salva o diretório atual
CURRENT_DIR=$(pwd)

echo "--- Obtendo as últimas alterações do repositório ---"
git pull

if [ $? -ne 0 ]; then
  echo "ERRO: Falha ao obter as últimas alterações. Verifique se há conflitos."
  exit 1
fi

echo "--- Parando containers Docker ---"
docker-compose down

echo "--- Limpando imagens antigas ---"
docker system prune -f

echo "--- Reconstruindo imagens do zero ---"
docker-compose build --no-cache

echo "--- Iniciando os novos containers ---"
docker-compose up -d

if [ $? -ne 0 ]; then
  echo "ERRO: Falha ao iniciar os containers. Verifique os logs."
  exit 1
fi

echo "=== Atualização concluída! ==="
echo "O aplicativo está disponível em http://134.122.27.86"
echo "Verificando status dos containers:"
docker-compose ps

# Exibe os logs recentes para verificar se há erros
echo "--- Logs recentes do servidor de sinalização (últimas 10 linhas) ---"
docker-compose logs --tail=10 signaling

echo "--- Logs recentes da aplicação (últimas 10 linhas) ---"
docker-compose logs --tail=10 app

echo "--- Logs recentes do nginx (últimas 10 linhas) ---"
docker-compose logs --tail=10 nginx
