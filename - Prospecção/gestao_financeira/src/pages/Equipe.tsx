import React, { useState, useEffect } from 'react';
import { initialTeamData } from '../data/initialData';
import { Plus, Search, Edit2, Trash2, Users, Briefcase, Handshake, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  type: string;
  baseSalary: number;
  globalCommission: number;
  variableCommission: boolean;
  mesInicio?: string;
}

export default function Equipe() {
  const [searchTerm, setSearchTerm] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { users, user: currentUser, register, updateUser, deleteUser: deleteAuthUser } = useAuth();
  
  // Combine users and team
  const [activeTab, setActiveTab] = useState<'todos' | 'equipe'>('todos');
  
  const unifiedList = React.useMemo(() => {
    const map = new Map<string, any>();
    
    users.forEach(u => {
      map.set(u.id, {
        id: u.id,
        isUser: true,
        name: u.name,
        email: u.email,
        systemRole: u.role,
        role: '-',
        type: '-',
        baseSalary: 0,
        globalCommission: 0,
        variableCommission: false
      });
    });

    team.forEach(t => {
      if (map.has(t.id)) {
        map.set(t.id, { ...map.get(t.id), ...t, isTeam: true });
      } else {
        map.set(t.id, { ...t, isTeam: true, isUser: false, systemRole: '-' });
      }
    });

    return Array.from(map.values());
  }, [users, team]);

  const [formData, setFormData] = useState<any>({
    name: '',
    role: '',
    type: 'Equipe Interna',
    baseSalary: 0,
    globalCommission: 0,
    variableCommission: false,
    mesInicio: ''
  });

  const handleOpenModal = (membro?: any) => {
    if (membro) {
      setEditingMember(membro);
      setFormData({
        name: membro.name,
        role: membro.role,
        type: membro.type || 'Equipe Interna',
        baseSalary: membro.baseSalary || 0,
        globalCommission: membro.globalCommission || 0,
        variableCommission: membro.variableCommission || false,
        mesInicio: membro.mesInicio || '',
        email: membro.email || '',
        systemRole: membro.systemRole || 'cliente',
        isUser: membro.isUser,
        isTeam: membro.isTeam
      });
    } else {
      setEditingMember(null);
      setFormData({
        name: '',
        email: '',
        systemRole: 'cliente',
        role: '',
        type: 'Equipe Interna',
        baseSalary: 0,
        globalCommission: 0,
        variableCommission: false,
        mesInicio: '',
        isUser: true,
        isTeam: true
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMember(null);
  };

  useEffect(() => {
    const loadTeam = async () => {
      try {
        let financeiroTeam: any[] = [];
        const res = await fetch('/api.php?key=ruth_dias_equipe');
        const text = await res.text();
        if (text && !text.startsWith('<')) {
           let parsed = JSON.parse(text);
           if (typeof parsed === 'string') parsed = JSON.parse(parsed);
           if (Array.isArray(parsed)) financeiroTeam = parsed;
        } else {
           const local = localStorage.getItem('ruth_dias_equipe');
           if (local) financeiroTeam = JSON.parse(local);
        }

        let sysUsers = [];
        const userRes = await fetch('/api.php?key=ruth_dias_users');
        const userText = await userRes.text();
        if (userText && !userText.startsWith('<')) {
           let parsed = JSON.parse(userText);
           if (typeof parsed === 'string') parsed = JSON.parse(parsed);
           if (Array.isArray(parsed)) sysUsers = parsed;
        } else {
           const local = localStorage.getItem('ruth_dias_users');
           if (local) sysUsers = JSON.parse(local);
        }

        let updated = false;
        sysUsers.forEach((u: any) => {
           if (u.role === 'admin' || u.role === 'corretor' || u.role === 'parceiro') {
               const exists = financeiroTeam.find(e => e.id === u.id);
               if (!exists) {
                  financeiroTeam.push({
                     id: u.id,
                     name: u.name,
                     role: u.role === 'admin' ? 'Administrador' : u.role === 'corretor' ? 'Corretor' : 'Parceiro',
                     type: u.role === 'admin' ? 'Equipe Interna' : u.role === 'corretor' ? 'Equipe Externa' : 'Parceiro',
                     baseSalary: 0,
                     globalCommission: 0,
                     variableCommission: false
                  });
                  updated = true;
               } else if (exists.name !== u.name) {
                  exists.name = u.name;
                  updated = true;
               }
           }
        });

        const userIds = sysUsers.map((u: any) => u.id);
        const oldLen = financeiroTeam.length;
        financeiroTeam = financeiroTeam.filter((e: any) => {
           if (e.id.startsWith('u_') || e.id.startsWith('u0') || e.id.startsWith('u1') || e.id.startsWith('u2') || e.id.startsWith('u3') || e.id.startsWith('u4')) {
              return userIds.includes(e.id);
           }
           return true; 
        });
        if (financeiroTeam.length !== oldLen) updated = true;

        if (updated) {
           fetch('/api.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: 'ruth_dias_equipe', value: JSON.stringify(financeiroTeam) })
           }).catch(()=>{});
        }
        
        setTeam(financeiroTeam.length > 0 ? financeiroTeam : initialTeamData);
      } catch(e) {
        setTeam(initialTeamData);
      }
    };
    loadTeam();
  }, []);

  const syncDb = (newTeam: TeamMember[]) => {
    setTeam(newTeam);
    fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ruth_dias_equipe', value: JSON.stringify(newTeam) })
    }).catch(() => {});
    localStorage.setItem('ruth_dias_equipe', JSON.stringify(newTeam));
  };

  const handleSave = async () => {
    try {
      if (editingMember) {
        if (formData.isUser) {
          updateUser(editingMember.id, { name: formData.name, email: formData.email, role: formData.systemRole });
        }
        if (formData.isTeam) {
          syncDb(team.map(t => t.id === editingMember.id ? { 
            ...t, 
            name: formData.name,
            role: formData.role, 
            type: formData.type, 
            baseSalary: formData.baseSalary, 
            globalCommission: formData.globalCommission, 
            variableCommission: formData.variableCommission,
            mesInicio: formData.mesInicio
          } : t));
        } else if (team.find(t => t.id === editingMember.id)) {
          // If was team but unchecked
          syncDb(team.filter(t => t.id !== editingMember.id));
        }
      } else {
        let newId = `t${Date.now()}`;
        if (formData.isUser && formData.email) {
          const newAuth = await register({ name: formData.name, email: formData.email, role: formData.systemRole }, '123456'); // Default password for manual creation
          newId = newAuth.id;
        }
        if (formData.isTeam) {
          syncDb([...team, { 
            id: newId, 
            name: formData.name,
            role: formData.role, 
            type: formData.type, 
            baseSalary: formData.baseSalary, 
            globalCommission: formData.globalCommission, 
            variableCommission: formData.variableCommission,
            mesInicio: formData.mesInicio
          }]);
        }
      }
      handleCloseModal();
    } catch(e:any) {
      alert(e.message);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDelete(id);
  };

  const executeDelete = () => {
    if (confirmDelete) {
      syncDb(team.filter(t => t.id !== confirmDelete));
      deleteAuthUser(confirmDelete);
      setConfirmDelete(null);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: 0 }}>Equipe e Usuários</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>Gerencie acessos ao sistema e informações financeiras da equipe e parceiros.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> Novo Membro
        </button>
      </div>

      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: '300px', maxWidth: '400px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar por nome, cargo ou email..." 
              style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => setActiveTab('todos')}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid', borderColor: activeTab === 'todos' ? '#5c1b33' : '#e2e8f0', backgroundColor: activeTab === 'todos' ? '#5c1b33' : 'white', color: activeTab === 'todos' ? 'white' : '#475569', cursor: 'pointer', fontWeight: '500' }}
            >
              Todos os Cadastros
            </button>
            <button 
              onClick={() => setActiveTab('equipe')}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid', borderColor: activeTab === 'equipe' ? '#166534' : '#e2e8f0', backgroundColor: activeTab === 'equipe' ? '#dcfce7' : 'white', color: activeTab === 'equipe' ? '#166534' : '#475569', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Users size={16} /> Só da Equipe
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem' }}>Nome & Acesso</th>
                <th style={{ padding: '1rem' }}>Função</th>
                <th style={{ padding: '1rem' }}>Financeiro (Salário/Comissão)</th>
                <th style={{ padding: '1rem' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {unifiedList
                .filter(m => activeTab === 'todos' || m.isTeam)
                .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || (m.role && m.role.toLowerCase().includes(searchTerm.toLowerCase())) || (m.email && m.email.toLowerCase().includes(searchTerm.toLowerCase())))
                .map(membro => (
                <tr key={membro.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {membro.name}
                      {membro.isTeam && <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', backgroundColor: '#dcfce7', color: '#166534', fontWeight: 'bold' }}>Equipe</span>}
                      {membro.isUser && <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 'bold' }}>App</span>}
                    </div>
                    {membro.isUser && <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}><ShieldAlert size={12}/> {membro.email} • {membro.systemRole}</div>}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {membro.isTeam ? (
                      <>
                        <div style={{ color: 'var(--text-secondary)' }}>{membro.role || 'Sem cargo'}</div>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '999px', 
                          fontSize: '0.7rem', 
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          marginTop: '0.3rem',
                          backgroundColor: membro.type === 'Equipe Interna' ? '#dcfce7' : membro.type === 'Equipe Externa' ? '#e0e7ff' : '#fef3c7',
                          color: membro.type === 'Equipe Interna' ? '#166534' : membro.type === 'Equipe Externa' ? '#3730a3' : '#92400e'
                        }}>
                          {membro.type === 'Equipe Interna' && <Users size={12} />}
                          {membro.type === 'Equipe Externa' && <Briefcase size={12} />}
                          {membro.type === 'Parceiro' && <Handshake size={12} />}
                          {membro.type}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>Apenas Usuário</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {membro.isTeam ? (
                      <>
                        <div style={{ fontWeight: '500' }}>
                          {membro.baseSalary > 0 ? membro.baseSalary.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem Fixo'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {membro.type === 'Equipe Interna' 
                            ? (membro.globalCommission > 0 ? `${(membro.globalCommission * 100).toFixed(1)}% Global` : membro.variableCommission ? 'Variável por Venda' : 'Sem Comissão')
                            : 'Repasse Sazonal'
                          }
                        </div>
                      </>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleOpenModal(membro)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(membro.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{editingMember ? 'Editar Membro' : 'Novo Membro'}</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-secondary)" /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Nome</label>
                <input type="text" className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: João Silva" />
              </div>

              {/* Seção Usuário */}
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', marginBottom: '1rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.isUser} onChange={e => setFormData({...formData, isUser: e.target.checked})} />
                  Tem acesso ao sistema (Usuário App)
                </label>
                
                {formData.isUser && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>E-mail (usado para login)</label>
                      <input type="email" required className="input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="usuario@email.com" />
                      {!editingMember && <small style={{ color: 'var(--text-secondary)' }}>A senha padrão será "123456", ele poderá trocar depois.</small>}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>Perfil de Acesso no Sistema</label>
                      <select className="input" value={formData.systemRole} onChange={e => setFormData({...formData, systemRole: e.target.value})}>
                        <option value="cliente">Cliente</option>
                        <option value="parceiro">Parceiro (Correspondente, Vistoriador)</option>
                        <option value="corretor">Corretor</option>
                        <option value="gerente">Gerente</option>
                        <option value="financeiro">Financeiro / Administrativo</option>
                        {['admin', 'CEO', 'Sócio CFO'].includes(currentUser?.role || '') && <option value="admin">Administrador Geral</option>}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Seção Equipe */}
              <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', marginBottom: '1rem', cursor: 'pointer', color: '#166534' }}>
                  <input type="checkbox" checked={formData.isTeam} onChange={e => setFormData({...formData, isTeam: e.target.checked})} />
                  Faz parte da Equipe Financeira (Recebe Salário/Comissão)
                </label>

                {formData.isTeam && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Cargo / Papel</label>
                      <input type="text" className="input" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="Ex: Corretor Associado" />
                    </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Tipo de Vínculo</label>
                <select className="input" value={formData.type} onChange={e => {
                  const newType = e.target.value;
                  // Auto-adjust rules based on type
                  if (newType !== 'Equipe Interna') {
                     setFormData({...formData, type: newType, globalCommission: 0, variableCommission: false, baseSalary: 0});
                  } else {
                     setFormData({...formData, type: newType});
                  }
                }}>
                  <option value="Equipe Interna">Equipe Interna (Pode ter Salário/Comissão Global)</option>
                  <option value="Equipe Externa">Equipe Externa (Repasse Sazonal)</option>
                  <option value="Parceiro">Parceiro / Outra Imobiliária (Repasse Sazonal)</option>
                </select>
              </div>

              {formData.type === 'Equipe Interna' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Salário Fixo (R$)</label>
                    <input type="number" className="input" value={formData.baseSalary} onChange={e => setFormData({...formData, baseSalary: Number(e.target.value)})} />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Regra de Comissionamento</label>
                    <select className="input" value={formData.globalCommission > 0 ? 'global' : formData.variableCommission ? 'variavel' : 'nenhuma'} onChange={e => {
                      const val = e.target.value;
                      if (val === 'global') {
                        setFormData({...formData, globalCommission: 0.01, variableCommission: false});
                      } else if (val === 'variavel') {
                        setFormData({...formData, globalCommission: 0, variableCommission: true});
                      } else {
                        setFormData({...formData, globalCommission: 0, variableCommission: false});
                      }
                    }}>
                      <option value="nenhuma">Sem comissão</option>
                      <option value="global">Porcentagem Global (Sobre Caixa da Empresa)</option>
                      <option value="variavel">Variável por Venda</option>
                    </select>
                  </div>

                  {formData.globalCommission > 0 && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Porcentagem Global (%)</label>
                      <input type="number" step="0.1" className="input" value={formData.globalCommission * 100} onChange={e => setFormData({...formData, globalCommission: Number(e.target.value) / 100})} />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Mês de Início (Opcional)</label>
                    <input type="month" className="input" value={formData.mesInicio || ''} onChange={e => setFormData({...formData, mesInicio: e.target.value})} />
                    <small style={{ color: 'var(--text-secondary)' }}>A partir de qual mês este membro passará a receber os valores fixos/globais.</small>
                  </div>
                </>
              )}
            </div>
          )}
              </div>

              <button className="btn btn-primary" onClick={handleSave} style={{ marginTop: '1rem', width: '100%', padding: '0.8rem', fontSize: '1rem' }}>
                {editingMember ? 'Salvar Alterações' : 'Adicionar Membro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1e293b' }}>Confirmar Exclusão</h3>
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Tem certeza que deseja excluir este membro e seu acesso ao sistema?</p>
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
