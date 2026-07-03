import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingDown, TrendingUp, Wallet, Activity, Target, Users, Download, Building2, Info, AlertCircle, Clock, ArrowDownRight, ArrowUpRight, Eye } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';


export default function RelatoriosFinanceiros() {
  const [filterType, setFilterType] = useState('este_mes');
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterYear, setFilterYear] = useState(() => new Date().getFullYear().toString());
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  const [rawFaturamento, setRawFaturamento] = useState<any[]>([]);
  const [rawHistorico, setRawHistorico] = useState<any[]>([]);

  const [receitas, setReceitas] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  
  const [vgvPeriodo, setVgvPeriodo] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [propertiesCount, setPropertiesCount] = useState(0);
  const [contasPendentes, setContasPendentes] = useState(0);
  const [historicoRecente, setHistoricoRecente] = useState<any[]>([]);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        let faturamento = [];
        const resR = await fetch('/api.php?key=ruth_dias_contas_receber');
        const txtR = await resR.text();
        if (txtR && !txtR.startsWith('<')) {
          let p = JSON.parse(txtR);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) faturamento = p;
        }

        let historico = [];
        const resH = await fetch('/api.php?key=ruth_dias_historico_pagamentos');
        const txtH = await resH.text();
        if (txtH && !txtH.startsWith('<')) {
          let p = JSON.parse(txtH);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) historico = p;
        }

        setRawFaturamento(faturamento);
        setRawHistorico(historico);
        
        // Clientes
        try {
          const resK = await fetch('/api.php?key=ruth_dias_kanban');
          const txtK = await resK.text();
          if (txtK && !txtK.startsWith('<')) {
            let parsed = JSON.parse(txtK);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (parsed && parsed.clients && parsed.columns) {
              const visibleClientIds = new Set<string>();
              if (Array.isArray(parsed.columnOrder)) {
                parsed.columnOrder.forEach((colId: string) => {
                  const col = parsed.columns[colId];
                  if (col && Array.isArray(col.clientIds)) {
                    col.clientIds.forEach((id: string) => visibleClientIds.add(id));
                  }
                });
              } else {
                Object.values(parsed.columns).forEach((col: any) => {
                  if (Array.isArray(col.clientIds)) {
                    col.clientIds.forEach((id: string) => visibleClientIds.add(id));
                  }
                });
              }
              
              let count = 0;
              Object.values(parsed.clients).forEach((client: any) => {
                if (client.id && visibleClientIds.has(client.id)) count++;
              });
              setClientsCount(count);
            }
          }
        } catch(e){}

        // Imóveis
        try {
          let pCount = 0;
          const resP = await fetch('/api.php?key=ruth_dias_portfolio');
          const txtP = await resP.text();
          if (txtP && !txtP.startsWith('<')) {
            let parsed = JSON.parse(txtP);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (Array.isArray(parsed)) pCount += parsed.length;
          }
          setPropertiesCount(pCount);
        } catch(e){}

        // Contas Pendentes Manuais
        try {
          const resM = await fetch('/api.php?key=ruth_dias_contas_pagar_manual');
          const txtM = await resM.text();
          if (txtM && !txtM.startsWith('<')) {
            let parsed = JSON.parse(txtM);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (Array.isArray(parsed)) {
              const pendentes = parsed.filter((c: any) => c.status !== 'Pago').reduce((acc: number, c: any) => acc + c.valor, 0);
              setContasPendentes(pendentes);
            }
          }
        } catch (e) {}

      } catch (e) {
        console.error(e);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const today = new Date();
    let isIncluded = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      
      if (filterType === 'todo_periodo') return true;

      if (filterType === 'este_mes') {
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      }
      if (filterType === 'mes_especifico') {
        const prefix = filterMonth;
        return dateStr.startsWith(prefix);
      }
      if (filterType === 'este_ano') {
        return d.getFullYear() === today.getFullYear();
      }
      if (filterType === 'ano_especifico') {
        return d.getFullYear().toString() === filterYear;
      }
      if (filterType === 'personalizado') {
        if (filterStart && d < new Date(filterStart)) return false;
        if (filterEnd && d > new Date(filterEnd + 'T23:59:59')) return false;
        return true;
      }
      
      return true;
    };

    const filteredFat = rawFaturamento.filter(c => {
      let dt = c.dataVenda || c.dataCriacao;
      if (!dt && c.id && c.id.startsWith('rec-')) {
        const ts = parseInt(c.id.split('-')[1]);
        if (!isNaN(ts)) dt = new Date(ts).toISOString().split('T')[0];
      }
      if (!dt) dt = c.vencimento;
      return isIncluded(dt);
    });

    const filteredHist = rawHistorico.filter(c => isIncluded(c.dataPagamento || c.vencimento || c.dataEmissao));

    setReceitas(filteredFat.filter(c => c.status === 'Recebido'));
    setDespesas(filteredHist.filter(c => c.tipo === 'Saída'));

    const vgvP = filteredFat.reduce((acc: number, c: any) => acc + (Number(c.valorVGV) || 0), 0);
    setVgvPeriodo(vgvP);
    setHistoricoRecente(filteredHist.slice().reverse().slice(0, 5));
  }, [rawFaturamento, rawHistorico, filterType, filterMonth, filterYear, filterStart, filterEnd]);


  const faturamentoBruto = receitas.reduce((acc, r) => acc + r.valor, 0);
  const despesasTotais = despesas.reduce((acc, d) => acc + d.valor, 0);
  const lucroLiquido = faturamentoBruto - despesasTotais;
  
  const targetMeta = useMemo(() => {
    let months = 1;
    if (filterType === 'este_ano' || filterType === 'ano_especifico') months = 12;
    if (filterType === 'personalizado' && filterStart && filterEnd) {
      const ms = new Date(filterEnd).getTime() - new Date(filterStart).getTime();
      months = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 30)));
    }
    return 1500000 * months;
  }, [filterType, filterStart, filterEnd]);


  const fluxoCaixaAnual = useMemo(() => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const fluxo = meses.map(m => ({ name: m, Receitas: 0, Despesas: 0, Lucro: 0 }));

    receitas.forEach(r => {
      const mesIndex = new Date(r.vencimento).getMonth(); // roughly using vencimento as payment date for simplicity
      if (!isNaN(mesIndex)) fluxo[mesIndex].Receitas += r.valor;
    });

    despesas.forEach(d => {
      const dt = d.dataPagamento || d.vencimento || d.dataEmissao;
      if (dt) {
        const mesIndex = new Date(dt).getMonth();
        if (!isNaN(mesIndex)) fluxo[mesIndex].Despesas += d.valor;
      }
    });

    fluxo.forEach(f => f.Lucro = f.Receitas - f.Despesas);

    // Filter up to current month for visual brevity
    const currentMonth = new Date().getMonth();
    return fluxo.slice(Math.max(0, currentMonth - 5), currentMonth + 1);
  }, [receitas, despesas]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleExportPDF = () => {
    if (!reportRef.current) return;
    const opt = {
      margin:       10,
      filename:     `relatorio_financeiro_${filterType}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
    };
    html2pdf().set(opt).from(reportRef.current).save();
  };

  const handleViewPDF = () => {
    if (!reportRef.current) return;
    const opt = {
      margin:       10,
      filename:     `relatorio_financeiro_${filterType}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
    };
    html2pdf().set(opt).from(reportRef.current).outputPdf('bloburl').then((url: string) => {
      window.open(url, '_blank');
    }).catch(() => {
      // fallback in case outputPdf is not available directly
      html2pdf().set(opt).from(reportRef.current as HTMLElement).toPdf().get('pdf').then((pdf: any) => {
        window.open(pdf.output('bloburl'), '_blank');
      });
    });
  };

  return (
    <div style={{ padding: '1rem 2rem 2rem 2rem', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header Interno */}
      <div style={{ 
        backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', 
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '2rem',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem',
        position: 'relative'
      }}>
        <div style={{ zIndex: 1, flex: 1 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Relatórios Financeiros</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', zIndex: 1, flex: '1 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: 'none', outline: 'none', backgroundColor: 'transparent', fontWeight: '600', color: '#0f172a', width: '100%', maxWidth: '200px' }}
            >
              <option value="este_mes">Este Mês</option>
              <option value="mes_especifico">Mês Específico</option>
              <option value="este_ano">Este Ano</option>
              <option value="ano_especifico">Ano Específico</option>
              <option value="personalizado">Personalizado</option>
              <option value="todo_periodo">Todo o Período</option>
            </select>

            {filterType === 'mes_especifico' && (
              <input 
                type="month" 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(e.target.value)}
                style={{ padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            )}

            {filterType === 'ano_especifico' && (
              <input 
                type="number" 
                min="2000" max="2100" step="1"
                value={filterYear} 
                onChange={(e) => setFilterYear(e.target.value)}
                style={{ padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', width: '80px' }}
              />
            )}

            {filterType === 'personalizado' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input 
                  type="date" 
                  value={filterStart} 
                  onChange={(e) => setFilterStart(e.target.value)}
                  style={{ padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
                <span style={{ color: '#64748b' }}>até</span>
                <input 
                  type="date" 
                  value={filterEnd} 
                  onChange={(e) => setFilterEnd(e.target.value)}
                  style={{ padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>
            )}
          </div>

          <button 
            onClick={handleViewPDF}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              padding: '0.75rem 1.25rem', backgroundColor: '#f1f5f9', color: '#0f172a', 
              border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
              whiteSpace: 'nowrap'
            }}
          >
            <Eye size={18} />
            Visualizar PDF
          </button>
          
          <button 
            onClick={handleExportPDF}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              padding: '0.75rem 1.25rem', backgroundColor: '#0f172a', color: 'white', 
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
              boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.2)',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={18} />
            Exportar PDF
          </button>
        </div>
      </div>

      <div ref={reportRef}>
        {/* Resumo do Período */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Resumo do Período</h2>
          <Info size={16} color="#94a3b8" />
        </div>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', marginTop: '-1rem' }}>Visão geral dos principais indicadores financeiros do período selecionado.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Card 1: Faturamento Bruto */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#dcfce7', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                <TrendingUp size={20} />
              </div>
              <span style={{ fontWeight: '600', color: '#16a34a', fontSize: '0.95rem' }}>Faturamento Bruto</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
              {formatCurrency(faturamentoBruto)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Receitas recebidas totais</div>
          </div>

          {/* Card 3: Despesas Pagas */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#fee2e2', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <TrendingDown size={20} />
              </div>
              <span style={{ fontWeight: '600', color: '#dc2626', fontSize: '0.95rem' }}>Despesas Pagas</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
              {formatCurrency(despesasTotais)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Despesas liquidadas no período</div>
          </div>

          {/* Card 4: Lucro Líquido Real */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#fef3c7', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                <Wallet size={20} />
              </div>
              <span style={{ fontWeight: '600', color: '#d97706', fontSize: '0.95rem' }}>Lucro Líquido Real</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
              {formatCurrency(lucroLiquido)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Margem de Lucro: <strong style={{ color: '#d97706' }}>{faturamentoBruto > 0 ? ((lucroLiquido / faturamentoBruto) * 100).toFixed(1) : '0.0'}%</strong></div>
          </div>

          {/* Card 5: Contas Pendentes */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#ffedd5', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c2410c' }}>
                <AlertCircle size={20} />
              </div>
              <span style={{ fontWeight: '600', color: '#c2410c', fontSize: '0.95rem' }}>Contas Pendentes</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
              {formatCurrency(contasPendentes)}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Contas manuais em aberto</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          {/* VGV Alcançado */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#e0e7ff', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                <Activity size={20} />
              </div>
              <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>VGV Alcançado (Período)</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>
              {vgvPeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div style={{ width: `${Math.min(100, (vgvPeriodo / (targetMeta || 1)) * 100)}%`, height: '100%', backgroundColor: '#4f46e5', borderRadius: '4px' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
              <span>{targetMeta > 0 ? ((vgvPeriodo / targetMeta) * 100).toFixed(1) : 0}% da meta</span>
              <span style={{ color: '#4f46e5', fontWeight: '600' }}>Meta anual: {formatCurrency(targetMeta).split(',')[0]}</span>
            </div>
          </div>

          {/* Meta de VGV */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#fef3c7', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                <Target size={20} />
              </div>
              <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Meta de VGV (Período)</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#d97706', marginBottom: '1rem' }}>
              {targetMeta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div style={{ width: `${Math.min(100, (vgvPeriodo / (targetMeta || 1)) * 100)}%`, height: '100%', backgroundColor: '#d97706', borderRadius: '4px' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
              <span>Progresso da meta</span>
              <span style={{ fontWeight: '500' }}>Restam: {Math.max(0, targetMeta - vgvPeriodo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Clientes na Base */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#f1f5f9', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <Users size={20} />
              </div>
              <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Clientes na Base</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>{clientsCount}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Total de clientes cadastrados</div>
          </div>

          {/* Imóveis no Portfólio */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#dcfce7', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                <Building2 size={20} />
              </div>
              <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Imóveis no Portfólio</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#16a34a', marginBottom: '0.5rem' }}>{propertiesCount}</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Total de imóveis ativos</div>
          </div>
        </div>

        {/* Análise Financeira */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Análise Financeira</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.5rem 0 0 0' }}>Entenda o comportamento das receitas e despesas no período.</p>
        </div>

        <div style={{ marginBottom: '3rem' }}>
          {/* Gráfico 1: Receitas vs Despesas (Efetivadas) */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '1.5rem' }}>Receitas vs Despesas (Efetivadas)</h3>
            <div style={{ width: '100%', height: 250, marginBottom: '1rem' }}>
              <ResponsiveContainer>
                <AreaChart data={fluxoCaixaAnual}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value/1000}k`} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                  <RechartsTooltip formatter={(value: any) => formatCurrency(value)} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px', color: '#64748b'}} />
                  <Area type="monotone" dataKey="Receitas" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" activeDot={{r: 6}} />
                  <Area type="monotone" dataKey="Despesas" stroke="#dc2626" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" activeDot={{r: 6}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Small Summary inside chart */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.2rem' }}><div style={{width: 8, height: 8, borderRadius: '50%', backgroundColor: '#16a34a'}}></div> Total Receitas</div>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{formatCurrency(faturamentoBruto)}</div>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.2rem' }}><div style={{width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626'}}></div> Total Despesas</div>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{formatCurrency(despesasTotais)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.2rem' }}><div style={{width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6'}}></div> Resultado Líquido</div>
                <div style={{ fontWeight: '700', color: '#0f172a' }}>{formatCurrency(lucroLiquido)}</div>
              </div>
            </div>
          </div>
        </div>


        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem' }}>
          {/* Transações Recentes */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} color="#64748b" /> Transações Recentes
              </h2>
              <Link to="/painel/financeiro/historico-pagamentos" style={{ color: '#4f46e5', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 600 }}>Ver Histórico Completo</Link>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {historicoRecente.length === 0 ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem 0', margin: 0 }}>Nenhuma transação recente encontrada no período.</p>
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
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t.fornecedor || 'Diversos'} • {new Date(t.dataPagamento || t.vencimento || t.dataEmissao).toLocaleDateString('pt-BR')}</span>
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
    </div>
  );
}
