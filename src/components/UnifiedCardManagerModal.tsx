import React, { useState } from 'react';
import { Modal } from './Modal';
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
  Archive
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface UnifiedCardManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  commercialCards: CommercialCard[];
  financialCards: FinancialCard[];
  operationCards: OperationCard[];
  internalTaskCards: InternalTaskCard[];
  clients: Client[];
  users: UserProfile[];
  tags: Tag[];
  onRestoreCard: (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal') => Promise<void>;
  onPermanentDelete: (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal') => Promise<void>;
}

export const UnifiedCardManagerModal: React.FC<UnifiedCardManagerModalProps> = ({
  isOpen,
  onClose,
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
    const matchesSearch = getClientName(card).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSector = sectorFilter === 'all' || card.metaType === sectorFilter;
    
    let matchesTab = false;
    if (activeTab === 'active') matchesTab = !card.deleted && !card.completed;
    else if (activeTab === 'completed') matchesTab = !!card.completed && !card.deleted;
    else if (activeTab === 'deleted') matchesTab = !!card.deleted;
    
    return matchesSearch && matchesSector && matchesTab;
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestor de Cards" size="lg">
      <div className="flex flex-col h-[600px]">
        {/* Header/Tabs */}
        <div className="flex bg-stone-100 p-1.5 rounded-2xl mb-6">
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'active' ? 'bg-white shadow-sm text-stone-900 border border-stone-200' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <Layers size={14} />
            Ativos
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'completed' ? 'bg-white shadow-sm text-stone-900 border border-stone-200' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <History size={14} />
            Concluídos
          </button>
          <button 
            onClick={() => setActiveTab('deleted')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'deleted' ? 'bg-white shadow-sm text-stone-900 border border-stone-200' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <Trash2 size={14} />
            Lixeira
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por cliente ou título..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-xl shrink-0">
            <button 
              onClick={() => setSectorFilter('all')}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all ${sectorFilter === 'all' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setSectorFilter('commercial')}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all ${sectorFilter === 'commercial' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Comercial
            </button>
            <button 
              onClick={() => setSectorFilter('financial')}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all ${sectorFilter === 'financial' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Integração
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
          <AnimatePresence mode="popLayout">
            {filteredCards.length > 0 ? (
              <div className="space-y-3">
                {filteredCards.map((card) => (
                  <motion.div 
                    layout
                    key={`${card.metaType}-${card.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center justify-between p-4 bg-white border border-stone-200 rounded-2xl hover:border-stone-300 transition-all group"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-900 leading-none">
                          {getClientName(card)}
                        </span>
                        <div className="flex items-center gap-1 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-100">
                          {getSectorIcon(card.metaType)}
                          <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">{getSectorLabel(card.metaType)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-stone-400">
                          <Calendar size={12} />
                          <span>{activeTab === 'completed' ? `Concluído: ${formatDate(card.completedAt)}` : `Atualizado: ${formatDate(card.updatedAt)}`}</span>
                        </div>
                        <div className="flex -space-x-1">
                          {card.assignees?.slice(0, 2).map(userId => {
                            const u = users.find(user => user.id === userId);
                            if (!u) return null;
                            return (
                              <div key={userId} className="w-4 h-4 rounded-full border border-white overflow-hidden bg-stone-100" title={u.name}>
                                {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[6px] font-bold text-stone-400">{u.name.charAt(0)}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {card.deleted || card.completed ? (
                        <button 
                          onClick={() => onRestoreCard(card.id, card.metaType)}
                          className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-blue-500 hover:bg-blue-50 hover:border-blue-200 transition-all font-bold text-xs flex items-center gap-1"
                        >
                          <RotateCcw size={14} />
                          <span className="hidden sm:inline">Restaurar</span>
                        </button>
                      ) : null}
                      
                      <button 
                        onClick={() => onPermanentDelete(card.id, card.metaType)}
                        className={`p-2 rounded-xl bg-stone-50 border border-stone-200 transition-all font-bold text-xs flex items-center gap-1 ${card.deleted ? 'text-red-500 hover:bg-red-50 hover:border-red-200' : 'text-stone-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200'}`}
                      >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">{card.deleted ? 'Excluir' : 'Arquivar'}</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                <Archive size={48} className="mb-4 opacity-10" />
                <p className="font-bold text-sm tracking-tight">Nenhum card encontrado nesta categoria.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
};
