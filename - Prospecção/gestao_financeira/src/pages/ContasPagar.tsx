import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, Calendar, CheckCircle, X, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

interface ContaPagar {
  id: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  vencimento: string;
  status: 'Pendente' | 'Pago' | 'Atrasado' | 'Projeção';
  tipo: 'Manual' | 'Salário' | 'Custo Fixo' | 'Comissão' | 'Adiantamento';
  socioId?: 'ruth' | 'h5'; // Para adiantamentos
}

interface CustoFixo {
  id: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  diaVencimento: number;
  mesInicio?: string; // YYYY-MM
  parcelas?: number;
}

export default function ContasPagar() {
  const [searchTerm, setSearchTerm] = useState('');
  const [mesAtual, setMesAtual] = useState('06/2026');

  const changeMonth = (delta: number) => {
    const [mm, yyyy] = mesAtual.split('/');
    let date = new Date(Number(yyyy), Number(mm) - 1 + delta, 1);
    const newMm = String(date.getMonth() + 1).padStart(2, '0');
    const newYyyy = date.getFullYear();
    setMesAtual(`${newMm}/${newYyyy}`);
  };

  // Mantemos as contas manuais em um estado para poder adicionar/editar
  const [manualContas, setManualContas] = useState<ContaPagar[]>([]);

  // Contas dinâmicas que podem ter seu status alterado para 'Pago'
  const [dynamicContasStatus, setDynamicContasStatus] = useState<Record<string, 'Pendente' | 'Pago' | 'Atrasado' | 'Projeção'>>({});

  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaPagar | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContaPagar | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<ContaPagar | null>(null);
  const [confirmRemoveCustoFixo, setConfirmRemoveCustoFixo] = useState<string | null>(null);

  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [isCustosFixosModalOpen, setIsCustosFixosModalOpen] = useState(false);
  const [novoCustoFixo, setNovoCustoFixo] = useState<Omit<CustoFixo, 'id'>>({ descricao: '', fornecedor: '', valor: 0, diaVencimento: 10, mesInicio: '2026-06', parcelas: 0 });
  const [editingCustoFixoId, setEditingCustoFixoId] = useState<string | null>(null);

  const getTodayDateString = () => new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState<Omit<ContaPagar, 'id' | 'tipo' | 'socioId'> & { isAdiantamento: boolean, socioId: 'ruth'|'h5', isAlreadyPaid: boolean }>({
    descricao: '',
    fornecedor: '',
    valor: 0,
    vencimento: getTodayDateString(),
    status: 'Pendente',
    isAdiantamento: false,
    socioId: 'ruth',
    isAlreadyPaid: false
  });

  const [isSociedadeModalOpen, setIsSociedadeModalOpen] = useState(false);
  const [sociedadeConfig, setSociedadeConfig] = useState({
    empresa: 0,
    ruth: 70,
    h5: 30
  });

  // Carregar config da sociedade
  useEffect(() => {
    const saved = localStorage.getItem('ruth_dias_sociedade');
    if (saved) {
      setSociedadeConfig(JSON.parse(saved));
    }
  }, []);

  const saveSociedade = () => {
    const total = sociedadeConfig.empresa + sociedadeConfig.ruth + sociedadeConfig.h5;
    if (total !== 100) {
      alert(`A soma das porcentagens deve dar 100%. Atualmente dá ${total}%.`);
      return;
    }
    localStorage.setItem('ruth_dias_sociedade', JSON.stringify(sociedadeConfig));
    setIsSociedadeModalOpen(false);
  };

  const [dataLoaded, setDataLoaded] = useState(false);
  const [faturamentoMes, setFaturamentoMes] = useState(0);

  // Carregar dados iniciais reais
  useEffect(() => {
    const loadAllData = async () => {
      try {
        let manuals = [];
        const resM = await fetch('/api.php?key=ruth_dias_contas_pagar_manual');
        const txtM = await resM.text();
        if (txtM && !txtM.startsWith('<')) {
          let p = JSON.parse(txtM);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) manuals = p;
        }

        let statuses = {};
        const resS = await fetch('/api.php?key=ruth_dias_status_pagamentos');
        const txtS = await resS.text();
        if (txtS && !txtS.startsWith('<')) {
          let p = JSON.parse(txtS);
          if (typeof p === 'string') p = JSON.parse(p);
          if (p && typeof p === 'object') statuses = p;
        }

        let fat = 0;
        const resH = await fetch('/api.php?key=ruth_dias_historico_pagamentos');
        const txtH = await resH.text();
        if (txtH && !txtH.startsWith('<')) {
          let p = JSON.parse(txtH);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) {
            const [mm, yyyy] = mesAtual.split('/');
            const monthPrefix = `${yyyy}-${mm}`;
            fat = p.filter((c:any) => c.tipo === 'Entrada' && c.dataPagamento && c.dataPagamento.startsWith(monthPrefix)).reduce((acc:number, c:any) => acc + c.valor, 0);
          }
        }

        let custosF = [];
        const resC = await fetch('/api.php?key=ruth_dias_custos_fixos');
        const txtC = await resC.text();
        if (txtC && !txtC.startsWith('<')) {
          let p = JSON.parse(txtC);
          if (typeof p === 'string') p = JSON.parse(p);
          if (Array.isArray(p)) custosF = p;
        }

        setCustosFixos(custosF);
        setManualContas(manuals);
        setDynamicContasStatus(statuses);
        setFaturamentoMes(fat);
        setDataLoaded(true);
      } catch (e) {
        console.error('Erro ao carregar dados financeiros reais', e);
        setDataLoaded(true);
      }
    };
    loadAllData();
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;

    const loadRealTeamData = async () => {
      try {
        let teamData = [];
        const res = await fetch('/api.php?key=ruth_dias_equipe');
        const text = await res.text();
        if (text && !text.startsWith('<')) {
          let parsed = JSON.parse(text);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) teamData = parsed;
        } else {
          const local = localStorage.getItem('ruth_dias_equipe');
          if (local) teamData = JSON.parse(local);
        }
        const [mm, yyyy] = mesAtual.split('/');
        const mesAtualDate = new Date(Number(yyyy), Number(mm) - 1, 1);

        const salariosContas: ContaPagar[] = teamData
          .filter((t: any) => {
            if (t.baseSalary <= 0) return false;
            if (!t.mesInicio) return true;
            const [inicioY, inicioM] = t.mesInicio.split('-');
            const inicioDate = new Date(Number(inicioY), Number(inicioM) - 1, 1);
            return mesAtualDate >= inicioDate;
          })
          .map((membro: any) => ({
            id: `salario-${membro.id}-${mesAtual.replace('/', '-')}`,
            descricao: `Salário Fixo - ${mesAtual}`,
            fornecedor: membro.name,
            valor: membro.baseSalary,
            vencimento: `${mesAtual.split('/')[1]}-${mesAtual.split('/')[0]}-05`,
            status: dynamicContasStatus[`salario-${membro.id}-${mesAtual.replace('/', '-')}`] || 'Pendente',
            tipo: 'Salário'
          }));

        const comissoesGlobais: ContaPagar[] = teamData
          .filter((t: any) => {
            if (t.globalCommission <= 0) return false;
            if (!t.mesInicio) return true;
            const [inicioY, inicioM] = t.mesInicio.split('-');
            const inicioDate = new Date(Number(inicioY), Number(inicioM) - 1, 1);
            return mesAtualDate >= inicioDate;
          })
          .map((membro: any) => ({
            id: `comissao-global-${membro.id}-${mesAtual.replace('/', '-')}`,
            descricao: `Comissão Global (${(membro.globalCommission * 100).toFixed(1)}% s/ Faturamento Base)`,
            fornecedor: membro.name,
            valor: faturamentoMes * membro.globalCommission,
            vencimento: `${mesAtual.split('/')[1]}-${mesAtual.split('/')[0]}-10`,
            status: dynamicContasStatus[`comissao-global-${membro.id}-${mesAtual.replace('/', '-')}`] || 'Pendente',
            tipo: 'Comissão'
          }));

        const adiantamentosRuth = manualContas.filter(c => c.tipo === 'Adiantamento' && c.socioId === 'ruth').reduce((acc, c) => acc + c.valor, 0);
        const adiantamentosH5 = manualContas.filter(c => c.tipo === 'Adiantamento' && c.socioId === 'h5').reduce((acc, c) => acc + c.valor, 0);

        const despesasFixas: ContaPagar[] = custosFixos.filter(cf => {
          if (!cf.mesInicio) return true;
          const [inicioY, inicioM] = cf.mesInicio.split('-');
          const inicioDate = new Date(Number(inicioY), Number(inicioM) - 1, 1);
          
          if (mesAtualDate < inicioDate) return false;
          
          if (cf.parcelas && cf.parcelas > 0) {
            const diffMonths = (mesAtualDate.getFullYear() - inicioDate.getFullYear()) * 12 + (mesAtualDate.getMonth() - inicioDate.getMonth());
            if (diffMonths >= cf.parcelas) return false;
          }
          return true;
        }).map(cf => {
          let desc = cf.descricao;
          if (cf.mesInicio && cf.parcelas && cf.parcelas > 0) {
            const [inicioY, inicioM] = cf.mesInicio.split('-');
            const inicioDate = new Date(Number(inicioY), Number(inicioM) - 1, 1);
            const diffMonths = (mesAtualDate.getFullYear() - inicioDate.getFullYear()) * 12 + (mesAtualDate.getMonth() - inicioDate.getMonth());
            desc += ` (Parcela ${diffMonths + 1}/${cf.parcelas})`;
          }
          return {
            id: `custofixo-${cf.id}-${mesAtual.replace('/', '-')}`,
            descricao: desc,
            fornecedor: cf.fornecedor,
            valor: cf.valor,
            vencimento: `${mesAtual.split('/')[1]}-${mesAtual.split('/')[0]}-${String(cf.diaVencimento).padStart(2, '0')}`,
            status: dynamicContasStatus[`custofixo-${cf.id}-${mesAtual.replace('/', '-')}`] || 'Pendente',
            tipo: 'Custo Fixo'
          };
        });

        const despesas = [...manualContas.filter(c => c.tipo !== 'Adiantamento'), ...salariosContas, ...comissoesGlobais, ...despesasFixas];
        const totalDespesas = despesas.reduce((acc, c) => acc + c.valor, 0);
        
        const lucroLiquido = faturamentoMes - totalDespesas;
        const distribuicao: ContaPagar[] = [];

        // Data de vencimento no mês seguinte ao recebimento
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const vencimentoLucros = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-10`;

        const today = new Date();
        today.setHours(0,0,0,0);
        const vencimentoDate = new Date(`${vencimentoLucros}T00:00:00`);
        const isProjecao = today < vencimentoDate;

        const valorBaseParaCalculo = lucroLiquido > 0 ? lucroLiquido : 0;

        if (sociedadeConfig.ruth > 0) {
          const valorTotal = valorBaseParaCalculo * (sociedadeConfig.ruth / 100);
          const valorLiquido = valorTotal - adiantamentosRuth;
          distribuicao.push({
            id: `lucro-ruth-${mesAtual.replace('/', '-')}`,
            descricao: `Distribuição de Lucros (${sociedadeConfig.ruth}%) - Ref. ${mesAtual}${adiantamentosRuth > 0 ? ` (Desc. R$ ${adiantamentosRuth})` : ''}`,
            fornecedor: 'Ruth Dias',
            valor: valorLiquido > 0 ? valorLiquido : 0,
            vencimento: vencimentoLucros,
            status: dynamicContasStatus[`lucro-ruth-${mesAtual.replace('/', '-')}`] || (isProjecao ? 'Projeção' : 'Pendente'),
            tipo: 'Comissão'
          });
        }
        if (sociedadeConfig.h5 > 0) {
          const valorTotal = valorBaseParaCalculo * (sociedadeConfig.h5 / 100);
          const valorLiquido = valorTotal - adiantamentosH5;
          distribuicao.push({
            id: `lucro-h5-${mesAtual.replace('/', '-')}`,
            descricao: `Distribuição de Lucros (${sociedadeConfig.h5}%) - Ref. ${mesAtual}${adiantamentosH5 > 0 ? ` (Desc. R$ ${adiantamentosH5})` : ''}`,
            fornecedor: 'Desenvolvedor H5',
            valor: valorLiquido > 0 ? valorLiquido : 0,
            vencimento: vencimentoLucros,
            status: dynamicContasStatus[`lucro-h5-${mesAtual.replace('/', '-')}`] || (isProjecao ? 'Projeção' : 'Pendente'),
            tipo: 'Comissão'
          });
        }
        if (sociedadeConfig.empresa > 0) {
          distribuicao.push({
            id: `lucro-empresa-${mesAtual.replace('/', '-')}`,
            descricao: `Fundo da Empresa (${sociedadeConfig.empresa}%) - Ref. ${mesAtual}`,
            fornecedor: 'Caixa da Empresa',
            valor: valorBaseParaCalculo * (sociedadeConfig.empresa / 100),
            vencimento: vencimentoLucros,
            status: dynamicContasStatus[`lucro-empresa-${mesAtual.replace('/', '-')}`] || (isProjecao ? 'Projeção' : 'Pendente'),
            tipo: 'Comissão'
          });
        }

        setContas([...manualContas, ...salariosContas, ...comissoesGlobais, ...despesasFixas, ...distribuicao].filter(c => c.status !== 'Pago'));
      } catch (e) {
        console.error(e);
      }
    };

    loadRealTeamData();
  }, [mesAtual, manualContas, dynamicContasStatus, sociedadeConfig, dataLoaded, faturamentoMes, custosFixos]);

  const totalPagar = contas.reduce((acc, c) => acc + c.valor, 0);

  const handleOpenModal = (conta?: ContaPagar) => {
    if (conta) {
      if (conta.tipo === 'Custo Fixo') {
        setIsCustosFixosModalOpen(true);
        return;
      }
      if (conta.tipo === 'Manual' || conta.tipo === 'Adiantamento') {
        setEditingConta(conta);
        setFormData({
          descricao: conta.descricao,
          fornecedor: conta.fornecedor,
          valor: conta.valor,
          vencimento: conta.vencimento,
          status: conta.status,
          isAdiantamento: conta.tipo === 'Adiantamento',
          socioId: conta.socioId || 'ruth',
          isAlreadyPaid: false
        });
        setIsModalOpen(true);
      }
    } else {
      setEditingConta(null);
      setFormData({ descricao: '', fornecedor: '', valor: 0, vencimento: getTodayDateString(), status: 'Pendente', isAdiantamento: false, socioId: 'ruth', isAlreadyPaid: false });
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleSave = async () => {
    let newManuals = [];
    const tipoFinal: 'Adiantamento' | 'Manual' = formData.isAdiantamento ? 'Adiantamento' : 'Manual';
    const statusFinal: 'Pago' | 'Pendente' = formData.isAlreadyPaid ? 'Pago' : 'Pendente';
    let generatedId = '';

    if (editingConta) {
      generatedId = editingConta.id;
      newManuals = manualContas.map(c => c.id === editingConta.id ? { ...formData, id: editingConta.id, tipo: tipoFinal, socioId: formData.socioId, status: statusFinal } : c);
    } else {
      generatedId = `m${Date.now()}`;
      newManuals = [...manualContas, { ...formData, id: generatedId, tipo: tipoFinal, socioId: formData.socioId, status: statusFinal }];
    }
    
    setManualContas(newManuals);
    await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_contas_pagar_manual', value: JSON.stringify(newManuals) }) });

    if (formData.isAlreadyPaid) {
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
          id: `hp-${Date.now()}`,
          originalId: generatedId,
          descricao: formData.descricao,
          fornecedor: formData.fornecedor,
          valor: formData.valor,
          dataPagamento: getTodayDateString(),
          tipo: 'Saída'
        });
        await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_historico_pagamentos', value: JSON.stringify(hist) }) });
      } catch (e) {}
    }

    handleCloseModal();
  };

  const handleDelete = (conta: ContaPagar) => {
    if (conta.tipo !== 'Manual') {
      alert('Contas automáticas não podem ser excluídas por aqui. Altere a equipe ou os custos fixos.');
      return;
    }
    setConfirmDelete(conta);
  };

  const executeDelete = async () => {
    if (confirmDelete) {
      const newManuals = manualContas.filter(c => c.id !== confirmDelete.id);
      setManualContas(newManuals);
      await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_contas_pagar_manual', value: JSON.stringify(newManuals) }) });
      setConfirmDelete(null);
    }
  };

  const handleAddCustoFixo = async () => {
    if (!novoCustoFixo.descricao || novoCustoFixo.valor <= 0) return alert('Preencha a descrição e um valor válido');
    
    let newCf = [];
    if (editingCustoFixoId) {
      newCf = custosFixos.map(cf => cf.id === editingCustoFixoId ? { ...novoCustoFixo, id: editingCustoFixoId } : cf);
    } else {
      newCf = [...custosFixos, { ...novoCustoFixo, id: `cf-${Date.now()}` }];
    }
    
    setCustosFixos(newCf);
    setNovoCustoFixo({ descricao: '', fornecedor: '', valor: 0, diaVencimento: 10 });
    setEditingCustoFixoId(null);
    await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_custos_fixos', value: JSON.stringify(newCf) }) });
  };

  const handleEditCustoFixoInit = (cf: CustoFixo) => {
    setNovoCustoFixo({ descricao: cf.descricao, fornecedor: cf.fornecedor, valor: cf.valor, diaVencimento: cf.diaVencimento, mesInicio: cf.mesInicio || '2026-06', parcelas: cf.parcelas || 0 });
    setEditingCustoFixoId(cf.id);
  };

  const handleRemoveCustoFixo = async (id: string) => {
    setConfirmRemoveCustoFixo(id);
  };

  const executeRemoveCustoFixo = async () => {
    if (!confirmRemoveCustoFixo) return;
    const newCf = custosFixos.filter(c => c.id !== confirmRemoveCustoFixo);
    setCustosFixos(newCf);
    await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_custos_fixos', value: JSON.stringify(newCf) }) });
    setConfirmRemoveCustoFixo(null);
  };

  const handleMarkAsPaid = async (conta: ContaPagar) => {
    setConfirmPaid(conta);
  };

  const executeMarkAsPaid = async () => {
    if (!confirmPaid) return;
    const conta = confirmPaid;

    let newManuals = manualContas;
    let newStatus = dynamicContasStatus;

    if (conta.tipo === 'Manual' || conta.tipo === 'Adiantamento') {
      newManuals = manualContas.map(c => c.id === conta.id ? { ...c, status: 'Pago' as const } : c);
      setManualContas(newManuals);
      await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_contas_pagar_manual', value: JSON.stringify(newManuals) }) });
    } else {
      newStatus = { ...dynamicContasStatus, [conta.id]: 'Pago' as const };
      setDynamicContasStatus(newStatus);
      await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_status_pagamentos', value: JSON.stringify(newStatus) }) });
    }

    // Append to historico
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
        id: `hp-${Date.now()}`,
        originalId: conta.id,
        descricao: conta.descricao,
        fornecedor: conta.fornecedor,
        valor: conta.valor,
        dataPagamento: new Date().toISOString().split('T')[0],
        tipo: 'Saída'
      });
      await fetch('/api.php', { method: 'POST', body: JSON.stringify({ key: 'ruth_dias_historico_pagamentos', value: JSON.stringify(hist) }) });
    } catch(e) {}

    setConfirmPaid(null);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--primary-color)', margin: 0 }}>Contas a Pagar e Folha</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>Gerencie despesas manuais, salários da equipe e custos fixos.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><ChevronLeft size={16} color="var(--text-secondary)" /></button>
            <Calendar size={18} color="var(--text-secondary)" />
            <span style={{ fontWeight: '600' }}>Mês: {mesAtual}</span>
            <button onClick={() => changeMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><ChevronRight size={16} color="var(--text-secondary)" /></button>
          </div>
          <button onClick={() => setIsCustosFixosModalOpen(true)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            <Settings size={18} /> Custos Fixos
          </button>
          <button onClick={() => setIsSociedadeModalOpen(true)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
            <Settings size={18} /> Configurar Sociedade
          </button>
          <button onClick={() => handleOpenModal()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Nova Despesa
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ flex: 1, backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid #ef4444', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total a Pagar ({mesAtual})</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#0f172a' }}>{totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar por descrição ou fornecedor..." 
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
                <th style={{ padding: '1rem' }}>Descrição</th>
                <th style={{ padding: '1rem' }}>Credor/Funcionário</th>
                <th style={{ padding: '1rem' }}>Tipo</th>
                <th style={{ padding: '1rem' }}>Vencimento</th>
                <th style={{ padding: '1rem' }}>Valor</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.filter(c => c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || c.fornecedor.toLowerCase().includes(searchTerm.toLowerCase())).map(conta => (
                <tr key={conta.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{conta.descricao}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{conta.fornecedor}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem', 
                      backgroundColor: conta.tipo === 'Salário' ? '#dbeafe' : conta.tipo === 'Comissão' ? '#ffedd5' : conta.tipo === 'Custo Fixo' ? '#f3e8ff' : '#f1f5f9',
                      color: conta.tipo === 'Salário' ? '#1e40af' : conta.tipo === 'Comissão' ? '#c2410c' : conta.tipo === 'Custo Fixo' ? '#6b21a8' : '#475569'
                    }}>
                      {conta.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{conta.vencimento.includes('-') ? new Date(conta.vencimento).toLocaleDateString('pt-BR') : conta.vencimento}</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                    {conta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '0.3rem 0.6rem', 
                      borderRadius: '999px', 
                      fontSize: '0.8rem', 
                      fontWeight: '600',
                      backgroundColor: conta.status === 'Pago' ? '#dcfce7' : conta.status === 'Atrasado' ? '#fee2e2' : conta.status === 'Projeção' ? '#f3f4f6' : '#fef9c3',
                      color: conta.status === 'Pago' ? '#166534' : conta.status === 'Atrasado' ? '#991b1b' : conta.status === 'Projeção' ? '#6b7280' : '#854d0e'
                    }}>
                      {conta.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleMarkAsPaid(conta)} title="Marcar como Pago" style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', opacity: conta.status === 'Projeção' ? 0.3 : 1 }} disabled={conta.status === 'Projeção'}><CheckCircle size={18} /></button>
                      <button onClick={() => handleOpenModal(conta)} title="Editar" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: (conta.tipo === 'Manual' || conta.tipo === 'Adiantamento' || conta.tipo === 'Custo Fixo') ? 1 : 0.5 }} disabled={conta.tipo !== 'Manual' && conta.tipo !== 'Adiantamento' && conta.tipo !== 'Custo Fixo'}><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(conta)} title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: (conta.tipo === 'Manual' || conta.tipo === 'Adiantamento') ? 1 : 0.5 }} disabled={conta.tipo !== 'Manual' && conta.tipo !== 'Adiantamento'}><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {contas.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma conta pendente para este mês.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{editingConta ? 'Editar Despesa' : 'Nova Despesa Manual'}</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-secondary)" /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Descrição</label>
                <input type="text" className="input" value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} placeholder="Ex: Material de Escritório" />
              </div>
              
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.isAdiantamento} onChange={e => setFormData({...formData, isAdiantamento: e.target.checked})} />
                  É um adiantamento de lucro para um dos sócios?
                </label>
              </div>

              {formData.isAdiantamento && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Para qual Sócio?</label>
                  <select className="input" value={formData.socioId} onChange={e => setFormData({...formData, socioId: e.target.value as 'ruth'|'h5'})}>
                    <option value="ruth">Ruth Dias</option>
                    <option value="h5">Desenvolvedor H5</option>
                  </select>
                </div>
              )}

              {!formData.isAdiantamento && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Credor / Fornecedor</label>
                  <input type="text" className="input" value={formData.fornecedor} onChange={e => setFormData({...formData, fornecedor: e.target.value})} placeholder="Ex: Kalunga" />
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Valor (R$)</label>
                <input type="number" step="0.01" className="input" value={formData.valor} onChange={e => setFormData({...formData, valor: Number(e.target.value)})} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Data de Vencimento / Pagamento</label>
                <input type="date" className="input" value={formData.vencimento} onChange={e => setFormData({...formData, vencimento: e.target.value})} />
              </div>

              {!editingConta && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500', cursor: 'pointer', color: '#16a34a' }}>
                    <input type="checkbox" checked={formData.isAlreadyPaid} onChange={e => setFormData({...formData, isAlreadyPaid: e.target.checked})} />
                    Esta despesa já foi paga? (Lançamento retroativo)
                  </label>
                </div>
              )}

              <button className="btn btn-primary" onClick={handleSave} style={{ marginTop: '1rem', width: '100%' }}>
                {editingConta ? 'Salvar Alterações' : (formData.isAlreadyPaid ? 'Registrar Pagamento Realizado' : 'Adicionar Despesa')}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1e293b' }}>Confirmar Exclusão</h3>
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Tem certeza que deseja excluir esta despesa?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
              <button onClick={executeDelete} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {isCustosFixosModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Gerenciar Custos Fixos</h2>
              <button onClick={() => setIsCustosFixosModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-secondary)" /></button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Despesas adicionadas aqui serão cobradas automaticamente todos os meses (ex: Aluguel, Internet, Luz) e também serão descontadas automaticamente da divisão de lucros dos sócios.
            </p>

            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end', border: '1px solid #e2e8f0' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>Descrição</label>
                <input type="text" className="input" placeholder="Ex: Aluguel" value={novoCustoFixo.descricao} onChange={e => setNovoCustoFixo({...novoCustoFixo, descricao: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>Fornecedor</label>
                <input type="text" className="input" placeholder="Ex: Imobiliária" value={novoCustoFixo.fornecedor} onChange={e => setNovoCustoFixo({...novoCustoFixo, fornecedor: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>Valor (R$)</label>
                <input type="number" className="input" value={novoCustoFixo.valor} onChange={e => setNovoCustoFixo({...novoCustoFixo, valor: Number(e.target.value)})} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '1 1 60px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>Dia Venc.</label>
                <input type="number" className="input" placeholder="10" value={novoCustoFixo.diaVencimento} onChange={e => setNovoCustoFixo({...novoCustoFixo, diaVencimento: Number(e.target.value)})} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>Início (Mês/Ano)</label>
                <input type="month" className="input" value={novoCustoFixo.mesInicio || ''} onChange={e => setNovoCustoFixo({...novoCustoFixo, mesInicio: e.target.value})} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '1 1 80px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#475569' }}>Parcelas</label>
                <input type="number" className="input" placeholder="Opcional" value={novoCustoFixo.parcelas || ''} onChange={e => setNovoCustoFixo({...novoCustoFixo, parcelas: e.target.value ? Number(e.target.value) : undefined})} style={{ width: '100%' }} />
              </div>
              <button className="btn btn-primary" onClick={handleAddCustoFixo} style={{ padding: '0.6rem 1rem', flex: '0 0 auto' }}>{editingCustoFixoId ? 'Salvar Edição' : 'Adicionar'}</button>
              {editingCustoFixoId && (
                <button className="btn" onClick={() => { setEditingCustoFixoId(null); setNovoCustoFixo({ descricao: '', fornecedor: '', valor: 0, diaVencimento: 10, mesInicio: '2026-06', parcelas: 0 }); }} style={{ padding: '0.6rem 1rem', flex: '0 0 auto', border: '1px solid #cbd5e1' }}>Cancelar</button>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.5rem' }}>Descrição</th>
                  <th style={{ padding: '0.5rem' }}>Fornecedor</th>
                  <th style={{ padding: '0.5rem' }}>Valor</th>
                  <th style={{ padding: '0.5rem' }}>Vencimento</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {custosFixos.map(cf => (
                  <tr key={cf.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '500' }}>
                      {cf.descricao}
                      {cf.parcelas && cf.parcelas > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>({cf.parcelas} parcelas)</span>}
                    </td>
                    <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>{cf.fornecedor}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#0f172a' }}>{cf.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--text-secondary)' }}>Todo dia {cf.diaVencimento} <br/><small style={{fontSize: '0.75rem'}}>A partir: {cf.mesInicio || 'Sempre'}</small></td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                        <button onClick={() => handleEditCustoFixoInit(cf)} title="Editar custo fixo" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}><Edit2 size={16} /></button>
                        <button onClick={() => handleRemoveCustoFixo(cf.id)} title="Remover custo fixo" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {custosFixos.length === 0 && <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum custo fixo cadastrado para gerar.</td></tr>}
              </tbody>
            </table>
          </div>

          {confirmRemoveCustoFixo && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
              <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1e293b' }}>Confirmar Exclusão</h3>
                <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Deseja remover este custo fixo? Ele não será mais gerado nos próximos meses.</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setConfirmRemoveCustoFixo(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
                  <button onClick={executeRemoveCustoFixo} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Remover</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isSociedadeModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Divisão de Lucros (%)</h2>
              <button onClick={() => setIsSociedadeModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-secondary)" /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Defina a porcentagem de divisão do lucro líquido da imobiliária (após todas as contas serem descontadas do faturamento). O total deve ser 100%.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Ruth Dias (%)</label>
                <input type="number" className="input" value={sociedadeConfig.ruth} onChange={e => setSociedadeConfig({...sociedadeConfig, ruth: Number(e.target.value)})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Desenvolvedor H5 (%)</label>
                <input type="number" className="input" value={sociedadeConfig.h5} onChange={e => setSociedadeConfig({...sociedadeConfig, h5: Number(e.target.value)})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Caixa da Empresa (%)</label>
                <input type="number" className="input" value={sociedadeConfig.empresa} onChange={e => setSociedadeConfig({...sociedadeConfig, empresa: Number(e.target.value)})} />
              </div>
              
              <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: (sociedadeConfig.ruth + sociedadeConfig.h5 + sociedadeConfig.empresa) === 100 ? '#dcfce7' : '#fee2e2', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', color: (sociedadeConfig.ruth + sociedadeConfig.h5 + sociedadeConfig.empresa) === 100 ? '#166534' : '#991b1b' }}>
                Total: {sociedadeConfig.ruth + sociedadeConfig.h5 + sociedadeConfig.empresa}%
              </div>

              <button className="btn btn-primary" onClick={saveSociedade} style={{ marginTop: '1rem', width: '100%' }}>
                Salvar Configuração
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPaid && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1e293b' }}>Confirmar Pagamento</h3>
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Marcar <strong>"{confirmPaid.descricao}"</strong> como PAGA? <br/><br/><small>Ela será movida para o Histórico de Transações.</small></p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmPaid(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
              <button onClick={executeMarkAsPaid} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
