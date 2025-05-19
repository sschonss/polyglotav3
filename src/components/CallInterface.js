import React, { useEffect, useRef, useState } from 'react';

// Classe que gerencia a transcrição usando Web Speech API
class SpeechTranscriber {
  constructor(onTranscriptUpdate, onTranscriptFinal, language = 'pt-BR') {
    // Verificar se a API está disponível no navegador
    if (!('webkitSpeechRecognition' in window)) {
      console.error('Web Speech API não é suportada neste navegador');
      return;
    }
    
    this.recognition = new window.webkitSpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = language;
    
    this.onTranscriptUpdate = onTranscriptUpdate;
    this.onTranscriptFinal = onTranscriptFinal;
    this.isListening = false;
    
    // Configurar manipuladores de eventos
    this.recognition.onresult = this.handleResult.bind(this);
    this.recognition.onerror = this.handleError.bind(this);
    this.recognition.onend = this.handleEnd.bind(this);
  }
  
  start() {
    if (!this.recognition) return false;
    try {
      this.recognition.start();
      this.isListening = true;
      console.log('Transcrição iniciada');
      return true;
    } catch (error) {
      console.error('Erro ao iniciar transcrição:', error);
      return false;
    }
  }
  
  stop() {
    if (!this.recognition) return;
    try {
      this.recognition.stop();
      this.isListening = false;
      console.log('Transcrição parada');
    } catch (error) {
      console.error('Erro ao parar transcrição:', error);
    }
  }
  
  handleResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    
    // Atualizar as transcrições
    if (interimTranscript) {
      this.onTranscriptUpdate(interimTranscript);
    }
    
    if (finalTranscript) {
      this.onTranscriptFinal(finalTranscript);
    }
  }
  
  handleError(event) {
    console.error('Erro na transcrição:', event.error);
    
    // Tentar reiniciar se o erro for um problema temporário
    if (event.error === 'network' || event.error === 'service-not-allowed') {
      setTimeout(() => {
        if (this.isListening) {
          this.start();
        }
      }, 1000);
    }
  }
  
  handleEnd() {
    console.log('Reconhecimento de fala encerrado');
    // Reiniciar automaticamente se ainda estiver no modo de escuta
    if (this.isListening) {
      this.recognition.start();
    }
  }
}

