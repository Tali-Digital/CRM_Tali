import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { User, Role } from '../context/AuthContext';
import { Plus, Edit2, Trash2, Shield, User as UserIcon, X, Check, Eye } from 'lucide-react';

export default function UsersManagement() {
  const { user: currentUser, users, register, updateUser, deleteUser, impersonateUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('cliente');

  // Apenas Admin e Corretor podem gerenciar (Corretor tem restrições se tentarmos impor)
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'corretor' && currentUser.role !== 'Sócio CFO' && currentUser.role !== 'CEO')) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <Shield size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
        <h2>Acesso Restrito</h2>
        <p>Você não tem permissão para acessar o gerenciamento de usuários.</p>
      </div>
    );
  }

  const openModal = (userToEdit?: User) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setName(userToEdit.name);
      setEmail(userToEdit.email);
      setRole(userToEdit.role);
    } else {
      setEditingUser(null);
      setName('');
      setEmail('');
      setRole('cliente');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        updateUser(editingUser.id, { name, email, role });
      } else {
        register({ name, email, role });
      }
      closeModal();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDelete(id);
  };

  const executeDelete = () => {
    if (confirmDelete) {
      deleteUser(confirmDelete);
      setConfirmDelete(null);
    }
  };

  const roleColors: Record<Role, { bg: string, text: string }> = {
    'admin': { bg: '#fee2e2', text: '#991b1b' },
    'corretor': { bg: '#e0e7ff', text: '#3730a3' },
    'parceiro': { bg: '#fef3c7', text: '#92400e' },
    'cliente': { bg: '#f1f5f9', text: '#475569' },
    'financeiro': { bg: '#dcfce7', text: '#166534' },
    'Sócio CFO': { bg: '#f3e8ff', text: '#6b21a8' },
    'CEO': { bg: '#ffedd5', text: '#9a3412' }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: '0.5rem' }}>Gerenciamento de Usuários</h1>
          <p style={{ color: '#64748b' }}>Cadastre e gerencie acessos de corretores, parceiros e clientes.</p>
        </div>
        <button 
          onClick={() => openModal()}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#5c1b33', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          <Plus size={18} /> Novo Usuário
        </button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.9rem' }}>
              <th style={{ padding: '1rem 1.5rem' }}>Nome</th>
              <th style={{ padding: '1rem 1.5rem' }}>E-mail</th>
              <th style={{ padding: '1rem 1.5rem' }}>Perfil (Role)</th>
              <th style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <UserIcon size={20} />
                  </div>
                  <span style={{ fontWeight: '500', color: '#0f172a' }}>{u.name}</span>
                </td>
                <td style={{ padding: '1rem 1.5rem', color: '#475569' }}>{u.email}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span style={{ backgroundColor: roleColors[u.role]?.bg || '#f1f5f9', color: roleColors[u.role]?.text || '#475569', padding: '0.2rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'capitalize' }}>
                    {u.role || 'Desconhecido'}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    {((u.role !== 'CEO' && u.role !== 'Sócio CFO') || (currentUser.role === 'CEO' || currentUser.role === 'Sócio CFO')) && (
                      <>
                        <button onClick={() => openModal(u)} style={{ padding: '0.4rem', border: 'none', background: 'none', color: '#3b82f6', cursor: 'pointer' }}>
                          <Edit2 size={18} />
                        </button>
                        {['admin', 'CEO', 'Sócio CFO'].includes(currentUser.role) && u.id !== currentUser.id && (
                          <button onClick={() => impersonateUser(u.id)} title={`Acessar como ${u.name}`} style={{ padding: '0.4rem', border: 'none', background: 'none', color: '#10b981', cursor: 'pointer' }}>
                            <Eye size={18} />
                          </button>
                        )}
                        {u.id !== currentUser.id && (
                          <button onClick={() => handleDelete(u.id)} title="Excluir" style={{ padding: '0.4rem', border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={18} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#0f172a' }}>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>Nome Completo</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>E-mail (usado para login)</label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>Perfil de Acesso</label>
                <select value={role} onChange={e => setRole(e.target.value as Role)} style={{ width: '100%', padding: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: 'white' }}>
                  <option value="cliente">Cliente (Acesso Limitado)</option>
                  <option value="parceiro">Parceiro (Correspondente, Vistoriador)</option>
                  <option value="corretor">Corretor (Acesso aos seus clientes)</option>
                  <option value="gerente">Gerente (Gerencia time e clientes)</option>
                  <option value="financeiro">Financeiro / Administrativo</option>
                  {['admin', 'CEO', 'Sócio CFO'].includes(currentUser.role) && (
                    <option value="admin">Administrador Geral</option>
                  )}
                  {['CEO', 'Sócio CFO'].includes(currentUser.role) && (
                    <>
                      <option value="CEO">Sócio (CEO)</option>
                      <option value="Sócio CFO">Sócio (CFO)</option>
                    </>
                  )}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={closeModal} style={{ padding: '0.8rem 1.5rem', background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
                <button type="submit" style={{ padding: '0.8rem 1.5rem', backgroundColor: '#5c1b33', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Check size={18} /> Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#0f172a' }}>Confirmar Exclusão</h3>
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Tem certeza que deseja excluir este usuário?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
              <button onClick={executeDelete} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
