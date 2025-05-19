import React from 'react';

const UsersList = ({ users, startCall, currentUserName }) => {
  return (
    <div className="user-list-container">
      <h2>Usuários Disponíveis</h2>
      
      {users.length === 0 ? (
        <div className="empty-list">
          <p>Nenhum usuário disponível no momento.</p>
          <p>Aguarde alguém se conectar ou compartilhe o link com um amigo.</p>
        </div>
      ) : (
        <div className="user-list">
          {users.map(user => (
            <div key={user.id} className="user-item">
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-id">ID: {user.id.substring(0, 6)}...</span>
              </div>
              <button onClick={() => startCall(user.id)}>
                Iniciar Chamada
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsersList;
