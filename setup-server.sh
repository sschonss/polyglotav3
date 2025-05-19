#!/bin/bash

# Script de setup para DigitalOcean Droplet
# Valores já configurados para o servidor 134.122.27.86

# Definindo valores fixos
DOMAIN="134.122.27.86"
EMAIL="schonsluuix@gmail.com"

echo "=== Configurando servidor para $DOMAIN ==="

# Atualiza o sistema
echo "--- Atualizando sistema ---"
apt-get update && apt-get upgrade -y

# Instala ferramentas necessárias
echo "--- Instalando ferramentas necessárias ---"
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common \
    git

# Instala Docker
echo "--- Instalando Docker ---"
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io

# Instala Docker Compose
echo "--- Instalando Docker Compose ---"
curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Adicionar usuário ao grupo docker
usermod -aG docker $USER

# Configura variáveis de ambiente a partir do .env.example
echo "--- Configurando variáveis de ambiente ---"
if [ -f ".env.example" ]; then
  cp .env.example .env
  # Substitui as variáveis no arquivo .env
  sed -i "s/seu-dominio\.com/$DOMAIN/g" .env
  sed -i "s/seu-email@exemplo\.com/$EMAIL/g" .env
  
  # Adiciona NODE_ENV=production
  echo "NODE_ENV=production" >> .env
  
  # Configura a URL de sinalização
  echo "REACT_APP_SIGNALING_URL=https://$DOMAIN/signal" >> .env
  
  # Configura CORS
  echo "CORS_ORIGIN=https://$DOMAIN" >> .env
else
  # Cria um arquivo .env básico se .env.example não existir
  cat > .env <<EOL
DOMAIN=$DOMAIN
EMAIL=$EMAIL
NODE_ENV=production
REACT_APP_SIGNALING_URL=https://$DOMAIN/signal
CORS_ORIGIN=https://$DOMAIN
EOL
fi

# Cria diretórios necessários
echo "--- Criando diretórios ---"
mkdir -p ./ssl
mkdir -p ./certbot/www
mkdir -p ./certbot/conf

# Atualiza o nginx.conf com as variáveis de ambiente
echo "--- Configurando nginx ---"
sed -i "s/\${DOMAIN}/$DOMAIN/g" nginx.conf

# Aplica variáveis de ambiente ao docker-compose.yml
echo "--- Configurando docker-compose.yml ---"
export $(grep -v '^#' .env | xargs)

# Inicia os containers
echo "--- Iniciando containers ---"
docker-compose up -d

echo "=== Setup concluído! ==="
echo "Agora é necessário configurar o DNS para apontar $DOMAIN para o IP deste servidor."
echo "Após fazer isso, os certificados SSL serão obtidos automaticamente."
echo "O aplicativo estará disponível em https://$DOMAIN"
