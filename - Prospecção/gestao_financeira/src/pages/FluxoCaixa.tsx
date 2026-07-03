import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

interface Movimentacao {
  id: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  dataPagamento: string;
  tipo: 'Entrada' | 'Saída';
}

export default function FluxoCaixa() {
  const [resumo, setResumo] = useState({
    saldoAtual: 0.00,
    entradas: 0.00,
    saidas: 0.00,
    saldoProjetado: 0.00
  });

  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const resH = await fetch('/api.php?key=ruth_dias_historico_pagamentos');
        const txtH = await resH.text();
        let hist: Movimentacao[] = [];
        if (txtH && !txtH.startsWith('<')) {
          let p = JSON.parse(txtH);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) hist = p;
        }

        // Ordenar movimentações mais recentes primeiro
        hist.sort((a, b) => new Date(b.dataPagamento).getTime() - new Date(a.dataPagamento).getTime());
        setMovimentacoes(hist);

        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        let saldo = 0;
        let entradasMes = 0;
        let saidasMes = 0;

        hist.forEach(m => {
          if (m.tipo === 'Entrada') {
            saldo += m.valor;
            if (m.dataPagamento.startsWith(currentMonth)) entradasMes += m.valor;
          } else {
            saldo -= m.valor;
            if (m.dataPagamento.startsWith(currentMonth)) saidasMes += m.valor;
          }
        });

        // Para saldo projetado, vamos somar as contas a receber pendentes e subtrair as contas a pagar pendentes
        let projetado = saldo;

        const resR = await fetch('/api.php?key=ruth_dias_contas_receber');
        const txtR = await resR.text();
        if (txtR && !txtR.startsWith('<')) {
          let p = JSON.parse(txtR);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) {
            projetado += p.filter(c => c.status !== 'Recebido').reduce((acc, c) => acc + c.valor, 0);
          }
        }

        const resP = await fetch('/api.php?key=ruth_dias_contas_pagar_manual');
        const txtP = await resP.text();
        if (txtP && !txtP.startsWith('<')) {
          let p = JSON.parse(txtP);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) {
            projetado -= p.filter(c => c.status !== 'Pago').reduce((acc, c) => acc + c.valor, 0);
          }
        }

        setResumo({
          saldoAtual: saldo,
          entradas: entradasMes,
          saidas: saidasMes,
          saldoProjetado: projetado
        });

      } catch (e) {
        console.error('Erro ao carregar fluxo de caixa', e);
      }
    };

    loadData();
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: 0 }}>Fluxo de Caixa</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>Acompanhe o balanço financeiro e as movimentações da empresa.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem' }}>Saldo Atual</h3>
            <div style={{ backgroundColor: '#f1f5f9', padding: '0.5rem', borderRadius: '8px' }}><DollarSign size={20} color="#475569" /></div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0f172a' }}>
            {resumo.saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem' }}>Entradas (Mês)</h3>
            <div style={{ backgroundColor: '#dcfce7', padding: '0.5rem', borderRadius: '8px' }}><TrendingUp size={20} color="#16a34a" /></div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#16a34a' }}>
            {resumo.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem' }}>Saídas (Mês)</h3>
            <div style={{ backgroundColor: '#fee2e2', padding: '0.5rem', borderRadius: '8px' }}><TrendingDown size={20} color="#dc2626" /></div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#dc2626' }}>
            {resumo.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem' }}>Saldo Projetado</h3>
            <div style={{ backgroundColor: '#fef3c7', padding: '0.5rem', borderRadius: '8px' }}><Activity size={20} color="#d97706" /></div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#d97706' }}>
            {resumo.saldoProjetado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--primary-color)' }}>Últimas Movimentações (Histórico)</h3>
        
        {movimentacoes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Nenhuma movimentação registrada no histórico ainda.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem' }}>Data</th>
                  <th style={{ padding: '1rem' }}>Descrição</th>
                  <th style={{ padding: '1rem' }}>Pessoa/Empresa</th>
                  <th style={{ padding: '1rem' }}>Tipo</th>
                  <th style={{ padding: '1rem' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.slice(0, 10).map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem' }}>{new Date(m.dataPagamento).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{m.descricao}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{m.fornecedor}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem', 
                        backgroundColor: m.tipo === 'Entrada' ? '#dcfce7' : '#fee2e2',
                        color: m.tipo === 'Entrada' ? '#166534' : '#991b1b'
                      }}>
                        {m.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 'bold', color: m.tipo === 'Entrada' ? '#16a34a' : '#dc2626' }}>
                      {m.tipo === 'Entrada' ? '+' : '-'} {m.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
