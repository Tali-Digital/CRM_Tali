import React, { useState } from 'react';
import { 
  CommercialCard, 
  FinancialCard, 
  OperationCard, 
  InternalTaskCard, 
  Client, 
  UserProfile,
  Tag
} from '../types';
import { 
  Search, 
  Trash2, 
  RotateCcw, 
  Filter, 
  Briefcase, 
  TrendingUp, 
  RefreshCw, 
  CheckCircle2,
  Calendar,
  Layers,
  History,
  Archive,
  User,
  Download,
  FileText
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UnifiedCardManagerViewProps {
  commercialCards: CommercialCard[];
  financialCards: FinancialCard[];
  operationCards: OperationCard[];
  internalTaskCards: InternalTaskCard[];
  clients: Client[];
  users: UserProfile[];
  tags: Tag[];
  onRestoreCard: (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal') => Promise<void>;
  onPermanentDelete: (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal', skipConfirm?: boolean) => Promise<void>;
}

export const UnifiedCardManagerView: React.FC<UnifiedCardManagerViewProps> = ({
  commercialCards,
  financialCards,
  operationCards,
  internalTaskCards,
  clients,
  users,
  onRestoreCard,
  onPermanentDelete
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'deleted'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState<'all' | 'commercial' | 'financial' | 'operation' | 'internal'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const getClientName = (card: any) => {
    if (card.type === 'custom') return card.title || 'Sem título';
    const client = clients.find(c => c.id === card.clientId);
    return client ? client.name : card.clientName || card.title || 'Cliente desconhecido';
  };

  const formatDate = (date: any) => {
    if (!date) return 'Data não disponível';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const allCards = [
    ...commercialCards.map(c => ({ ...c, metaType: 'commercial' as const })),
    ...financialCards.map(c => ({ ...c, metaType: 'financial' as const })),
    ...operationCards.map(c => ({ ...c, metaType: 'operation' as const })),
    ...internalTaskCards.map(c => ({ ...c, metaType: 'internal' as const }))
  ];

  const filteredCards = allCards.filter(card => {
    // Only show custom (personalized) cards in the manager
    if (card.type === 'client') return false;

    const matchesSearch = getClientName(card).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = sectorFilter === 'all' || card.metaType === sectorFilter;
    const matchesClient = clientFilter === 'all' || card.clientId === clientFilter || (card.type === 'client' && card.id === clientFilter);
    
    // Temporal filtration
    const dateToFilter = activeTab === 'completed' ? card.completedAt : card.updatedAt;
    let matchesTime = true;
    if (dateToFilter && (monthFilter !== 'all' || yearFilter !== 'all')) {
      const d = dateToFilter instanceof Timestamp ? dateToFilter.toDate() : new Date(dateToFilter);
      const mMatch = monthFilter === 'all' || d.getMonth() === parseInt(monthFilter);
      const yMatch = yearFilter === 'all' || d.getFullYear() === parseInt(yearFilter);
      matchesTime = mMatch && yMatch;
    } else if (!dateToFilter && (monthFilter !== 'all' || yearFilter !== 'all')) {
      matchesTime = false;
    }

    let matchesTab = false;
    if (activeTab === 'active') matchesTab = !card.deleted && !card.completed;
    else if (activeTab === 'completed') matchesTab = !!card.completed && !card.deleted;
    else if (activeTab === 'deleted') matchesTab = !!card.deleted;
    
    return matchesSearch && matchesSector && matchesClient && matchesTime && matchesTab;
  }).sort((a, b) => {
    const dateA = a.updatedAt instanceof Timestamp ? a.updatedAt.toMillis() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
    const dateB = b.updatedAt instanceof Timestamp ? b.updatedAt.toMillis() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
    return dateB - dateA;
  });

  const getSectorIcon = (type: string) => {
    switch (type) {
      case 'commercial': return <TrendingUp size={12} className="text-blue-500" />;
      case 'financial': return <Briefcase size={12} className="text-emerald-500" />;
      case 'operation': return <RefreshCw size={12} className="text-orange-500" />;
      case 'internal': return <CheckCircle2 size={12} className="text-purple-500" />;
      default: return null;
    }
  };

  const getSectorLabel = (type: string) => {
    switch (type) {
      case 'commercial': return 'Comercial';
      case 'financial': return 'Integração';
      case 'operation': return 'Operação';
      case 'internal': return 'T. Internas';
      default: return '';
    }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      const primaryColor: [number, number, number] = [34, 197, 94]; // Success Green (Emerald 500)
      
      // Minimalist Header (Green)
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      const mainTitle = monthFilter !== 'all' ? 'EVOLUÇÃO MENSAL DO PROJETO' : 'EVOLUÇÃO DO PROJETO';
      doc.text(mainTitle, 15, 22);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Talí Agência Digital | Comprometidos com o seu sucesso', 15, 29);
      
      // Client Info Header
      const clientName = clientFilter !== 'all' ? (clients.find(c => c.id === clientFilter)?.name || 'Cliente') : 'Relatório Geral';
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(clientName.toUpperCase(), 15, 52);
      
      // Summary Info (Green themed with Rounded Corners)
      doc.setFillColor(240, 253, 244); // Very light green bg
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.roundedRect(15, 58, 180, 15, 3, 3, 'FD');
      
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFontSize(10);
      doc.text(`ENTREGAS CONCLUÍDAS: ${filteredCards.length}`, 22, 68);
      
      if (monthFilter !== 'all' || yearFilter !== 'all') {
        const monthNames = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
        let periodStr = 'REFERENTE A: ';
        if (monthFilter !== 'all') periodStr += monthNames[parseInt(monthFilter)] + ' ';
        if (yearFilter !== 'all') periodStr += yearFilter;
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(periodStr, 110, 68);
      }
      
      // Deliveries Table (Green theme)
      const tableData = filteredCards.map(card => [
        '•', 
        card.title || 'Atividade Finalizada',
        getSectorLabel(card.metaType),
        formatDate(card.completedAt)
      ]);
      
      autoTable(doc, {
        startY: 80,
        head: [['', 'DESCRIÇÃO DA ATIVIDADE', 'SETOR', 'DATA']],
        body: tableData,
        theme: 'plain',
        headStyles: { 
          textColor: [100, 100, 100], 
          fontSize: 8, 
          fontStyle: 'bold',
          halign: 'left'
        },
        bodyStyles: { 
          fontSize: 10,
          textColor: [40, 40, 40],
          cellPadding: 4
        },
        columnStyles: {
          0: { cellWidth: 10, textColor: primaryColor, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 30, textColor: [120, 120, 120], fontSize: 8 },
          3: { cellWidth: 30, textColor: [120, 120, 120], fontSize: 8 }
        },
        margin: { left: 15, right: 15 }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text('Relatório gerado em ' + new Date().toLocaleDateString('pt-BR'), 15, 285);
        doc.text('Tali Agência Digital - talidigital.com.br', 195, 285, { align: 'right' });
      }
      
      doc.save(`Evolucao_Tali_${clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Houve um erro ao gerar o PDF.');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Gestor de Cards</h1>
          <p className="text-stone-500 text-sm mt-1">Gerencie todos os cards ativos, concluídos e removidos em um só lugar.</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex bg-stone-100 p-2 rounded-2xl mb-8 self-start min-w-[480px] gap-2 shadow-inner">
        <button 
          onClick={() => setActiveTab('active')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'active' ? 'bg-white shadow-md text-stone-900 border border-stone-200' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Layers size={14} />
          Cards Ativos
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'completed' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20 text-white' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <History size={14} />
          Concluídos
        </button>
        <button 
          onClick={() => setActiveTab('deleted')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'deleted' ? 'bg-red-500 shadow-lg shadow-red-500/20 text-white' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Trash2 size={14} />
          Lixeira
        </button>
      </div>

      {activeTab === 'completed' && filteredCards.length > 0 && (
        <div className="flex justify-start mb-4">
          <button 
            onClick={generatePDF}
            className="flex items-center gap-2 bg-[#5271FF]/10 text-[#5271FF] px-4 py-2 rounded-xl border border-[#5271FF]/20 text-[10px] font-black uppercase tracking-widest hover:bg-[#5271FF] hover:text-white transition-all shadow-md group"
          >
            <Download size={14} className="group-hover:animate-bounce" />
            <FileText size={14} />
            Gerar Relatório PDF
          </button>
        </div>
      )}

      {activeTab === 'deleted' && filteredCards.length > 0 && (
        <div className="flex justify-start mb-4">
          <button 
            onClick={async () => {
              if (window.confirm('Deseja apagar TOTALMENTE todos os cards da lixeira? Esta ação não pode ser desfeita.')) {
                for (const card of filteredCards) {
                  await onPermanentDelete(card.id, card.metaType, true);
                }
              }
            }}
            className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl border border-red-200 text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm"
          >
            <Trash2 size={12} />
            Esvaziar Lixeira
          </button>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Filters Area */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between gap-4">
          <div className="flex-1 flex max-w-4xl gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por cliente ou título..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all font-bold"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all cursor-pointer min-w-[150px]"
              >
                <option value="all">Filtrar por Cliente</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>

              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all cursor-pointer min-w-[120px]"
              >
                <option value="all">Mês</option>
                {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all cursor-pointer min-w-[100px]"
              >
                <option value="all">Ano</option>
                {['2024', '2025', '2026'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-stone-50 p-1.5 rounded-2xl border border-stone-100">
            <button 
              onClick={() => setSectorFilter('all')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${sectorFilter === 'all' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Todos os Setores
            </button>
            <div className="w-px h-4 bg-stone-200 mx-1"></div>
            <button 
              onClick={() => setSectorFilter('commercial')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${sectorFilter === 'commercial' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Comercial
            </button>
            <button 
              onClick={() => setSectorFilter('financial')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${sectorFilter === 'financial' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Integração
            </button>
            <button 
              onClick={() => setSectorFilter('operation')}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${sectorFilter === 'operation' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Operação
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 min-h-0">
          <AnimatePresence mode="popLayout">
            {filteredCards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCards.map((card) => (
                  <motion.div 
                    layout
                    key={`${card.metaType}-${card.id}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col bg-stone-50 border border-stone-200 rounded-3xl p-5 hover:bg-white hover:border-stone-300 hover:shadow-xl transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-full border border-stone-100 shadow-sm">
                        {getSectorIcon(card.metaType)}
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{getSectorLabel(card.metaType)}</span>
                      </div>
                      <div className="flex -space-x-1.5">
                        {card.assignees?.slice(0, 3).map(userId => {
                          const u = users.find(user => user.id === userId);
                          if (!u) return null;
                          return (
                            <div key={userId} className="w-6 h-6 rounded-full border-2 border-stone-50 overflow-hidden bg-stone-200" title={u.name}>
                              {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-stone-500">{u.name.charAt(0)}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <h3 className="text-base font-black text-stone-900 leading-tight mb-3 group-hover:text-stone-800 transition-colors">
                      {card.title || getClientName(card)}
                    </h3>

                    {/* Dynamic Client Tag */}
                    {(() => {
                      const client = clients.find(c => c.id === card.clientId || (card.type === 'client' && card.id === c.id));
                      if (!client) return null;
                      
                      const isBlue = client.themeColor === 'blue';
                      return (
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1 border transition-all ${
                            isBlue 
                              ? 'bg-blue-50 text-blue-600 border-blue-100' 
                              : 'bg-yellow-50 text-yellow-600 border-yellow-100'
                          }`}>
                            <User size={10} className={isBlue ? 'text-blue-400' : 'text-yellow-400'} />
                            <span>{client.name}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-stone-200/50">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">
                          {activeTab === 'completed' ? 'Finalizado em' : 'Última atualização'}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                          <Calendar size={12} className="text-stone-400" />
                          <span>{activeTab === 'completed' ? formatDate(card.completedAt) : formatDate(card.updatedAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                        {(card.deleted || card.completed) && (
                          <button 
                            onClick={() => onRestoreCard(card.id, card.metaType)}
                            title="Restaurar Card"
                            className="p-2.5 rounded-2xl bg-white border border-stone-200 text-blue-500 hover:bg-blue-50 hover:border-blue-200 transition-all font-bold shadow-sm"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        
                        <button 
                          onClick={() => {
                            if (activeTab === 'deleted') {
                              if (window.confirm('Tem certeza que deseja excluir este card PERMANENTEMENTE? Esta ação não pode ser desfeita.')) {
                                onPermanentDelete(card.id, card.metaType, true);
                              }
                            } else {
                              onPermanentDelete(card.id, card.metaType, false);
                            }
                          }}
                          title={card.deleted ? "Excluir Permanentemente" : "Mover para Lixeira"}
                          className={`p-2.5 rounded-2xl transition-all font-bold shadow-sm ${card.deleted ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white' : 'bg-white border border-stone-200 text-stone-400 hover:text-red-500'}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-stone-300">
                <div className="w-24 h-24 bg-stone-50 rounded-full flex items-center justify-center mb-6">
                  <Archive size={40} className="opacity-20" />
                </div>
                <h3 className="font-black text-lg tracking-tight text-stone-900 mb-1">Nada por aqui ainda</h3>
                <p className="text-sm font-bold text-stone-400">Nenhum card encontrado com esses filtros.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
