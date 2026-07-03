
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import ClientDashboard from './ClientDashboard';

const Dashboard = () => {
  const { user: currentUser } = useAuth();
  const [faturamentoMes, setFaturamentoMes] = useState(0);
  const [despesasPagasMes, setDespesasPagasMes] = useState(0);
  const [contasPendentes, setContasPendentes] = useState(0);
  const [vgvMes, setVgvMes] = useState(0);
  const [historicoRecente, setHistoricoRecente] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'cliente') return;

    const loadData = async () => {
      try {
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const monthPrefix = `${yyyy}-${mm}`;

        // 1. Histórico de Pagamentos (Receitas e Despesas Pagas)
        let hist: any[] = [];
        try {
          const resH = await fetch('/api.php?key=ruth_dias_historico_pagamentos');
          const txtH = await resH.text();
          if (txtH && !txtH.startsWith('<')) {
            let p = JSON.parse(txtH);
            if (typeof p === 'string') p = JSON.parse(p);
            if (Array.isArray(p)) hist = p;
          }
        } catch (e) {}

        const receitas = hist
          .filter(c => c.tipo === 'Entrada' && c.dataPagamento && c.dataPagamento.startsWith(monthPrefix))
          .reduce((acc, c) => acc + c.valor, 0);

        const despesas = hist
          .filter(c => c.tipo === 'Saída' && c.dataPagamento && c.dataPagamento.startsWith(monthPrefix))
          .reduce((acc, c) => acc + c.valor, 0);

        // 2. Contas Manuais Pendentes
        let manuaisPendentes = 0;
        try {
          const resM = await fetch('/api.php?key=ruth_dias_contas_pagar_manual');
          const txtM = await resM.text();
          if (txtM && !txtM.startsWith('<')) {
            let p = JSON.parse(txtM);
            if (typeof p === 'string') p = JSON.parse(p);
            if (Array.isArray(p)) {
              manuaisPendentes = p.filter((c: any) => c.status !== 'Pago').reduce((acc: number, c: any) => acc + c.valor, 0);
            }
          }
        } catch (e) {}

        // 3. VGV do Mês (das contas a receber criadas no mês)
        let vgv = 0;
        try {
          const resR = await fetch('/api.php?key=ruth_dias_contas_receber');
          const txtR = await resR.text();
          if (txtR && !txtR.startsWith('<')) {
            let p = JSON.parse(txtR);
            if (typeof p === 'string') p = JSON.parse(p);
            if (Array.isArray(p)) {
              vgv = p
                .filter((c: any) => {
                  let dt = c.dataVenda;
                  if (!dt) dt = c.dataCriacao;
                  if (!dt && c.id && c.id.startsWith('rec-')) {
                    const ts = parseInt(c.id.split('-')[1]);
                    if (!isNaN(ts)) dt = new Date(ts).toISOString().split('T')[0];
                  }
                  if (!dt) dt = c.vencimento;
                  return dt && dt.startsWith(monthPrefix);
                })
                .reduce((acc: number, c: any) => acc + (Number(c.valorVGV) || 0), 0);
            }
          }
        } catch (e) {}

        setFaturamentoMes(receitas);
        setDespesasPagasMes(despesas);
        setContasPendentes(manuaisPendentes);
        setVgvMes(vgv);
        setHistoricoRecente(hist.slice().reverse().slice(0, 5));

      } catch (e) {
        console.error('Erro ao carregar dados do dashboard financeiro', e);
      }
    };

    loadData();
  }, [currentUser]);

  if (currentUser?.role === 'cliente') {
    return <ClientDashboard />;
  }

  const lucroLiquido = faturamentoMes - despesasPagasMes;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: 0 }}>Visão Geral Financeira</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>Acompanhe o faturamento, despesas e lucro da imobiliária.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* VGV do Mês */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#e0e7ff', borderRadius: '12px', color: '#4f46e5' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>VGV do Mês (Vendas)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a' }}>{vgvMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Meta: 1,5M ({((vgvMes / 1500000) * 100).toFixed(1)}%)</div>
          </div>
        </div>

        {/* Faturamento do Mês */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#dcfce7', borderRadius: '12px', color: '#16a34a' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>Receitas do Mês</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a' }}>{faturamentoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
        </div>

        {/* Despesas Pagas */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#fee2e2', borderRadius: '12px', color: '#dc2626' }}>
            <TrendingDown size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>Despesas Pagas (Mês)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a' }}>{despesasPagasMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
        </div>

        {/* Lucro Líquido */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: lucroLiquido >= 0 ? '#eff6ff' : '#fee2e2', borderRadius: '12px', color: lucroLiquido >= 0 ? '#2563eb' : '#dc2626' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>Lucro Líquido (Mês)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a' }}>{lucroLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
        </div>

        {/* Contas a Pagar (Pendentes) */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: '#ffedd5', borderRadius: '12px', color: '#c2410c' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>Contas Pendentes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0f172a' }}>{contasPendentes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="var(--primary-color)" /> Transações Recentes
            </h2>
            <Link to="/painel/financeiro/historico-pagamentos" style={{ color: 'var(--primary-color)', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 500 }}>Ver Histórico Completo</Link>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {historicoRecente.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>Nenhuma transação recente encontrada.</p>
            ) : (
              historicoRecente.map((t: any) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: t.tipo === 'Entrada' ? '#dcfce7' : '#fee2e2',
                      color: t.tipo === 'Entrada' ? '#16a34a' : '#dc2626'
                    }}>
                      {t.tipo === 'Entrada' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600', color: '#334155' }}>{t.descricao}</span>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t.fornecedor} • {new Date(t.dataPagamento).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: t.tipo === 'Entrada' ? '#16a34a' : '#0f172a', fontSize: '1.1rem', fontWeight: '600' }}>
                    {t.tipo === 'Entrada' ? '+' : '-'} {Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
