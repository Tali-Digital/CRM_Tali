import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, CheckCircle, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface ContaReceber {
  id: string;
  descricao: string;
  cliente: string;
  valor: number;
  valorVGV?: number;
  porcentagemComissao?: number;
  vencimento: string;
  dataVenda?: string;
  status: 'Pendente' | 'Recebido' | 'Atrasado';
  dataCriacao?: string;
}

export default function ContasReceber() {
  const [contas, setContas] = useState<ContaReceber[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [mesAtual, setMesAtual] = useState('06/2026');

  const changeMonth = (delta: number) => {
    const [mm, yyyy] = mesAtual.split('/');
    let date = new Date(Number(yyyy), Number(mm) - 1 + delta, 1);
    const newMm = String(date.getMonth() + 1).padStart(2, '0');
    const newYyyy = date.getFullYear();
    setMesAtual(`${newMm}/${newYyyy}`);
  };
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaReceber | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContaReceber | null>(null);
  const [deleteOption, setDeleteOption] = useState<'single'|'all'>('single');
  const [confirmReceive, setConfirmReceive] = useState<ContaReceber | null>(null);

  useEffect(() => {
    if (confirmDelete) setDeleteOption('single');
  }, [confirmDelete]);

  const [formData, setFormData] = useState<Omit<ContaReceber, 'id' | 'status'>>({
    descricao: '',
    cliente: '',
    valor: 0,
    valorVGV: 0,
    porcentagemComissao: 0,
    vencimento: '',
    dataVenda: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api.php?key=ruth_dias_contas_receber');
        const text = await res.text();
        if (text && !text.startsWith('<')) {
          let parsed = JSON.parse(text);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(c => c.status !== 'Recebido');
            setContas(filtered);
          }
        } else {
          const local = localStorage.getItem('ruth_dias_contas_receber');
          if (local) {
            let parsed = JSON.parse(local);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (Array.isArray(parsed)) {
              const filtered = parsed.filter(c => c.status !== 'Recebido');
              setContas(filtered);
            }
          }
        }
      } catch(e) {}
    };
    loadData();
  }, []);

  const saveToApi = async (data: ContaReceber[]) => {
    setContas(data);
    localStorage.setItem('ruth_dias_contas_receber', JSON.stringify(data));
    await fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ruth_dias_contas_receber', value: JSON.stringify(data) })
    }).catch(() => {});
  };

  const handleMarkAsReceived = (conta: ContaReceber) => {
    setConfirmReceive(conta);
  };

  const executeMarkAsReceived = async () => {
    if (confirmReceive) {
      // Remove da lista de pendentes e salva na API
      const updatedContas = contas.filter(c => c.id !== confirmReceive.id);
      saveToApi(updatedContas);

      try {
        const resH = await fetch('/api.php?key=ruth_dias_historico_pagamentos');
        const txtH = await resH.text();
        let hist = [];
        if (txtH && !txtH.startsWith('<')) {
          let p = JSON.parse(txtH);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) hist = p;
        }
        hist.push({
          id: `hr-${Date.now()}`,
          originalId: confirmReceive.id,
          descricao: confirmReceive.descricao,
          fornecedor: confirmReceive.cliente,
          valor: confirmReceive.valor,
          dataPagamento: new Date().toISOString().split('T')[0],
          tipo: 'Entrada',
          valorVGV: confirmReceive.valorVGV,
          porcentagemComissao: confirmReceive.porcentagemComissao
        });
        await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_historico_pagamentos', value: JSON.stringify(hist) }) });
      } catch (e) {}

      setConfirmReceive(null);
    }
  };

  const handleOpenModal = (conta?: ContaReceber) => {
    if (conta) {
      setEditingConta(conta);
      setFormData({
        descricao: conta.descricao,
        cliente: conta.cliente,
        valor: conta.valor,
        valorVGV: conta.valorVGV || 0,
        porcentagemComissao: conta.porcentagemComissao || 0,
        vencimento: conta.vencimento,
        dataVenda: conta.dataVenda || new Date().toISOString().split('T')[0]
      });
    } else {
      setEditingConta(null);
      setFormData({ descricao: '', cliente: '', valor: 0, valorVGV: 0, porcentagemComissao: 0, vencimento: '', dataVenda: new Date().toISOString().split('T')[0] });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.descricao || formData.valor <= 0) return alert('Preencha descrição e valor!');
    let newContas = [];
    if (editingConta) {
      newContas = contas.map(c => c.id === editingConta.id ? { ...c, ...formData } : c);
    } else {
      newContas = [...contas, { ...formData, id: `rec-${Date.now()}`, status: 'Pendente' as const, dataCriacao: new Date().toISOString().split('T')[0] }];
    }
    saveToApi(newContas);
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (confirmDelete) {
      let newContas = contas;
      const match = confirmDelete.descricao.match(/\(Mensal (\d+)\/(\d+)\)(.*)/);
      
      if (match && deleteOption === 'all') {
        const baseCurrent = parseInt(match[1]);
        const suffix = match[3];
        
        newContas = contas.filter(c => {
          const m = c.descricao.match(/\(Mensal (\d+)\/(\d+)\)(.*)/);
          if (m && m[3] === suffix) {
            const current = parseInt(m[1]);
            if (current >= baseCurrent) {
              return false;
            }
          }
          return c.id !== confirmDelete.id;
        });
      } else {
        newContas = contas.filter(c => c.id !== confirmDelete.id);
      }
      
      saveToApi(newContas);
      setConfirmDelete(null);
    }
  };

  const displayedContas = contas.filter(c => {
    const matchesSearch = c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.cliente.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesMonth = false;
    if (c.vencimento) {
      const parts = c.vencimento.split('-');
      if (parts.length >= 2) {
        matchesMonth = `${parts[1]}/${parts[0]}` === mesAtual;
      }
    }
    return matchesSearch && matchesMonth;
  });

  const totalReceber = displayedContas.reduce((acc, curr) => acc + curr.valor, 0);

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Contas a Receber & Comissões</h1>
          <p className="page-subtitle">Gerencie comissões, vendas e entradas baseadas nos seus clientes.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}><ChevronLeft size={16}/></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500, minWidth: '110px', justifyContent: 'center' }}>
              <Calendar size={16} /> Mês: {mesAtual}
            </div>
            <button onClick={() => changeMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}><ChevronRight size={16}/></button>
          </div>
          <button onClick={() => handleOpenModal()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Nova Receita
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid #16a34a', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total a Receber ({mesAtual})</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0f172a' }}>{totalReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar por descrição ou cliente..." 
              style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' }}>
            <Filter size={18} /> Filtrar
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem' }}>Descrição / Imóvel</th>
                <th style={{ padding: '1rem' }}>Cliente</th>
                <th style={{ padding: '1rem' }}>Vencimento</th>
                <th style={{ padding: '1rem' }}>Valor</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {displayedContas.map(conta => (
                <tr key={conta.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{conta.descricao}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{conta.cliente}</td>
                  <td style={{ padding: '1rem' }}>{conta.vencimento ? new Date(conta.vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold', color: '#16a34a' }}>
                    {conta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '0.3rem 0.6rem', 
                      borderRadius: '999px', 
                      fontSize: '0.8rem', 
                      fontWeight: '600',
                      backgroundColor: conta.status === 'Recebido' ? '#dcfce7' : conta.status === 'Atrasado' ? '#fee2e2' : '#fef9c3',
                      color: conta.status === 'Recebido' ? '#166534' : conta.status === 'Atrasado' ? '#991b1b' : '#854d0e'
                    }}>
                      {conta.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button onClick={() => handleMarkAsReceived(conta)} title="Marcar como Recebido" style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer' }}><CheckCircle size={18} /></button>
                      <button onClick={() => handleOpenModal(conta)} title="Editar" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><Edit2 size={18} /></button>
                      <button onClick={() => setConfirmDelete(conta)} title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {displayedContas.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma conta a receber encontrada neste mês.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{editingConta ? 'Editar Receita' : 'Nova Receita'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-secondary)" /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Descrição / Título</label>
                <input type="text" className="input" value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} placeholder="Ex: Comissão Venda - Casa Centro" />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Cliente Pagador</label>
                <input type="text" className="input" value={formData.cliente} onChange={e => setFormData({...formData, cliente: e.target.value})} placeholder="Ex: João da Silva" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Valor do Imóvel (VGV)</label>
                  <input type="number" step="0.01" className="input" value={formData.valorVGV || ''} onChange={e => {
                    const vgv = Number(e.target.value);
                    const pct = formData.porcentagemComissao || 0;
                    setFormData({...formData, valorVGV: vgv, valor: pct > 0 ? (vgv * pct / 100) : formData.valor});
                  }} placeholder="Opcional" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Comissão (%)</label>
                  <input type="number" step="0.01" className="input" value={formData.porcentagemComissao || ''} onChange={e => {
                    const pct = Number(e.target.value);
                    const vgv = formData.valorVGV || 0;
                    setFormData({...formData, porcentagemComissao: pct, valor: vgv > 0 ? (vgv * pct / 100) : formData.valor});
                  }} placeholder="Opcional" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Valor a Receber (R$)</label>
                <input type="number" step="0.01" className="input" value={formData.valor || ''} onChange={e => setFormData({...formData, valor: Number(e.target.value)})} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Data da Venda</label>
                  <input type="date" className="input" value={formData.dataVenda || ''} onChange={e => setFormData({...formData, dataVenda: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Data de Recebimento</label>
                  <input type="date" className="input" value={formData.vencimento} onChange={e => setFormData({...formData, vencimento: e.target.value})} />
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSave} style={{ marginTop: '1rem', width: '100%' }}>
                {editingConta ? 'Salvar Alterações' : 'Adicionar Receita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1e293b' }}>Confirmar Exclusão</h3>
            
            {confirmDelete.descricao.match(/\(Mensal (\d+)\/(\d+)\)/) ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: '#475569', marginBottom: '1rem' }}>Este é um recebimento recorrente. Como deseja prosseguir?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#334155' }}>
                    <input 
                      type="radio" 
                      checked={deleteOption === 'single'} 
                      onChange={() => setDeleteOption('single')}
                    />
                    Apagar apenas esta parcela
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#334155' }}>
                    <input 
                      type="radio" 
                      checked={deleteOption === 'all'} 
                      onChange={() => setDeleteOption('all')}
                    />
                    Apagar esta e todas as seguintes
                  </label>
                </div>
              </div>
            ) : (
              <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Tem certeza que deseja excluir esta receita pendente?</p>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {confirmReceive && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1e293b' }}>Confirmar Recebimento</h3>
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Tem certeza que deseja marcar <strong>"{confirmReceive.descricao}"</strong> como Recebido?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmReceive(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
              <button onClick={executeMarkAsReceived} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
