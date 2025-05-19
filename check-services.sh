#!/bin/bash

echo "=== Verificando serviços da aplicação de chamadas de voz ==="

echo "--- Status dos containers ---"
docker ps -a

echo ""
echo "--- Verificando rede Docker ---"
docker network ls
docker network inspect polyglotav3_app-network

echo ""
echo "--- Logs completos do app ---"
docker logs polyglotav3-app-1

echo ""
echo "--- Logs completos do servidor de sinalização ---"
docker logs polyglotav3-signaling-1

echo ""
echo "--- Verificando se os serviços estão ouvindo nas portas corretas ---"
docker exec polyglotav3-app-1 netstat -tulpn 2>/dev/null || echo "netstat não disponível no container app"
docker exec polyglotav3-signaling-1 netstat -tulpn 2>/dev/null || echo "netstat não disponível no container signaling"

echo ""
echo "--- Verificando conexão entre os serviços ---"
# Teste de conexão do nginx para o app
docker exec polyglotav3-nginx-1 curl -I http://app:3000 2>/dev/null || echo "Erro de conexão do nginx para o app"
# Teste de conexão do nginx para o servidor de sinalização
docker exec polyglotav3-nginx-1 curl -I http://signaling:4000 2>/dev/null || echo "Erro de conexão do nginx para o signaling"

echo ""
echo "--- Verificando configuração do nginx ---"
docker exec polyglotav3-nginx-1 cat /etc/nginx/conf.d/default.conf

echo ""
echo "=== Diagnóstico concluído ==="
