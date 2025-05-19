# Estágio de compilação
FROM node:16-alpine as build

WORKDIR /app

# Copiar arquivos de dependências primeiro para aproveitar o cache do Docker
COPY package*.json ./
RUN npm install

# Copiar o resto dos arquivos
COPY . .

# Compilar a aplicação para produção
RUN npm run build

# Estágio de produção 
FROM node:16-alpine

WORKDIR /app

# Instalar servidor leve para servir conteúdo estático
RUN npm install -g serve

# Copiar os arquivos de build da etapa anterior
COPY --from=build /app/build ./build

# Expor a porta 3000
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["serve", "-s", "build", "-l", "3000"]
