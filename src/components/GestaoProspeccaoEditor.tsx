import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, CheckCircle, Clock, Settings, Bot, Copy } from 'lucide-react';
import Swal from 'sweetalert2';
import GeradorProspeccao from './GeradorProspeccao';
import GerenciadorModelosModal from './GerenciadorModelosModal';



import { subscribeToProspeccaoDocs, deleteProspeccaoDoc, addProspeccaoDoc, updateProspeccaoDoc, updateProspect } from '../services/firestoreService';
import { EditorProspeccaoDoc } from '../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function GestaoProspeccaoEditor() {
  const [prospeccoes, setProspeccoes] = useState<EditorProspeccaoDoc[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isGeradorOpen, setIsGeradorOpen] = useState(false);
  const [isGerenciadorOpen, setIsGerenciadorOpen] = useState(false);
  const [editingEditorProspeccaoDoc, setEditingEditorProspeccaoDoc] = useState<EditorProspeccaoDoc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EditorProspeccaoDoc | null>(null);
  const [prospectsMap, setProspectsMap] = useState<Record<string, { responsible: string; ownerName: string; clinicName: string; }>>({});
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [periodType, setPeriodType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToProspeccaoDocs(docs => setProspeccoes(docs));
    
    const unsubscribeProspects = onSnapshot(collection(db, 'prospects'), (snapshot) => {
      const map: Record<string, { responsible: string; ownerName: string; clinicName: string; }> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        map[doc.id] = {
          responsible: data.responsible || '',
          ownerName: data.ownerName || '',
          clinicName: data.clinicName || ''
        };
      });
      setProspectsMap(map);
    });

    return () => {
      unsubscribe();
      unsubscribeProspects();
    };
  }, []);

  const uniqueResponsibles = Array.from(new Set(Object.values(prospectsMap).map(p => p.responsible).filter(Boolean))).sort() as string[];

  const handleOpenGerador = (prospeccao?: EditorProspeccaoDoc) => {
    if (prospeccao) {
      setEditingEditorProspeccaoDoc(prospeccao);
    } else {
      setEditingEditorProspeccaoDoc(null);
    }
    setIsGeradorOpen(true);
  };



  const handleDelete = async () => {
    if (confirmDelete) {
      await deleteProspeccaoDoc(confirmDelete.id);
      if (confirmDelete.clienteId) {
        await updateProspect(confirmDelete.clienteId, { hasPresencialFicha: false });
      }
      setConfirmDelete(null);
    }
  };

  const handleDuplicate = async (prospeccao: EditorProspeccaoDoc) => {
    try {
      const copy = { ...prospeccao };
      delete (copy as any).id;
      if (copy.titulo) copy.titulo += ' (Cópia)';
      if (copy.clienteNome) copy.clienteNome += ' (Cópia)';
      copy.isEntregue = false;
      copy.dataAssinatura = new Date().toISOString();
      
      await addProspeccaoDoc(copy as any);
      Swal.fire({ icon: 'success', title: 'Prospecção Duplicada!', timer: 1500, showConfirmButton: false });
    } catch (error: any) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'Erro ao duplicar', text: error.message });
    }
  };



  const getMasterPassword = async () => {
    const savedData = sessionStorage.getItem('master_pass_auth');
    if (savedData) {
      const auth = JSON.parse(savedData);
      if (Date.now() - auth.timestamp < 10800000) {
        return auth.password;
      } else {
        sessionStorage.removeItem('master_pass_auth');
      }
    }

    const { value: password } = await Swal.fire({
      title: 'Acesso Restrito',
      text: 'Insira a senha do sistema para visualizar o prospeccao:',
      input: 'password',
      inputPlaceholder: 'Senha mestre',
      showCancelButton: true,
      confirmButtonText: 'Acessar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      showLoaderOnConfirm: true,
      preConfirm: async (pass) => {
        try {
          const fd = new FormData();
          fd.append('pass', pass);
          const response = await fetch('/api_documentos.php?action=verify_password', {
            method: 'POST',
            body: fd
          });
          const data = await response.json();
          if (!data.success) {
            Swal.showValidationMessage('Senha incorreta.');
          }
          return pass;
        } catch (error) {
          Swal.showValidationMessage('Erro ao verificar senha.');
        }
      },
      allowOutsideClick: () => !Swal.isLoading()
    });

    if (password) {
      sessionStorage.setItem('master_pass_auth', JSON.stringify({ password, timestamp: Date.now() }));
      return password;
    }
    return null;
  };

  const viewContract = async (prospeccao: EditorProspeccaoDoc) => {
    const password = await getMasterPassword();
    if (password) {
      if (prospeccao.link) {
        let url = prospeccao.link;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        window.open(url, '_blank');
      } else if (prospeccao.documentoId) {
        const url = `/api_documentos.php?action=view&file_id=${prospeccao.documentoId}&pass=${password}`;
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(prospeccao.documentoNome || '');
        if (isImage) {
          Swal.fire({
            title: prospeccao.documentoNome || 'Prospecção',
            imageUrl: url,
            imageAlt: 'Prospecção Assinada',
            width: '80%',
            showConfirmButton: false,
            showCloseButton: true
          });
        } else {
          window.open(url, '_blank');
        }
      }
    }
  };

  return (
    <div style={{ padding: window.innerWidth <= 768 ? '1rem' : '2rem' }}>
      <div style={{
        display: 'flex',
        flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
        gap: window.innerWidth <= 768 ? '1.5rem' : '1rem',
        justifyContent: 'space-between',
        alignItems: window.innerWidth <= 768 ? 'stretch' : 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: 0 }}>Gestão de Prospecções</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>Gerencie prospecções integradas com o banco de clientes.</p>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
          gap: '1rem',
          width: window.innerWidth <= 768 ? '100%' : 'auto',
          alignItems: 'center'
        }}>

          <button onClick={() => setIsGerenciadorOpen(true)} className="btn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <Settings size={18} /> Gerenciar Modelos
          </button>
          <button onClick={() => setIsGeradorOpen(true)} className="btn btn-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <Plus size={18} /> Nova Prospecção
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '400px', position: 'relative', display: 'block' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar por Clínica ou cliente..." 
              style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <select
              value={responsibleFilter}
              onChange={(e) => setResponsibleFilter(e.target.value)}
              style={{ padding: '0.6rem 2rem 0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white', appearance: 'none', minWidth: '150px' }}
            >
              <option value="">Todos os Responsáveis</option>
              {uniqueResponsibles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Período:</span>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white' }}
            >
              <option value="all">Qualquer Período</option>
              <option value="this_month">Este Mês</option>
              <option value="last_month">Mês Passado</option>
              <option value="this_year">Este Ano</option>
              <option value="custom">Personalizado</option>
            </select>
            {periodType === 'custom' && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white', maxWidth: '140px' }}
                  title="Data Inicial"
                />
                <span style={{ color: 'var(--text-secondary)' }}>até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white', maxWidth: '140px' }}
                  title="Data Final"
                />
              </>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.6rem 2rem 0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', backgroundColor: 'white', appearance: 'none', minWidth: '150px' }}
            >
              <option value="">Todos os Status</option>
              <option value="entregue">Entregues</option>
              <option value="pendente">Não Entregues</option>
            </select>
          </div>
          {(periodType !== 'all' || startDate || endDate || statusFilter || responsibleFilter || searchTerm) && (
            <button 
              onClick={() => { setPeriodType('all'); setStartDate(''); setEndDate(''); setStatusFilter(''); setResponsibleFilter(''); setSearchTerm(''); }} 
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', padding: '0.5rem' }}
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Clínica</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Cliente</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Responsável</th>
                <th style={{ padding: '1rem' }}>Data da Prospecção</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {prospeccoes
                .filter(c => {
                  const clienteNome = c.clienteId && prospectsMap[c.clienteId]?.ownerName ? prospectsMap[c.clienteId].ownerName : c.clienteNome || '';
                  const titulo = c.clienteId && prospectsMap[c.clienteId]?.clinicName ? prospectsMap[c.clienteId].clinicName : c.titulo || '';
                  return clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) || titulo.toLowerCase().includes(searchTerm.toLowerCase());
                })
                .filter(c => {
                  if (!responsibleFilter) return true;
                  const resp = c.clienteId ? prospectsMap[c.clienteId]?.responsible : null;
                  return resp === responsibleFilter;
                })
                .filter(c => {
                  if (periodType === 'all') return true;
                  const cDateStr = c.dataAssinatura ? c.dataAssinatura.substring(0, 10) : '';
                  if (!cDateStr) return false;

                  const parts = cDateStr.split('-');
                  if (parts.length !== 3) return false;
                  
                  const cYear = parseInt(parts[0], 10);
                  const cMonth = parseInt(parts[1], 10);

                  const today = new Date();
                  const tYear = today.getFullYear();
                  const tMonth = today.getMonth() + 1;

                  if (periodType === 'this_month') {
                    return cYear === tYear && cMonth === tMonth;
                  }
                  if (periodType === 'last_month') {
                    const lYear = tMonth === 1 ? tYear - 1 : tYear;
                    const lMonth = tMonth === 1 ? 12 : tMonth - 1;
                    return cYear === lYear && cMonth === lMonth;
                  }
                  if (periodType === 'this_year') {
                    return cYear === tYear;
                  }
                  if (periodType === 'custom') {
                    if (startDate && cDateStr < startDate) return false;
                    if (endDate && cDateStr > endDate) return false;
                    return true;
                  }

                  return true;
                })
                .filter(c => {
                  if (!statusFilter) return true;
                  if (statusFilter === 'entregue') return c.isEntregue === true;
                  if (statusFilter === 'pendente') return !c.isEntregue;
                  return true;
                })
                .map(prospeccao => (
                <tr key={prospeccao.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => handleOpenGerador(prospeccao)} className="prospeccao-row-hover">
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                      {(prospeccao.clienteId && prospectsMap[prospeccao.clienteId]?.clinicName) || prospeccao.titulo || 'Prospecção'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>
                    {(prospeccao.clienteId && prospectsMap[prospeccao.clienteId]?.ownerName) || prospeccao.clienteNome}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {prospeccao.clienteId && prospectsMap[prospeccao.clienteId]?.responsible ? (
                      <span style={{ backgroundColor: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem', color: '#475569', fontWeight: '500' }}>
                        {prospectsMap[prospeccao.clienteId].responsible}
                      </span>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.85rem' }}>Sem Líder</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        {(() => { try { return new Date(prospeccao.dataAssinatura).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); } catch { return '—'; } })()}
                      </span>
                      {prospeccao.isEntregue && (
                        <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                          ENTREGUE
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={(e) => { e.stopPropagation(); if(prospeccao.documentoId || prospeccao.link) viewContract(prospeccao) }} title="Ver Prospecção" style={{ background: 'none', border: 'none', color: (prospeccao.documentoId || prospeccao.link) ? 'var(--accent-color)' : '#cbd5e1', cursor: (prospeccao.documentoId || prospeccao.link) ? 'pointer' : 'not-allowed' }} disabled={!(prospeccao.documentoId || prospeccao.link)}><FileText size={18} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicate(prospeccao) }} title="Duplicar" style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}><Copy size={18} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenGerador(prospeccao) }} title="Editar" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={18} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(prospeccao) }} title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {prospeccoes.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma prospecção encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1e293b' }}>Confirmar Exclusão</h3>
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Tem certeza que deseja excluir a prospecção com <strong>{confirmDelete.clienteNome}</strong>?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {isGeradorOpen && (
        <GeradorProspeccao 
          onClose={() => { setIsGeradorOpen(false); setEditingEditorProspeccaoDoc(null); }} 
          prospeccaoParaEditar={editingEditorProspeccaoDoc}
          onSaveProspeccao={async (prospeccao) => {
            try {
              const sanitizedData = Object.fromEntries(
                Object.entries(prospeccao).filter(([_, v]) => v !== undefined)
              );

              if (editingEditorProspeccaoDoc) {
                await updateProspeccaoDoc(editingEditorProspeccaoDoc.id, sanitizedData);
                if (editingEditorProspeccaoDoc.clienteId && (sanitizedData.location || sanitizedData.fullAddress)) {
                  await updateProspect(editingEditorProspeccaoDoc.clienteId, {
                    location: sanitizedData.location || '',
                    fullAddress: sanitizedData.fullAddress || '',
                    geocodeFailed: false // Forçar recálculo no mapa
                  });
                }
              } else {
                await addProspeccaoDoc(sanitizedData as any);
              }
            } catch (e: any) {
              console.error("Erro ao salvar prospeccao:", e);
              Swal.fire({ icon: 'error', title: 'Erro ao Salvar', text: e.message || String(e) });
              return;
            }
            
            setIsGeradorOpen(false);
            setEditingEditorProspeccaoDoc(null);
          }}
        />
      )}

      {isGerenciadorOpen && (
        <GerenciadorModelosModal onClose={() => setIsGerenciadorOpen(false)} />
      )}
      <style>{`
        .prospeccao-row-hover:hover {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  );
}
