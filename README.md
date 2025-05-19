# Aplicativo de Chamadas de Voz com Transcrição

Este projeto é uma aplicação que permite realizar chamadas de voz entre dispositivos usando WebRTC e inclui transcrição de voz em tempo real através da Web Speech API.

## Tecnologias

- React.js - Frontend
- WebRTC - Comunicação peer-to-peer
- Socket.IO - Servidor de sinalização
- Docker e Docker Compose - Containerização
- Nginx - Servidor web e proxy reverso
- Web Speech API - Transcrição de voz em tempo real

## Funcionalidades

- Chamadas de voz entre usuários
- Transcrição de voz em tempo real (requer Google Chrome)
- Interface para visualizar e gerenciar chamadas
- Identificação de usuários por nome

## Desenvolvimento Local

1. Clone este repositório
2. Execute `docker-compose up`
3. Acesse `http://localhost`

## Estrutura do Projeto

- `src/` - Código fonte do React
- `server/` - Servidor de sinalização Socket.IO
- `public/` - Arquivos estáticos
- `nginx.conf` - Configuração do servidor web
- `docker-compose.yml` - Configuração dos serviços

## Deploy na DigitalOcean

### Pré-requisitos

- Uma conta na [DigitalOcean](https://www.digitalocean.com)
- Um domínio registrado e configurado para apontar para o IP do seu Droplet

### Passo a Passo

1. **Crie um Droplet na DigitalOcean**

   - Use a imagem "Ubuntu 22.04" ou mais recente
   - Selecione um plano básico (2GB RAM é suficiente para começar)
   - Adicione sua chave SSH para acesso seguro

2. **Conecte-se ao seu Droplet via SSH**

   ```bash
   ssh root@seu-ip-do-droplet
   ```

3. **Clone o repositório no servidor**

   ```bash
   git clone https://seu-repositorio.git /opt/voicecall
   cd /opt/voicecall
   ```

4. **Execute o script de configuração automática**

   ```bash
   chmod +x setup-server.sh
   ./setup-server.sh seu-dominio.com seu-email@example.com
   ```

5. **Verifique se o aplicativo está rodando**

   ```bash
   docker-compose ps
   ```

6. **Acesse seu aplicativo**

   Abra o navegador Google Chrome e acesse:
   ```
   https://seu-dominio.com
   ```

### Manutenção e Atualização

Para atualizar o aplicativo quando houver mudanças:

```bash
cd /opt/voicecall
git pull
docker-compose down
docker-compose up -d --build
```

### Solução de Problemas

- **Problema com certificado SSL**: Verifique os logs do certbot
  ```bash
  docker-compose logs certbot
  ```

- **Aplicação indisponível**: Verifique os logs do nginx
  ```bash
  docker-compose logs nginx
  ```

- **Problemas de conexão WebRTC**: Certifique-se que as portas HTTP (80) e HTTPS (443) estão abertas no firewall

## Requisitos

- O aplicativo requer o navegador Google Chrome para funcionar corretamente devido à dependência da Web Speech API para transcrição de voz
