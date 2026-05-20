import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { UserProfile } from '../types';
import { subscribeToUsers, updateUserRole, adminCreateUser, deleteUserDoc, addGhostMember } from '../services/firestoreService';
import { Shield, User, Briefcase, Plus, X, Check, Trash2 } from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAddMode?: boolean;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose, initialAddMode = false }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingUser, setIsAddingUser] = useState(initialAddMode);

  useEffect(() => {
    if (isOpen && initialAddMode) {
      setIsAddingUser(true);
    }
  }, [isOpen, initialAddMode]);
  
  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'client' | 'equipe'>('client');
  const [newTeamCategory, setNewTeamCategory] = useState<'terceirizado' | 'internalizado' | 'intermediados'>('terceirizado');
  const [isGhost, setIsGhost] = useState(false);
  const [pixKey, setPixKey] = useState('');
  const [phone, setPhone] = useState('');
  const [workDescription, setWorkDescription] = useState('');
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

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'client' | 'equipe', teamCategory?: 'terceirizado' | 'internalizado' | 'intermediados') => {
    await updateUserRole(userId, newRole, teamCategory);
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
    
    try {
      if (isGhost) {
        await addGhostMember({
          name: newName,
          email: newEmail,
          teamCategory: newTeamCategory,
          pixKey,
          phone,
          workDescription
        });
        setCreatedPassword('EXTERNAL_MEMBER'); // Indicator for success without password
      } else {
        const result = await adminCreateUser(newEmail, newName, newRole, newRole === 'equipe' ? newTeamCategory : undefined);
        
        if (result.success) {
          setCreatedPassword(result.password || '');
        } else {
          setError(result.error || 'Erro ao criar usuário');
          setIsCreating(false);
          return;
        }
      }

      setNewName('');
      setNewEmail('');
      setNewRole('client');
      setNewTeamCategory('terceirizado');
      setPixKey('');
      setPhone('');
      setWorkDescription('');
      setIsGhost(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário');
    }
    
    setIsCreating(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Usuários" maxWidth="max-w-5xl">
      <div className={`grid gap-8 ${isAddingUser ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400">Usuários do Sistema</h3>
          <button 
            onClick={() => {
              setIsAddingUser(!isAddingUser);
              setCreatedPassword('');
              setError('');
              setIsGhost(false);
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
                <h4 className="font-bold text-green-900">Membro criado com sucesso!</h4>
                {createdPassword !== 'EXTERNAL_MEMBER' ? (
                  <>
                    <p className="text-sm text-green-700">Compartilhe a senha temporária abaixo com o usuário:</p>
                    <div className="bg-white border border-green-200 py-2 px-4 rounded-lg font-mono text-lg font-bold text-stone-900 inline-block mt-2">
                      {createdPassword}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-green-700">Este é um membro externo e não possui acesso ao sistema.</p>
                )}
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
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-stone-100 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isGhost ? 'bg-blue-50 text-blue-600' : 'bg-stone-50 text-stone-400'}`}>
                      <Shield size={14} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-900">Membro Externo</h4>
                      <p className="text-[9px] text-stone-400 font-bold">Sem acesso à plataforma</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsGhost(!isGhost);
                      if (!isGhost) setNewRole('equipe');
                    }}
                    className={`w-10 h-5 rounded-full transition-all relative ${isGhost ? 'bg-blue-600' : 'bg-stone-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isGhost ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

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
                
                {!isGhost && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Função</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    >
                      <option value="admin">Administrador</option>
                      <option value="client">Cliente</option>
                      <option value="equipe">Equipe</option>
                    </select>
                  </div>
                )}

                {(newRole === 'equipe' || isGhost) && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Categoria de Equipe</label>
                    <select
                      value={newTeamCategory}
                      onChange={(e) => setNewTeamCategory(e.target.value as any)}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    >
                      <option value="terceirizado">Terceirizados</option>
                      <option value="internalizado">Internalizados</option>
                      <option value="intermediados">Intermediados</option>
                    </select>
                  </div>
                )}

                {isGhost && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Telefone</label>
                      <input 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Chave PIX</label>
                      <input 
                        value={pixKey}
                        onChange={(e) => setPixKey(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                        placeholder="Chave PIX para pagamento"
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">Descrição do Trabalho</label>
                      <textarea 
                        value={workDescription}
                        onChange={(e) => setWorkDescription(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 resize-none h-20"
                        placeholder="Quais serviços este membro realiza?"
                      />
                    </div>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-stone-900 text-white py-2.5 rounded-xl hover:bg-stone-800 transition-all font-bold disabled:opacity-50"
                >
                  {isCreating ? 'Criando...' : isGhost ? 'Cadastrar Membro Externo' : 'Criar Usuário'}
                </button>
              </>
            )}
          </form>
        )}
        </div>

        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400">Usuários Ativos</h3>
          
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
                  <div className="flex flex-col gap-1">
                    <select
                      value={user.role || 'client'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as any, user.teamCategory)}
                      className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    >
                      <option value="admin">Administrador</option>
                      <option value="client">Cliente</option>
                      <option value="equipe">Equipe</option>
                    </select>
                    {user.role === 'equipe' && (
                      <select
                        value={user.teamCategory || 'terceirizado'}
                        onChange={(e) => handleRoleChange(user.id, 'equipe', e.target.value as any)}
                        className="bg-white border border-stone-200 rounded-xl px-2 py-1 text-[10px] font-bold text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                      >
                        <option value="terceirizado">Terceirizados</option>
                        <option value="internalizado">Internalizado</option>
                        <option value="intermediados">Intermediados</option>
                      </select>
                    )}
                  </div>
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
      </div>
    </Modal>
  );
};
