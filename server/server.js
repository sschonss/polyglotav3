const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const ip = require('ip');

// Criar aplicativo Express
const app = express();

// Configurar CORS para aceitar conexões de qualquer origem (necessário para ngrok)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

// Página inicial do servidor
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Servidor de Sinalização WebRTC</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #4285f4; }
          .status { background-color: #e8f5e9; padding: 10px; border-radius: 4px; }
          .info { background-color: #f5f5f5; padding: 15px; margin-top: 20px; border-radius: 4px; }
          pre { background-color: #f9f9f9; padding: 10px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Servidor de Sinalização WebRTC</h1>
        <div class="status">
          <p><strong>Status:</strong> Ativo e pronto para conexões</p>
          <p><strong>Endereço IP:</strong> ${ip.address()}</p>
          <p><strong>Porta:</strong> 4000</p>
          <p><strong>Conexões ativas:</strong> <span id="connections">0</span></p>
        </div>
        <div class="info">
          <h3>Instruções para usar com ngrok:</h3>
          <ol>
            <li>Mantenha este servidor em execução</li>
            <li>Abra outro terminal e execute: <pre>ngrok http 4000</pre></li>
            <li>Copie o URL fornecido pelo ngrok (ex: https://xxxx-xxx-xx-xx.ngrok-free.app)</li>
            <li>Quando acessar o aplicativo frontend, informe este URL quando solicitado</li>
          </ol>
        </div>
      </body>
    </html>
  `);
});

// Rota de verificação de status (para healthcheck)
app.get('/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    connections: Object.keys(connectedUsers).length,
    uptime: process.uptime(),
    ip: ip.address()
  });
});

// Criar o servidor HTTP
const server = http.createServer(app);

// Configurar Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Armazenar os usuários conectados
const connectedUsers = {};

// Lidar com conexões de socket
io.on('connection', (socket) => {
  // Obter nome do usuário da query
  const userName = socket.handshake.query.userName || 'Usuário Anônimo';
  console.log(`Novo usuário conectado: ${userName} (${socket.id})`);
  
  // Adicionar usuário à lista de conectados com nome
  connectedUsers[socket.id] = {
    id: socket.id,
    name: userName
  };
  
  // Emitir lista atualizada de usuários
  io.emit('users-list', Object.values(connectedUsers));

  // Lidar com ofertas de conexão
  socket.on('offer', ({ offer, to }) => {
    console.log(`Repassando oferta de ${socket.id} para ${to}`);
    io.to(to).emit('offer', {
      offer,
      from: socket.id
    });
  });

  // Lidar com respostas
  socket.on('answer', ({ answer, to }) => {
    console.log(`Repassando resposta de ${socket.id} para ${to}`);
    io.to(to).emit('answer', {
      answer,
      from: socket.id
    });
  });

  // Lidar com candidatos ICE
  socket.on('ice-candidate', ({ candidate, to }) => {
    console.log(`Repassando candidato ICE de ${socket.id} para ${to}`);
    io.to(to).emit('ice-candidate', {
      candidate,
      from: socket.id
    });
  });

  // Lidar com desconexão
  socket.on('disconnect', () => {
    const user = connectedUsers[socket.id];
    console.log(`Usuário desconectado: ${user?.name || 'desconhecido'} (${socket.id})`);
    delete connectedUsers[socket.id];
    io.emit('users-list', Object.values(connectedUsers));
    io.emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor de sinalização rodando na porta ${PORT}`);
});
