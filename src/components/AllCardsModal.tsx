import React, { useState } from 'react';
import { Modal } from './Modal';
import { CommercialCard, FinancialCard, OperationCard, InternalTaskCard, Client } from '../types';
import { Search, Trash2, RotateCcw, Filter, Briefcase, TrendingUp, RefreshCw, CheckCircle2 } from 'lucide-react';

interface AllCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  commercialCards: CommercialCard[];
  financialCards: FinancialCard[];
  operationCards: OperationCard[];
  internalTaskCards: InternalTaskCard[];
  clients: Client[];
  onRestoreCard: (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal') => void;
  onPermanentDelete: (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal') => void;
}

export const AllCardsModal: React.FC<AllCardsModalProps> = ({
  isOpen,
  onClose,
  commercialCards,
  financialCards,
  operationCards,
  internalTaskCards,
  clients,
  onRestoreCard,
  onPermanentDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'deleted'>('all');

  const getClientName = (card: any) => {
    if (card.type === 'custom') return card.title || 'Sem título';
    const client = clients.find(c => c.id === card.clientId);
    return client ? client.name : card.clientName || card.title || 'Cliente desconhecido';
  };

  const allCards = [
    ...commercialCards.map(c => ({ ...c, cardType: 'commercial' as const })),
    ...financialCards.map(c => ({ ...c, cardType: 'financial' as const })),
    ...operationCards.map(c => ({ ...c, cardType: 'operation' as const })),
    ...internalTaskCards.map(c => ({ ...c, cardType: 'internal' as const }))
  ].sort((a, b) => {
    const dateA = a.createdAt?.toMillis?.() || 0;
    const dateB = b.createdAt?.toMillis?.() || 0;
    return dateB - dateA;
  });

  const filteredCards = allCards.filter(card => {
    const matchesSearch = getClientName(card).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = 
      filter === 'all' ? true :
      filter === 'active' ? !card.deleted :
      card.deleted;
    return matchesSearch && matchesFilter;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'commercial': return <TrendingUp size={14} className="text-blue-500" />;
      case 'financial': return <Briefcase size={14} className="text-emerald-500" />;
      case 'operation': return <RefreshCw size={14} className="text-orange-500" />;
      case 'internal': return <CheckCircle2 size={14} className="text-purple-500" />;
      default: return null;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'commercial': return 'Comercial';
      case 'financial': return 'Financeiro';
      case 'operation': return 'Operação';
      case 'internal': return 'T. Internas';
      default: return '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestor Geral de Cards">
      <div className="space-y-4 -mt-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            placeholder="Pesquisar por cliente ou título..."
          />
        </div>

        <div className="flex bg-stone-100 p-1 rounded-xl">
          <button 
            onClick={() => setFilter('all')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilter('active')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'active' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Ativos
          </button>
          <button 
            onClick={() => setFilter('deleted')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'deleted' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Lixeira
          </button>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
          {filteredCards.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-stone-400">Nenhum card encontrado.</p>
            </div>
          ) : (
            filteredCards.map((card) => (
              <div 
                key={`${card.cardType}-${card.id}`} 
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${card.deleted ? 'bg-stone-50 border-stone-100 opacity-75' : 'bg-white border-stone-100 hover:shadow-sm'}`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${card.deleted ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                      {getClientName(card)}
                    </span>
                    {card.deleted && (
                      <span className="text-[10px] font-black uppercase tracking-tighter bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Excluído</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {getIcon(card.cardType)}
                      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">{getLabel(card.cardType)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-1">
                  {card.deleted ? (
                    <>
                      <button 
                        onClick={() => onRestoreCard(card.id, card.cardType)}
                        title="Restaurar"
                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button 
                        onClick={() => onPermanentDelete(card.id, card.cardType)}
                        title="Excluir Permanentemente"
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => onPermanentDelete(card.id, card.cardType)}
                      title="Mover para Lixeira"
                      className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
