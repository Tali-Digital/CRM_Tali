import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { UserProfile } from '../types';
import { subscribeToUsers, updateUserRole, adminCreateUser, deleteUserDoc } from '../services/firestoreService';
import { Shield, User, Briefcase, Plus, X, Check, Trash2 } from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingUser, setIsAddingUser] = useState(false);
  
  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'client' | 'outsourced'>('client');
  const [isCreating, setIsCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const unsubscribe = subscribeToUsers((fetchedUsers) => {
        setUsers(fetchedUsers);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [isOpen]);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'client' | 'outsourced') => {
    await updateUserRole(userId, newRole);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o usuário ${userName}? Esta ação revogará o acesso dele ao sistema.`)) {
      await deleteUserDoc(userId);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError('');
    
    const result = await adminCreateUser(newEmail, newName, newRole);
    
    if (result.success) {
      setCreatedPassword(result.password || '');
      setNewName('');
      setNewEmail('');
      setNewRole('client');
    } else {
      setError(result.error || 'Erro ao criar usuário');
    }
    
    setIsCreating(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Usuários">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400">Usuários do Sistema</h3>
          <button 
            onClick={() => {
              setIsAddingUser(!isAddingUser);
              setCreatedPassword('');
              setError('');
            }}
            className="flex items-center space-x-2 bg-stone-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-stone-800 transition-colors"
          >
            {isAddingUser ? <X size={14} /> : <Plus size={14} />}
            <span>{isAddingUser ? 'Cancelar' : 'Novo Usuário'}</span>
          </button>
        </div>

        {isAddingUser && (
          <form onSubmit={handleAddUser} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs text-center">
                {error}
              </div>
            )}
            
            {createdPassword ? (
              <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-center space-y-2">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 mb-2">
                  <Check size={20} />
                </div>
                <h4 className="font-bold text-green-900">Usuário criado com sucesso!</h4>
                <p className="text-sm text-green-700">Compartilhe a senha temporária abaixo com o usuário:</p>
                <div className="bg-white border border-green-200 py-2 px-4 rounded-lg font-mono text-lg font-bold text-stone-900 inline-block mt-2">
                  {createdPassword}
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddingUser(false);
                    setCreatedPassword('');
                  }}
                  className="block w-full mt-4 bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Nome</label>
                  <input 
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    placeholder="Nome do usuário"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Email</label>
                  <input 
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    placeholder="email@exemplo.com"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Função</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                  >
                    <option value="admin">Administrador</option>
                    <option value="client">Cliente</option>
                    <option value="outsourced">Terceirizado</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-stone-900 text-white py-2.5 rounded-xl hover:bg-stone-800 transition-all font-bold disabled:opacity-50"
                >
                  {isCreating ? 'Criando...' : 'Criar Usuário'}
                </button>
              </>
            )}
          </form>
        )}

        {loading ? (
          <div className="text-center text-stone-400 py-8">Carregando usuários...</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
            {users.map(user => (
              <div key={user.id} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center overflow-hidden">
                    {user.photoURL ? <img src={user.photoURL} alt={user.name} referrerPolicy="no-referrer" /> : <User size={20} className="text-stone-500" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-stone-900">{user.name}</h4>
                    <p className="text-xs text-stone-500">{user.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <select
                    value={user.role || 'client'}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                    className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                  >
                    <option value="admin">Administrador</option>
                    <option value="client">Cliente</option>
                    <option value="outsourced">Terceirizado</option>
                  </select>
                  <button
                    onClick={() => handleDeleteUser(user.id, user.name)}
                    className="p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                    title="Excluir usuário"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
