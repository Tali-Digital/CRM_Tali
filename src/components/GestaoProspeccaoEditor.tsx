import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, CheckCircle, Clock, Settings, Bot } from 'lucide-react';
import Swal from 'sweetalert2';
import GeradorProspeccao from './GeradorProspeccao';
import GerenciadorModelosModal from './GerenciadorModelosModal';



import { subscribeToProspeccaoDocs, deleteProspeccaoDoc } from '../services/firestoreService';
import { EditorProspeccaoDoc } from '../types';

export default function GestaoProspeccaoEditor() {
  const [prospeccoes, setProspeccoes] = useState<EditorProspeccaoDoc[]>([]);
  const [clientes, setClientes] = useState<{id: string, name: string}[]>([]);
  const [imoveis, setImoveis] = useState<{id: string, title: string, source: 'caixa'|'particular'}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isGeradorOpen, setIsGeradorOpen] = useState(false);
  const [isGerenciadorOpen, setIsGerenciadorOpen] = useState(false);
  const [editingEditorProspeccaoDoc, setEditingEditorProspeccaoDoc] = useState<EditorProspeccaoDoc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EditorProspeccaoDoc | null>(null);


  useEffect(() => {
    const unsubscribe = subscribeToProspeccaoDocs(docs => setProspeccoes(docs));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      // Carregar Clientes do Kanban
      try {
        const resK = await fetch('/api.php?key=ruth_dias_kanban');
        const txtK = await resK.text();
        if (txtK && !txtK.startsWith('<')) {
          let parsed = JSON.parse(txtK);
          while (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (parsed && parsed.clients && parsed.columns) {
            // Find active client IDs from columns
            const activeIds = new Set<string>();
            Object.values(parsed.columns).forEach((col: any) => {
              if (Array.isArray(col.clientIds)) {
                col.clientIds.forEach((id: string) => activeIds.add(id));
              }
            });
            
            const clientsArray = Object.values(parsed.clients)
              .filter((c: any) => activeIds.has(c.id))
              .map((c: any) => ({ id: c.id, name: c.name, documents: c.documents || [] }));
            setClientes(clientsArray);
          }
        }
      } catch (e) {}

      // Carregar Imóveis
      try {
        const allProps: {id: string, title: string, source: 'caixa'|'particular'}[] = [];
        
        // Portfolio local
        const resP = await fetch('/api.php?key=ruth_dias_portfolio');
        const txtP = await resP.text();
        if (txtP && !txtP.startsWith('<')) {
          let parsed = JSON.parse(txtP);
          while (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) {
            parsed.forEach((p: any) => {
              let displayTitle = p.title;
              if (p.city && p.neighborhood) {
                displayTitle = `${p.city.toUpperCase()} | ${p.neighborhood.toUpperCase()} | ${p.title}`;
              }
              allProps.push({ id: p.id, title: displayTitle, source: 'particular' });
            });
          }
        }

        // Imóveis Caixa
        let dataCaixa: any = null;
        try {
          const resC = await fetch('/api.php?key=ruth_dias_properties');
          const txtC = await resC.text();
          if (txtC && !txtC.startsWith('<')) {
            let parsed = JSON.parse(txtC);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            dataCaixa = parsed;
          }
        } catch (e) {}

        if (!dataCaixa || !dataCaixa.db || Object.keys(dataCaixa.db).length === 0) {
          const local = localStorage.getItem('ruth_dias_properties');
          if (local) {
            let parsed = JSON.parse(local);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            dataCaixa = parsed;
          }
        }

        if (dataCaixa && dataCaixa.db) {
          Object.values(dataCaixa.db).forEach((list: any) => {
            if (Array.isArray(list)) {
              list.forEach((p: any) => {
                let displayTitle = p.title || p.address || 'Imóvel Caixa';
                if (p.city && p.neighborhood) {
                  displayTitle = `${p.city.toUpperCase()} | ${p.neighborhood.toUpperCase()} | ${displayTitle}`;
                }
                allProps.push({ id: p.id, title: displayTitle, source: 'caixa' });
              });
            }
          });
        }
        
        setImoveis(allProps);
      } catch (e) {}

      // Carregar EditorProspeccaoDocs
      try {
        const resC = await fetch('/api.php?key=ruth_dias_prospeccoes');
        const txtC = await resC.text();
        if (txtC && !txtC.startsWith('<')) {
          let parsed = JSON.parse(txtC);
          while (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) setProspeccoes(parsed);
        }
      } catch (e) {}
    };
    loadData();
  }, []);

  const saveToApi = async (data: EditorProspeccaoDoc[]) => {
    setProspeccoes(data);
    await fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ruth_dias_prospeccoes', value: JSON.stringify(data) })
    }).catch(() => {});
  };

  const handleOpenGerador = (prospeccao?: EditorProspeccaoDoc) => {
    if (prospeccao) {
      setEditingEditorProspeccaoDoc(prospeccao);
    } else {
      setEditingEditorProspeccaoDoc(null);
    }
    setIsGeradorOpen(true);
  };



  const handleDelete = () => {
    if (confirmDelete) {
      const newEditorProspeccaoDocs = prospeccoes.filter(c => c.id !== confirmDelete.id);
      saveToApi(newEditorProspeccaoDocs);
      setConfirmDelete(null);
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
            title: prospeccao.documentoNome || 'EditorProspeccaoDoc',
            imageUrl: url,
            imageAlt: 'EditorProspeccaoDoc Assinado',
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
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: 0 }}>Gestão de EditorProspeccaoDocs</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>Gerencie prospeccoes de venda e locação integrados com o banco de clientes.</p>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
          gap: '0.5rem',
          width: window.innerWidth <= 768 ? '100%' : 'auto'
        }}>

          <button onClick={() => setIsGerenciadorOpen(true)} className="btn" style={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: 'var(--primary-color)', padding: '0.75rem' }}>
            <Settings size={18} /> Gerenciar Modelos
          </button>
          <button onClick={() => setIsGeradorOpen(true)} className="btn btn-primary" style={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem' }}>
            <Plus size={18} /> Novo EditorProspeccaoDoc
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '400px', position: 'relative', display: 'block' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar por cliente ou imóvel..." 
              style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Título / ID</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '500' }}>Cliente</th>
                <th style={{ padding: '1rem' }}>Data da Prospecção</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {prospeccoes.filter(c => (c.clienteNome || '').toLowerCase().includes(searchTerm.toLowerCase()) || c.imovel.toLowerCase().includes(searchTerm.toLowerCase())).map(prospeccao => (
                <tr key={prospeccao.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{prospeccao.titulo || 'EditorProspeccaoDoc'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prospeccao.id}</div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{prospeccao.clienteNome}</td>
                  <td style={{ padding: '1rem' }}>{new Date(prospeccao.dataAssinatura).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={() => { if(prospeccao.documentoId || prospeccao.link) viewContract(prospeccao) }} title="Ver EditorProspeccaoDoc" style={{ background: 'none', border: 'none', color: (prospeccao.documentoId || prospeccao.link) ? 'var(--accent-color)' : '#cbd5e1', cursor: (prospeccao.documentoId || prospeccao.link) ? 'pointer' : 'not-allowed' }} disabled={!(prospeccao.documentoId || prospeccao.link)}><FileText size={18} /></button>
                      <button onClick={() => handleOpenGerador(prospeccao)} title="Editar" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={18} /></button>
                      <button onClick={() => setConfirmDelete(prospeccao)} title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {prospeccoes.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum prospeccao encontrado.</td>
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
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Tem certeza que deseja excluir o prospeccao com <strong>{confirmDelete.clienteNome}</strong>?</p>
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
          clientes={clientes} 
          imoveis={imoveis} 
          prospeccaoParaEditar={editingEditorProspeccaoDoc}
          onSaveProspeccao={async (prospeccao) => {
            let clienteFinal = prospeccao.clienteId;
            let clienteNomeFinal = prospeccao.clienteNome;
            
            const clienteExiste = clientes.find(c => c.name === clienteNomeFinal || c.id === clienteFinal);
            
            if (!clienteExiste && clienteNomeFinal) {
              const novoId = `client-${Date.now()}`;
              clienteFinal = novoId;
              
              try {
                const resK = await fetch('/api.php?key=ruth_dias_kanban');
                const txtK = await resK.text();
                if (txtK && !txtK.startsWith('<')) {
                  let parsedKanban = JSON.parse(txtK);
                  while (typeof parsedKanban === 'string') parsedKanban = JSON.parse(parsedKanban);
                  
                  if (parsedKanban && parsedKanban.clients && parsedKanban.columns) {
                    parsedKanban.clients[novoId] = {
                      id: novoId,
                      name: clienteNomeFinal,
                      phone: '',
                      email: '',
                      notes: `Cliente criado via Gestão de EditorProspeccaoDocs.\nEditorProspeccaoDoc: ${prospeccao.titulo || 'Sem Título'}\nValor: R$ ${prospeccao.valor}\nData: ${new Date().toLocaleDateString('pt-BR')}`,
                      documents: []
                    };
                    
                    const firstColId = Object.keys(parsedKanban.columns)[0];
                    if (firstColId) {
                      parsedKanban.columns[firstColId].clientIds.push(novoId);
                    }
                    
                    await fetch('/api.php', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        key: 'ruth_dias_kanban',
                        value: JSON.stringify(parsedKanban)
                      })
                    });
                    
                    setClientes(prev => [...prev, { id: novoId, name: clienteNomeFinal }]);
                  }
                }
              } catch (e) {
                console.error("Erro ao salvar cliente novo no kanban", e);
              }
            }
            
            prospeccao.clienteId = clienteFinal;
            
            let newEditorProspeccaoDocs = [];
            if (editingEditorProspeccaoDoc) {
              newEditorProspeccaoDocs = prospeccoes.map(c => c.id === editingEditorProspeccaoDoc.id ? { ...c, ...prospeccao } : c);
            } else {
              const newEditorProspeccaoDoc = { ...prospeccao, id: `ct-${Date.now()}` };
              newEditorProspeccaoDocs = [...prospeccoes, newEditorProspeccaoDoc];
            }
            await saveToApi(newEditorProspeccaoDocs);
            setIsGeradorOpen(false);
            setEditingEditorProspeccaoDoc(null);
          }}
        />
      )}

      {isGerenciadorOpen && (
        <GerenciadorModelosModal onClose={() => setIsGerenciadorOpen(false)} />
      )}
    </div>
  );
}