const CallInterface = ({ localStream, remoteStream, endCall, userName, remoteUserName }) => {
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [localAudioTracks, setLocalAudioTracks] = useState(0);
  const [remoteAudioTracks, setRemoteAudioTracks] = useState(0);
  const [audioError, setAudioError] = useState(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const transcriberRef = useRef(null);

  // Configurar a referência do stream local
  useEffect(() => {
    console.log('Local stream mudou:', localStream);
    if (localStream && localAudioRef.current) {
      try {
        localAudioRef.current.srcObject = localStream;
        const tracks = localStream.getAudioTracks();
        setLocalAudioTracks(tracks.length);
        console.log('Faixas de áudio locais:', tracks.length);
        
        // Verificar se o áudio local está ativo
        if (tracks.length > 0) {
          console.log('Estado da faixa de áudio local:', tracks[0].enabled, tracks[0].muted);
        }
        
        // Tentar forçar a reprodução
        localAudioRef.current.play().catch(err => {
          console.error('Erro ao reproduzir áudio local:', err);
        });
      } catch (err) {
        console.error('Erro ao configurar stream local:', err);
        setAudioError('Erro no áudio local: ' + err.message);
      }
    }
  }, [localStream]);

  // Configurar a referência do stream remoto e iniciar transcrição
  useEffect(() => {
    console.log('Remote stream mudou:', remoteStream);
    if (remoteStream && remoteAudioRef.current) {
      try {
        remoteAudioRef.current.srcObject = remoteStream;
        const tracks = remoteStream.getAudioTracks();
        setRemoteAudioTracks(tracks.length);
        console.log('Faixas de áudio remotas:', tracks.length);
        
        // Verificar se o áudio remoto está ativo
        if (tracks.length > 0) {
          console.log('Estado da faixa de áudio remota:', tracks[0].enabled, tracks[0].muted);
          // Habilitar a faixa explicitamente
          tracks[0].enabled = true;
          
          // Iniciar transcrição se não estiver já ativa
          if (!isTranscribing && 'webkitSpeechRecognition' in window) {
            // Criar nova instância do transcritor se não existir
            if (!transcriberRef.current) {
              console.log('Inicializando sistema de transcrição...');
              transcriberRef.current = new SpeechTranscriber(
                // Função para lidar com transcrições temporárias
                (interimText) => {
                  setCurrentTranscript(interimText);
                },
                // Função para lidar com transcrições finais
                (finalText) => {
                  const timestamp = new Date().toLocaleTimeString();
                  setTranscriptHistory(prev => [
                    ...prev,
                    { text: finalText, timestamp, from: remoteUserName }
                  ]);
                  setCurrentTranscript('');
                },
                'pt-BR' // Idioma da transcrição
              );
            }
            
            // Iniciar transcrição
            if (transcriberRef.current.start()) {
              setIsTranscribing(true);
              console.log('Transcrição iniciada com sucesso!');
            }
          } else if (!('webkitSpeechRecognition' in window)) {
            console.warn('Web Speech API não disponível para transcrição');
          }
        }
        
        // Garantir que o áudio está sendo reproduzido
        remoteAudioRef.current.play().catch(err => {
          console.error('Erro ao reproduzir áudio remoto:', err);
          setAudioError('Clique para ativar o áudio');
        });
      } catch (err) {
        console.error('Erro ao configurar stream remoto:', err);
        setAudioError('Erro no áudio remoto: ' + err.message);
      }
    }
    
    // Cleanup: parar transcrição quando o componente desmontar ou stream mudar
    return () => {
      if (transcriberRef.current && isTranscribing) {
        console.log('Parando transcrição...');
        transcriberRef.current.stop();
        setIsTranscribing(false);
      }
    };
  }, [remoteStream, remoteUserName, isTranscribing]);

  // Função para lidar com a ativação manual do áudio
  const handleEnableAudio = () => {
    try {
      if (remoteAudioRef.current) {
        // Tenta reproduzir o áudio - isso é necessário em alguns navegadores mobile
        remoteAudioRef.current.play();
        setAudioError(null);
      }
      
      if (remoteStream) {
        const tracks = remoteStream.getAudioTracks();
        if (tracks.length > 0) {
          tracks[0].enabled = true;
          console.log('Faixa de áudio remota ativada manualmente');
        }
      }
    } catch (err) {
      console.error('Erro ao ativar áudio manualmente:', err);
    }
  };

  return (
    <div className="call-interface">
      <div className="call-status">
        Chamada com <strong>{remoteUserName}</strong>
      </div>

      {audioError && (
        <div className="audio-error">
          <p>{audioError}</p>
          <button onClick={handleEnableAudio}>Ativar Áudio</button>
        </div>
      )}

      <div className="audio-container">
        <div>
          <p>Seu áudio ({userName}): {localAudioTracks > 0 ? 'OK' : 'Desativado'}</p>
          <audio ref={localAudioRef} autoPlay muted playsInline></audio>
        </div>
        
        <div>
          <p>Áudio de {remoteUserName}: {remoteAudioTracks > 0 ? 'OK' : 'Aguardando'}</p>
          <audio ref={remoteAudioRef} autoPlay playsInline></audio>
          <button onClick={handleEnableAudio} className="enable-audio">
            Forçar ativação do áudio
          </button>
        </div>
      </div>

      {/* Área de transcrição */}
      <div className="transcription-container">
        <h3>Transcrição da Conversa</h3>
        
        {/* Texto sendo transcrito atualmente */}
        {currentTranscript && (
          <div className="current-transcript">
            <span className="transcript-from">{remoteUserName}:</span>
            <span className="transcript-text">"<em>{currentTranscript}</em>"</span>
            <span className="transcribing-indicator">...</span>
          </div>
        )}
        
        {/* Histórico de transcrições */}
        <div className="transcript-history">
          {transcriptHistory.length === 0 ? (
            <p className="no-transcript">A transcrição aparecerá aqui quando {remoteUserName} falar...</p>
          ) : (
            transcriptHistory.map((item, index) => (
              <div key={index} className="transcript-entry">
                <div className="transcript-header">
                  <span className="transcript-from">{item.from}</span>
                  <span className="transcript-time">{item.timestamp}</span>
                </div>
                <div className="transcript-content">
                  "{item.text}"
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="transcription-status">
          {isTranscribing ? (
            <span className="status-active">Transcrição ativa</span>
          ) : (
            <span className="status-inactive">Transcrição inativa</span>
          )}
        </div>
      </div>

      <div className="audio-debug">
        <p>Status da chamada:</p>
        <ul>
          <li>Faixas de áudio local: {localAudioTracks}</li>
          <li>Faixas de áudio remoto: {remoteAudioTracks}</li>
          <li>Transcrição: {isTranscribing ? 'Ativa' : 'Inativa'}</li>
        </ul>
      </div>

      <div className="call-controls">
        <button className="end-call" onClick={endCall}>
          Encerrar Chamada
        </button>
      </div>
    </div>
  );
};

export default CallInterface;
