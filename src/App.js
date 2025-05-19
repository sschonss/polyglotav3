import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import CallInterface from './components/CallInterface';
import UsersList from './components/UsersList';

function App() {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [currentCall, setCurrentCall] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [userName, setUserName] = useState('');
  const [userNameSubmitted, setUserNameSubmitted] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(false);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);

  // Verificar se o navegador é o Chrome
  useEffect(() => {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    setBrowserSupported(isChrome);
    
    // Verificar suporte à Web Speech API
    if (!('webkitSpeechRecognition' in window)) {
      console.error('Este navegador não suporta a Web Speech API');
      setBrowserSupported(false);
    } else {
      console.log('Web Speech API suportada!');
    }
  }, []);

  // Configuração do socket quando o componente monta
  useEffect(() => {
    // Só conectar ao servidor se o nome do usuário for fornecido
    if (!userNameSubmitted || !browserSupported) return;
    
    console.log('Conectando ao servidor de sinalização...');
    
    // Usar a mesma origem (baseado no proxy Nginx)
    // O Socket.IO é servido na mesma origem, o nginx redireciona para o serviço correto
    const newSocket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query: { userName }, // Enviar o nome do usuário como parâmetro
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });
    
    // Debug de conexão
    newSocket.on('connect', () => {
      console.log('Socket conectado com sucesso! ID:', newSocket.id);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Erro ao conectar ao socket:', error.message);
    });
    
    setSocket(newSocket);

    // Limpeza quando o componente desmonta
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      newSocket.disconnect();
    };
  }, []);

  // Configurar os event listeners do socket
  useEffect(() => {
    if (!socket) return;

    // Receber lista de usuários
    socket.on('users-list', (usersList) => {
      // Filtrar o próprio usuário da lista
      setUsers(usersList.filter(id => id !== socket.id));
    });

    // Receber oferta de chamada
    socket.on('offer', async ({ offer, from }) => {
      if (isCallActive) return; // Ignorar se já estiver em chamada
      
      try {
        console.log('Recebendo oferta de chamada de:', from);
        console.log('Oferta SDP:', offer.sdp.substring(0, 50) + '...');
        
        // Acessar mídia local com configurações específicas para melhorar a qualidade
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
        
        console.log('Solicitando acesso ao microfone...');
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Acesso ao microfone concedido!');
        
        localStreamRef.current = stream;
        
        // Verificar faixas de áudio
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          console.log('Faixas de áudio locais:', audioTracks.length);
          console.log('Faixa principal:', audioTracks[0].label);
          
          // Garantir que o áudio está ativado
          audioTracks[0].enabled = true;
        } else {
          console.warn('Nenhuma faixa de áudio local disponível!');
        }
        
        // Configurar conexão peer
        const peerConnection = createPeerConnection(from);
        peerConnectionRef.current = peerConnection;
        
        // Adicionar streams
        stream.getTracks().forEach(track => {
          console.log(`Adicionando faixa ${track.kind} à conexão peer`);
          peerConnectionRef.current.addTrack(track, stream);
        });
        
        // Definir oferta remota
        console.log('Configurando descrição remota (oferta)');
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Criar e enviar resposta
        console.log('Criando resposta...');
        const answer = await peerConnectionRef.current.createAnswer();
        console.log('Resposta SDP:', answer.sdp.substring(0, 50) + '...');
        
        console.log('Configurando descrição local (resposta)');
        await peerConnectionRef.current.setLocalDescription(answer);
        
        console.log('Enviando resposta para:', from);
        socket.emit('answer', {
          answer,
          to: from
        });
        
        // Atualizar estado da chamada
        setCurrentCall(from);
        setIsCallActive(true);
      } catch (error) {
        console.error("Erro ao processar oferta:", error);
      }
    });

    // Receber resposta de chamada
    socket.on('answer', async ({ answer, from }) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (error) {
        console.error("Erro ao processar resposta:", error);
      }
    });

    // Receber candidatos ICE
    socket.on('ice-candidate', async ({ candidate, from }) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error("Erro ao adicionar candidato ICE:", error);
      }
    });

    // Receber notificação de usuário desconectado
    socket.on('user-disconnected', (userId) => {
      if (currentCall === userId) {
        endCall();
      }
    });

  }, [socket, currentCall, isCallActive]);

  // Função para criar a conexão peer
  const createPeerConnection = (userId) => {
    console.log('Criando conexão peer para o usuário:', userId);
    
    // Configuração melhorada de ICE servers, incluindo mais servidores STUN
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:openrelay.metered.ca:80' }
      ],
      iceCandidatePoolSize: 10
    });

    // Monitorar estado da conexão
    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', pc.iceConnectionState);
    };
    
    pc.onicegatheringstatechange = () => {
      console.log('ICE Gathering State:', pc.iceGatheringState);
    };
    
    pc.onsignalingstatechange = () => {
      console.log('Signaling State:', pc.signalingState);
    };

    // Lidar com candidatos ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate encontrado:', event.candidate.candidate.substr(0, 50) + '...');
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          to: userId
        });
      } else {
        console.log('ICE gathering completo');
      }
    };

    // Lidar com stream remoto
    pc.ontrack = (event) => {
      console.log('Stream remoto recebido:', event.streams);
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        
        // Usar apenas o último stream (evita duplicação)
        const audioTracks = event.streams[0].getAudioTracks();
        if (audioTracks.length > 0) {
          console.log('Faixas de áudio no stream remoto:', audioTracks.length);
          console.log('Estado da primeira faixa de áudio:', audioTracks[0].enabled, audioTracks[0].muted);
        }
        
        // Forçar atualização do estado para re-renderizar
        setIsCallActive(isActive => {
          if (isActive) { return isActive; } // Manter o mesmo estado se já ativo
          return isActive; // Forçar re-renderização
        });
      }
    };

    return pc;
  };

  // Função para iniciar uma chamada
  const startCall = async (userId) => {
    try {
      console.log('Iniciando chamada para usuário:', userId);
      
      // Acessar mídia local com configurações avançadas
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      
      console.log('Solicitando acesso ao microfone para iniciar chamada...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Acesso ao microfone concedido para chamada de saída!');
      
      // Verificar e configurar faixas de áudio
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log('Faixas de áudio disponíveis para saída:', audioTracks.length);
        console.log('Dispositivo de áudio:', audioTracks[0].label);
        audioTracks[0].enabled = true;
      } else {
        console.warn('Nenhuma faixa de áudio disponível para chamada de saída!');
      }
      
      localStreamRef.current = stream;
      
      // Configurar conexão peer
      console.log('Criando conexão peer para chamada de saída...');
      const peerConnection = createPeerConnection(userId);
      peerConnectionRef.current = peerConnection;
      
      // Adicionar streams de mídia à conexão
      stream.getTracks().forEach(track => {
        console.log(`Adicionando faixa ${track.kind} à conexão peer (saída)`);
        peerConnectionRef.current.addTrack(track, stream);
      });
      
      // Criar e configurar a oferta SDP
      console.log('Criando oferta SDP...');
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,  // Especificar que queremos receber áudio
        voiceActivityDetection: true
      });
      
      console.log('Oferta SDP criada:', offer.sdp.substring(0, 50) + '...');
      console.log('Configurando descrição local (oferta)...');
      await peerConnectionRef.current.setLocalDescription(offer);
      
      console.log('Enviando oferta para:', userId);
      socket.emit('offer', {
        offer,
        to: userId
      });
      
      // Atualizar estado da UI
      setCurrentCall(userId);
      setIsCallActive(true);
    } catch (error) {
      console.error("Erro ao iniciar chamada:", error);
    }
  };

  // Função para encerrar uma chamada
  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setCurrentCall(null);
    setIsCallActive(false);
  };

  // Função para lidar com o envio do formulário de nome
  const handleSubmitUserName = (e) => {
    e.preventDefault();
    if (userName.trim()) {
      setUserNameSubmitted(true);
    }
  };

  // Renderiza uma mensagem de erro se o navegador não for o Chrome
  if (!browserSupported) {
    return (
      <div className="app-container">
        <div className="browser-error">
          <h1>Navegador Não Suportado</h1>
          <p>Este aplicativo de chamadas de voz requer o Google Chrome para funcionar corretamente.</p>
          <p>Por favor, abra este aplicativo no Chrome para acessar todos os recursos, incluindo a transcrição de voz em tempo real.</p>
          <div className="chrome-logo">
            <img src="https://www.google.com/chrome/static/images/chrome-logo.svg" alt="Chrome Logo" width="64" />
          </div>
        </div>
      </div>
    );
  }

  // Renderiza o formulário de nome se o usuário ainda não tiver fornecido
  if (!userNameSubmitted) {
    return (
      <div className="app-container">
        <h1>Aplicativo de Chamadas de Voz</h1>
        <div className="user-name-form">
          <h2>Bem-vindo!</h2>
          <p>Por favor, insira seu nome para continuar:</p>
          <form onSubmit={handleSubmitUserName}>
            <input 
              type="text" 
              value={userName} 
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Seu nome"
              minLength="2"
              maxLength="20"
              required
            />
            <button type="submit">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1>Aplicativo de Chamadas de Voz</h1>
      <div className="user-welcome">
        <p>Bem-vindo, <strong>{userName}</strong>!</p>
      </div>
      
      {isCallActive ? (
        <CallInterface
          localStream={localStreamRef.current}
          remoteStream={remoteStreamRef.current}
          endCall={endCall}
          userName={userName}
          remoteUserName={users.find(u => u.id === currentCall)?.name || 'Usuário remoto'}
        />
      ) : (
        <UsersList
          users={users}
          startCall={startCall}
          currentUserName={userName}
        />
      )}
    </div>
  );
}

export default App;
