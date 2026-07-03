import { useState, useEffect } from 'react';
import { X, Edit2, Trash2, Save, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { subscribeToModelosProspeccao, updateModeloProspeccao, deleteModeloProspeccao } from '../services/firestoreService';

interface ModeloProspeccao {
  id: string;
  nome: string;
  conteudo: string;
}

interface Props {
  onClose: () => void;
}

export default function GerenciadorModelosModal({ onClose }: Props) {
  const [modelos, setModelos] = useState<ModeloProspeccao[]>([]);
  const [editingId, setEditingId] = useState('');
  const [editNome, setEditNome] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToModelosProspeccao(setModelos);
    return () => unsubscribe();
  }, []);

  const saveModelos = async (novosModelos: any[]) => {
    // Deprecated for Firebase
  };

  const handleDelete = async (id: string) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Excluir Modelo?',
      text: 'Tem certeza que deseja excluir este modelo permanentemente?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });
    
    if (isConfirmed) {
      await deleteModeloProspeccao(id);
      Swal.fire({
        title: 'Excluído!',
        text: 'O modelo foi removido.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  const handleStartEdit = (m: ModeloProspeccao) => {
    setEditingId(m.id);
    setEditNome(m.nome);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editNome.trim()) return;
    await updateModeloProspeccao(id, { nome: editNome });
    setEditingId('');
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500 }}>
      <div style={{ backgroundColor: '#f8fafc', width: '90%', maxWidth: '600px', maxHeight: '80vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--primary-color)" />
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-color)' }}>Gerenciar Modelos</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-secondary)" /></button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {modelos.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum modelo salvo ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {modelos.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  {editingId === m.id ? (
                    <div style={{ display: 'flex', flex: 1, gap: '0.5rem', marginRight: '1rem' }}>
                      <input 
                        type="text" 
                        value={editNome} 
                        onChange={e => setEditNome(e.target.value)} 
                        className="input" 
                        style={{ flex: 1, padding: '0.4rem 0.8rem', outline: 'none' }}
                        autoFocus
                        onKeyDown={e => { if(e.key === 'Enter') handleSaveEdit(m.id) }}
                      />
                      <button onClick={() => handleSaveEdit(m.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }} title="Salvar">
                        <Save size={16} />
                      </button>
                      <button onClick={() => setEditingId('')} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} title="Cancelar">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{m.nome}</div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleStartEdit(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} title="Renomear">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} title="Excluir">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
