import React, { useState } from 'react';
import { Modal } from './Modal';
import { Timestamp } from 'firebase/firestore';
import { Calendar, CheckCircle2, Search, Trash2, RotateCcw } from 'lucide-react';

interface Card {
  id: string;
  title?: string;
  clientName?: string;
  completedAt: any;
  [key: string]: any;
}

interface CompletedCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Card[];
  title: string;
  onRestore?: (cardId: string) => Promise<void>;
  onPermanentDelete?: (cardId: string) => Promise<void>;
}

export const CompletedCardsModal: React.FC<CompletedCardsModalProps> = ({ 
  isOpen, 
  onClose, 
  cards, 
  title,
  onRestore,
  onPermanentDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getMonthYear = (date: any) => {
    if (!date) return 'Sem Data';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const filteredCards = cards
    .filter(card => {
      const cardTitle = card.title || card.clientName || '';
      return cardTitle.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      const dateA = a.completedAt instanceof Timestamp ? a.completedAt.toMillis() : new Date(a.completedAt).getTime();
      const dateB = b.completedAt instanceof Timestamp ? b.completedAt.toMillis() : new Date(b.completedAt).getTime();
      return dateB - dateA;
    });

  const groupedCards: { [key: string]: Card[] } = {};
  filteredCards.forEach(card => {
    const key = getMonthYear(card.completedAt);
    if (!groupedCards[key]) groupedCards[key] = [];
    groupedCards[key].push(card);
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6 max-h-[70vh] flex flex-col">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            type="text"
            placeholder="Buscar nos concluídos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all font-medium"
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8 pr-2">
          {Object.keys(groupedCards).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-stone-400">
              <CheckCircle2 size={48} className="mb-4 opacity-20" />
              <p className="font-medium">Nenhum card concluído encontrado.</p>
            </div>
          ) : (
            Object.keys(groupedCards).map(month => (
              <div key={month} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest min-w-max">
                    {month}
                  </h3>
                  <div className="h-px w-full bg-stone-100" />
                </div>
                
                <div className="grid gap-3">
                  {groupedCards[month].map(card => (
                    <div 
                      key={card.id}
                      className="group p-4 bg-white border border-stone-200 rounded-2xl hover:border-stone-400 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-stone-900 text-sm">
                            {card.title || card.clientName || 'Sem Título'}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-tight">
                            <Calendar size={12} />
                            <span>Concluído em {formatDate(card.completedAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {onRestore && (
                            <button 
                              onClick={() => onRestore(card.id)}
                              className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center hover:bg-stone-900 hover:text-white transition-all"
                              title="Restaurar Card"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                          {onPermanentDelete && (
                            <button 
                              onClick={() => {
                                if (window.confirm('Excluir permanentemente este card concluído?')) {
                                  onPermanentDelete(card.id);
                                }
                              }}
                              className="w-8 h-8 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
                              title="Excluir Permanentemente"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <div className="w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                            <CheckCircle2 size={16} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
