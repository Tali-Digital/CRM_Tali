import React, { useState } from 'react';
import { 
  CheckCircle2, 
  RotateCcw, 
  Trash2, 
  Search, 
  Calendar,
  Briefcase,
  User,
  Filter,
  Archive
} from 'lucide-react';
import { 
  CommercialCard, 
  FinancialCard, 
  OperationCard, 
  InternalTaskCard,
  UserProfile,
  Client,
  Tag
} from '../types';
import { Timestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface ArchiveViewProps {
  commercialCards: CommercialCard[];
  financialCards: FinancialCard[];
  operationCards: OperationCard[];
  internalTaskCards: InternalTaskCard[];
  users: UserProfile[];
  clients: Client[];
  tags: Tag[];
  onRestore: (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal') => Promise<void>;
  onPermanentDelete: (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal') => Promise<void>;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  commercialCards,
  financialCards,
  operationCards,
  internalTaskCards,
  users,
  clients,
  tags,
  onRestore,
  onPermanentDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'commercial' | 'financial' | 'operation' | 'internal'>('all');

  const allCompletedCards = [
    ...commercialCards.filter(c => c.completed).map(c => ({ ...c, metaType: 'commercial' as const })),
    ...financialCards.filter(c => c.completed).map(c => ({ ...c, metaType: 'financial' as const })),
    ...operationCards.filter(c => c.completed).map(c => ({ ...c, metaType: 'operation' as const })),
    ...internalTaskCards.filter(c => c.completed).map(c => ({ ...c, metaType: 'internal' as const }))
  ].sort((a, b) => {
    const dateA = a.completedAt instanceof Timestamp ? a.completedAt.toMillis() : (a.completedAt ? new Date(a.completedAt).getTime() : 0);
    const dateB = b.completedAt instanceof Timestamp ? b.completedAt.toMillis() : (b.completedAt ? new Date(b.completedAt).getTime() : 0);
    return dateB - dateA;
  });

  const filteredCards = allCompletedCards.filter(card => {
    const matchesSearch = (card.title || card.clientName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || card.metaType === filterType;
    return matchesSearch && matchesType;
  });

  const formatDate = (date: any) => {
    if (!date) return 'Data não disponível';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-50 overflow-hidden">
      <div className="p-8 pb-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-stone-900 tracking-tight">Cards Concluídos</h2>
            <p className="text-stone-500 text-sm mt-1">Histórico de todas as atividades finalizadas.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-stone-100 px-4 py-2 rounded-2xl border border-stone-200 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-stone-400" />
              <span className="text-sm font-bold text-stone-600">{allCompletedCards.length} Cards</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por título ou cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
            />
          </div>
          
          <div className="flex bg-stone-200 p-1 rounded-xl">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'all' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilterType('commercial')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'commercial' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Comercial
            </button>
            <button 
              onClick={() => setFilterType('integracao' as any)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === ('integracao' as any) ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Integração
            </button>
            <button 
              onClick={() => setFilterType('operation')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'operation' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Operação
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredCards.map((card) => {
                const client = clients.find(c => c.id === card.clientId);
                const title = card.title || card.clientName || 'Card sem título';
                
                return (
                  <motion.div 
                    layout
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white border-2 border-stone-100 rounded-3xl p-6 hover:border-stone-200 transition-all shadow-sm group relative"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl bg-stone-100 text-stone-400`}>
                          <Briefcase size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                          {card.metaType === 'commercial' ? 'Comercial' : 
                           card.metaType === 'financial' ? 'Integração' : 
                           card.metaType === 'operation' ? 'Operação' : 'Tarefas'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onRestore(card.id, card.metaType as any)}
                          className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-blue-500 hover:bg-blue-50 transition-all"
                          title="Restaurar para o quadro"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button 
                          onClick={() => onPermanentDelete(card.id, card.metaType as any)}
                          className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-red-500 hover:bg-red-50 transition-all"
                          title="Excluir Permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-black text-stone-900 mb-2 leading-tight">{title}</h4>
                    
                    {client && (
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`w-2 h-2 rounded-full ${client.themeColor === 'blue' ? 'bg-blue-400' : 'bg-yellow-400'}`} />
                        <span className="text-xs font-bold text-stone-600">{client.name}</span>
                      </div>
                    )}

                    <div className="pt-4 border-t border-stone-50 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400">
                        <Calendar size={12} />
                        <span>Concluído em: {formatDate(card.completedAt)}</span>
                      </div>
                      <div className="flex -space-x-1">
                        {card.assignees?.slice(0, 3).map(userId => {
                          const u = users.find(user => user.id === userId);
                          if (!u) return null;
                          return (
                            <div key={userId} className="w-5 h-5 rounded-full border-2 border-white overflow-hidden bg-stone-100" title={u.name}>
                              {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-[6px] font-bold text-stone-400">{u.name.charAt(0)}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 bg-stone-100 rounded-3xl flex items-center justify-center mb-6 text-stone-300">
              <Archive size={40} />
            </div>
            <h3 className="text-xl font-bold text-stone-900 mb-2">Nenhum card encontrado</h3>
            <p className="text-stone-500 max-w-sm">
              Explore outros filtros ou busque por termos diferentes para encontrar o que procura.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
