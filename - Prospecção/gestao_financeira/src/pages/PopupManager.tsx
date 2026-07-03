import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, Settings2, Image as ImageIcon, AlignLeft, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import Swal from 'sweetalert2';

export interface PopupConfig {
  id: string;
  active: boolean;
  name: string;
  targetPage: string;
  size?: 'normal' | 'large';
  triggerType: 'onload' | 'delay' | 'exit';
  triggerDelay: number;
  content: {
    title: string;
    text: string;
    mediaType: 'image' | 'video' | 'none';
    mediaUrl: string;
    buttonText: string;
    buttonLink: string;
  };
}

const PopupManager = () => {
  const [popups, setPopups] = useState<PopupConfig[]>([]);
  const [editingPopup, setEditingPopup] = useState<PopupConfig | null>(null);

  useEffect(() => {
    fetch('/api.php?key=ruth_dias_popups')
      .then(res => res.text())
      .then(text => {
        if (!text || text.trim().startsWith('<')) throw new Error('API não rodando PHP');
        let parsed = JSON.parse(text);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        setPopups(parsed || []);
      })
      .catch(() => {
        const local = localStorage.getItem('ruth_dias_popups');
        if (local) {
          try {
            let parsed = JSON.parse(local);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            setPopups(parsed || []);
          } catch (e) {
            setPopups([]);
          }
        }
      });
  }, []);

  const savePopups = (newPopups: PopupConfig[]) => {
    setPopups(newPopups);
    const dataString = JSON.stringify(newPopups);
    fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ruth_dias_popups', value: dataString })
    }).catch(() => console.log('Salvo localmente.'));
    localStorage.setItem('ruth_dias_popups', dataString);
  };

  const handleAddNew = () => {
    const newPopup: PopupConfig = {
      id: Date.now().toString(),
      active: true,
      name: 'Novo Popup ' + (popups.length + 1),
      targetPage: '/site',
      size: 'normal',
      triggerType: 'delay',
      triggerDelay: 3,
      content: {
        title: 'Bem-vindo!',
        text: 'Confira nossas oportunidades incríveis.',
        mediaType: 'none',
        mediaUrl: '',
        buttonText: 'Ver mais',
        buttonLink: '#'
      }
    };
    setEditingPopup(newPopup);
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'Tem certeza?',
      text: "Você não poderá reverter isso!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary-color)',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        savePopups(popups.filter(p => p.id !== id));
        Swal.fire('Excluído!', 'O popup foi excluído.', 'success');
      }
    });
  };

  const toggleActive = (id: string) => {
    savePopups(popups.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const handleSaveEdit = () => {
    if (!editingPopup) return;
    if (!editingPopup.name.trim()) {
      Swal.fire('Atenção', 'O nome do popup é obrigatório.', 'warning');
      return;
    }

    let newList = [...popups];
    const existingIndex = newList.findIndex(p => p.id === editingPopup.id);
    if (existingIndex >= 0) {
      newList[existingIndex] = editingPopup;
    } else {
      newList.push(editingPopup);
    }
    
    savePopups(newList);
    setEditingPopup(null);
    Swal.fire({
      icon: 'success',
      title: 'Popup salvo com sucesso',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Gerenciador de Popups</h2>
        <button className="btn btn-primary" onClick={handleAddNew} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> Novo Popup
        </button>
      </div>

      <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
        {popups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <Settings2 size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>Nenhum popup configurado ainda.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Clique em "Novo Popup" para criar a sua primeira campanha.</p>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Nome do Popup</th>
                  <th>Página Alvo</th>
                  <th>Gatilho</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {popups.map(popup => (
                  <tr key={popup.id}>
                    <td>
                      <button 
                        className="btn btn-ghost" 
                        onClick={() => toggleActive(popup.id)}
                        style={{ padding: '0.2rem', color: popup.active ? 'var(--success)' : 'var(--text-secondary)' }}
                        title={popup.active ? "Ativo" : "Inativo"}
                      >
                        {popup.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>
                    </td>
                    <td style={{ fontWeight: 500 }}>{popup.name}</td>
                    <td>{popup.targetPage === 'all' ? 'Todas as páginas' : popup.targetPage}</td>
                    <td>
                      {popup.triggerType === 'onload' && 'Ao Carregar'}
                      {popup.triggerType === 'delay' && `Atraso (${popup.triggerDelay}s)`}
                      {popup.triggerType === 'exit' && 'Intenção de Saída'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" onClick={() => setEditingPopup(popup)} style={{ padding: '0.4rem 0.6rem' }}>
                          <Settings2 size={16} /> Editar
                        </button>
                        <button className="btn btn-outline" onClick={() => handleDelete(popup.id)} style={{ padding: '0.4rem 0.6rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingPopup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem', backdropFilter: 'blur(4px)'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)' }}>
              <h3 style={{ margin: 0 }}>{popups.some(p => p.id === editingPopup.id) ? 'Editar Popup' : 'Novo Popup'}</h3>
              <button className="btn btn-ghost" onClick={() => setEditingPopup(null)} style={{ padding: '0.2rem' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="label">Nome Interno</label>
                  <input type="text" className="input" value={editingPopup.name} onChange={e => setEditingPopup({...editingPopup, name: e.target.value})} placeholder="Ex: Campanha Dia das Mães" />
                </div>
                <div>
                  <label className="label">Página de Exibição</label>
                  <select className="input" value={editingPopup.targetPage} onChange={e => setEditingPopup({...editingPopup, targetPage: e.target.value})}>
                    <option value="all">Todas as Páginas</option>
                    <option value="/site">Página Inicial (/site)</option>
                    <option value="/site-busca">Busca de Imóveis (/site-busca)</option>
                    <option value="/site-caixa">Imóveis Caixa (/site-caixa)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '8px' }}>
                <div>
                  <label className="label">Tamanho do Popup</label>
                  <select className="input" value={editingPopup.size || 'normal'} onChange={e => setEditingPopup({...editingPopup, size: e.target.value as any})}>
                    <option value="normal">Padrão</option>
                    <option value="large">Grande (Destaque)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Gatilho (Quando mostrar?)</label>
                  <select className="input" value={editingPopup.triggerType} onChange={e => setEditingPopup({...editingPopup, triggerType: e.target.value as any})}>
                    <option value="onload">Imediatamente ao carregar</option>
                    <option value="delay">Após alguns segundos</option>
                    <option value="exit">Quando o usuário for sair (Exit Intent)</option>
                  </select>
                </div>
                {editingPopup.triggerType === 'delay' && (
                  <div>
                    <label className="label">Atraso em segundos</label>
                    <input type="number" min="1" className="input" value={editingPopup.triggerDelay} onChange={e => setEditingPopup({...editingPopup, triggerDelay: Number(e.target.value)})} />
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <AlignLeft size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/> 
                  Conteúdo do Popup
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="label">Título</label>
                    <input type="text" className="input" value={editingPopup.content.title} onChange={e => setEditingPopup({...editingPopup, content: {...editingPopup.content, title: e.target.value}})} placeholder="Ex: Não perca essa oportunidade!" />
                  </div>
                  <div>
                    <label className="label">Texto descritivo</label>
                    <textarea className="input" rows={3} value={editingPopup.content.text} onChange={e => setEditingPopup({...editingPopup, content: {...editingPopup.content, text: e.target.value}})} placeholder="Mensagem do popup..." />
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <ImageIcon size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/> 
                  Mídia (Imagem/Vídeo)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="label">Tipo de Mídia</label>
                    <select className="input" value={editingPopup.content.mediaType} onChange={e => setEditingPopup({...editingPopup, content: {...editingPopup.content, mediaType: e.target.value as any}})}>
                      <option value="none">Sem Mídia</option>
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo (YouTube / Vimeo / MP4)</option>
                    </select>
                  </div>
                  {editingPopup.content.mediaType !== 'none' && (
                    <div>
                      <label className="label">URL da Mídia</label>
                      <input type="text" className="input" value={editingPopup.content.mediaUrl} onChange={e => setEditingPopup({...editingPopup, content: {...editingPopup.content, mediaUrl: e.target.value}})} placeholder={editingPopup.content.mediaType === 'image' ? "https://exemplo.com/imagem.jpg" : "https://www.youtube.com/embed/..."} />
                    </div>
                  )}
                </div>
                {editingPopup.content.mediaType === 'video' && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    <Info size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}/>
                    Para YouTube, use a URL de incorporação (embed). Ex: <code>https://www.youtube.com/embed/SEU_VIDEO_ID</code>
                  </p>
                )}
              </div>

              <div>
                <h4 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <AlignLeft size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }}/> 
                  Botão de Ação
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="label">Texto do Botão (Deixe em branco para ocultar)</label>
                    <input type="text" className="input" value={editingPopup.content.buttonText} onChange={e => setEditingPopup({...editingPopup, content: {...editingPopup.content, buttonText: e.target.value}})} placeholder="Ex: Fale com um Corretor" />
                  </div>
                  <div>
                    <label className="label">Link de Destino</label>
                    <input type="text" className="input" value={editingPopup.content.buttonLink} onChange={e => setEditingPopup({...editingPopup, content: {...editingPopup.content, buttonLink: e.target.value}})} placeholder="Ex: https://wa.me/..." />
                  </div>
                </div>
              </div>

            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setEditingPopup(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSaveEdit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Save size={18} /> Salvar Popup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PopupManager;
