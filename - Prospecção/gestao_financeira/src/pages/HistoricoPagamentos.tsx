import { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, RotateCcw } from 'lucide-react';

interface HistoricoPago {
  id: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  dataPagamento: string;
  tipo: 'Entrada' | 'Saída';
  originalId?: string;
}

export default function HistoricoPagamentos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [anoFiltro, setAnoFiltro] = useState('2026');
  const [historicoPagas, setHistoricoPagas] = useState<HistoricoPago[]>([]);

  const loadHistorico = async () => {
    try {
      let history: HistoricoPago[] = [];

      // Buscar Contas a Receber (Entradas)
      const resRec = await fetch(`/api.php?key=ruth_dias_contas_receber&t=${Date.now()}`);
      const textRec = await resRec.text();
      if (textRec && !textRec.startsWith('<')) {
        let parsed = JSON.parse(textRec);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (Array.isArray(parsed)) {
          const recebidas = parsed.filter(c => c.status === 'Recebido').map(c => ({
            id: c.id,
            originalId: c.id,
            descricao: c.descricao,
            fornecedor: c.cliente,
            valor: c.valor,
            dataPagamento: c.vencimento,
            tipo: 'Entrada' as const
          }));
          history = [...history, ...recebidas];
        }
      }

      // Buscar Contas Pagas (Saídas salvas no histórico)
      const resPag = await fetch(`/api.php?key=ruth_dias_historico_pagamentos&t=${Date.now()}`);
      const textPag = await resPag.text();
      if (textPag && !textPag.startsWith('<')) {
        let parsed = JSON.parse(textPag);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (Array.isArray(parsed)) {
          history = [...history, ...parsed];
        }
      }

      // Ordenar do mais recente pro mais antigo
      history.sort((a, b) => new Date(b.dataPagamento).getTime() - new Date(a.dataPagamento).getTime());
      setHistoricoPagas(history);
    } catch (err) {
      console.error("Erro ao carregar histórico", err);
    }
  };

  useEffect(() => {
    loadHistorico();
  }, []);

  const [confirmUndoItem, setConfirmUndoItem] = useState<HistoricoPago | null>(null);

  const handleUndo = (item: HistoricoPago) => {
    setConfirmUndoItem(item);
  };

  const executeUndo = async () => {
    if (!confirmUndoItem) return;
    const item = confirmUndoItem;

    // Remover do Histórico Geral (vale para Entrada e Saída)
    try {
      const res = await fetch(`/api.php?key=ruth_dias_historico_pagamentos&t=${Date.now()}`);
      const txt = await res.text();
      if (txt && !txt.startsWith('<')) {
        let parsed = JSON.parse(txt);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (Array.isArray(parsed)) {
          const updated = parsed.filter(c => c.id !== item.id);
          await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_historico_pagamentos', value: JSON.stringify(updated) }) });
        }
      }
    } catch(e) {}

    if (item.tipo === 'Entrada') {
      try {
        const res = await fetch(`/api.php?key=ruth_dias_contas_receber&t=${Date.now()}`);
        const txt = await res.text();
        let parsed = [];
        if (txt && !txt.startsWith('<')) {
          let p = JSON.parse(txt);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) parsed = p;
        }
        
        // Colocar de volta na contas a receber
        parsed.push({
          id: item.originalId || `rec-${Date.now()}`,
          descricao: item.descricao,
          cliente: item.fornecedor,
          valor: item.valor,
          vencimento: item.dataPagamento,
          status: 'Pendente'
        });
        
        await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_contas_receber', value: JSON.stringify(parsed) }) });
      } catch(e) {}
    } else {
      if (item.originalId) {
        if (item.originalId.startsWith('m')) {
          try {
            const resM = await fetch(`/api.php?key=ruth_dias_contas_pagar_manual&t=${Date.now()}`);
            const txtM = await resM.text();
            if (txtM && !txtM.startsWith('<')) {
              let p = JSON.parse(txtM);
              if (typeof p === 'string') p = JSON.parse(p);
              if (Array.isArray(p)) {
                const updated = p.map(c => c.id === item.originalId ? { ...c, status: 'Pendente' } : c);
                await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_contas_pagar_manual', value: JSON.stringify(updated) }) });
              }
            }
          } catch(e) {}
        } else {
          try {
            const resS = await fetch(`/api.php?key=ruth_dias_status_pagamentos&t=${Date.now()}`);
            const txtS = await resS.text();
            if (txtS && !txtS.startsWith('<')) {
              let p = JSON.parse(txtS);
              if (typeof p === 'string') p = JSON.parse(p);
              if (p && typeof p === 'object') {
                const updated = { ...p };
                delete updated[item.originalId];
                await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_status_pagamentos', value: JSON.stringify(updated) }) });
              }
            }
          } catch(e) {}
        }
      }
    }
    
    setConfirmUndoItem(null);
    loadHistorico();
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: 0 }}>Histórico de Transações</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>Verifique todos os pagamentos e recebimentos efetuados ao longo dos anos.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>Ano:</label>
          <select 
            className="input" 
            style={{ width: '120px' }} 
            value={anoFiltro} 
            onChange={(e) => setAnoFiltro(e.target.value)}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar no histórico..." 
              style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' }}>
            <Filter size={18} /> Mês/Tipo
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem' }}>Descrição</th>
                <th style={{ padding: '1rem' }}>Credor / Funcionário</th>
                <th style={{ padding: '1rem' }}>Tipo</th>
                <th style={{ padding: '1rem' }}>Data do Pagamento</th>
                <th style={{ padding: '1rem' }}>Valor Pago</th>
                <th style={{ padding: '1rem' }}>Recibo</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {historicoPagas
                .filter(c => c.dataPagamento.includes(anoFiltro))
                .filter(c => c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || c.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{item.descricao}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{item.fornecedor}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '0.3rem 0.6rem', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem', 
                      backgroundColor: item.tipo === 'Entrada' ? '#dcfce7' : '#fee2e2',
                      color: item.tipo === 'Entrada' ? '#166534' : '#991b1b',
                      fontWeight: 'bold'
                    }}>
                      {item.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {new Date(item.dataPagamento).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 'bold', color: item.tipo === 'Entrada' ? '#16a34a' : '#0f172a' }}>
                    {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#16a34a', fontSize: '0.875rem', fontWeight: '600' }}>
                      <CheckCircle size={16} /> Verificado
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleUndo(item)} 
                      title="Estornar (Voltar para Pendente)" 
                      style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: '500' }}
                    >
                      <RotateCcw size={16} /> Estornar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmUndoItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1e293b' }}>Confirmar Estorno</h3>
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Deseja estornar <strong>"{confirmUndoItem.descricao}"</strong>?<br/><br/><small>A transação sairá do histórico e voltará para o status de Pendente na aba correspondente.</small></p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmUndoItem(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
              <button onClick={executeUndo} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#f59e0b', color: 'white', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><RotateCcw size={16} /> Estornar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
