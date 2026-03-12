import React from 'react';
import { CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard, InternalTaskList, InternalTaskCard, Client, Tag, UserProfile } from '../types';
import { CheckSquare, Calendar, User } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface Props {
  commercialLists: CommercialList[];
  commercialCards: CommercialCard[];
  financialLists: FinancialList[];
  financialCards: FinancialCard[];
  operationLists: OperationList[];
  operationCards: OperationCard[];
  internalTaskLists: InternalTaskList[];
  internalTaskCards: InternalTaskCard[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  dashboardView: 'minhas' | 'global';
  currentUserUid: string;
  onNavigate: (tab: 'comercial' | 'integracao' | 'operacao' | 'internal_tasks') => void;
  onUpdateCommercialCard: (id: string, data: any) => Promise<void>;
  onUpdateFinancialCard: (id: string, data: any) => Promise<void>;
  onUpdateOperationCard: (id: string, data: any) => Promise<void>;
  onUpdateInternalTaskCard: (id: string, data: any) => Promise<void>;
}

export const UnifiedDashboardBoard: React.FC<Props> = ({
  commercialLists,
  commercialCards,
  financialLists,
  financialCards,
  operationLists,
  operationCards,
  internalTaskLists,
  internalTaskCards,
  clients,
  tags,
  users,
  dashboardView,
  currentUserUid,
  onNavigate,
  onUpdateCommercialCard,
  onUpdateFinancialCard,
  onUpdateOperationCard,
  onUpdateInternalTaskCard
}) => {
  const isOverdue = (date: any) => {
    if (!date) return false;
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d <= today;
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const filterCards = (cards: any[], lists: any[]) => {
    // Only show cards that belong to an existing list
    const existingListIds = lists.map(l => l.id);
    const validCards = cards.filter(c => existingListIds.includes(c.listId) && !c.deleted && !c.completed);

    if (dashboardView === 'global') return validCards;
    
    const assignedListIds = lists.filter(l => l.assignees?.includes(currentUserUid)).map(l => l.id);
    return validCards.filter(c => assignedListIds.includes(c.listId));
  };

  const filteredCommercialCards = filterCards(commercialCards, commercialLists);
  const filteredFinancialCards = filterCards(financialCards, financialLists);
  const filteredOperationCards = filterCards(operationCards, operationLists);
  const filteredInternalCards = filterCards(internalTaskCards, internalTaskLists);

  const renderCard = (card: any, lists: any[], targetTab: 'comercial' | 'integracao' | 'operacao' | 'internal_tasks') => {
    const client = clients.find(c => c.id === card.clientId);
    const list = lists.find(l => l.id === card.listId);
    const clientName = client?.name || card.clientName || card.title || 'Cliente Desconhecido';
    const isClient = card.type === 'client' && client;
    const themeColor = client?.themeColor || 'neutral';
    const checklist = client?.checklist || card.checklist || [];
    const completed = checklist.filter((i: any) => i.completed).length;
    const total = checklist.length;

    const bgColorClass = 
      themeColor === 'yellow' ? 'bg-yellow-50 border-yellow-300 shadow-yellow-900/5' : 
      themeColor === 'blue' ? 'bg-blue-50 border-blue-300 shadow-blue-900/5' :
      'bg-stone-50 border-stone-200';
    const textColorClass = 
      themeColor === 'yellow' ? 'text-yellow-900' : 
      themeColor === 'blue' ? 'text-blue-900' :
      'text-stone-900';

    return (
      <div 
        key={card.id} 
        onClick={() => onNavigate(targetTab)}
        className={`p-4 rounded-2xl shadow-sm border-2 mb-3 cursor-pointer hover:shadow-md transition-all group relative ${bgColorClass} ${isClient ? 'ring-2 ring-white ring-inset' : ''}`}
      >
        <div className="flex justify-between items-start mb-2">
          <h4 className={`font-extrabold text-sm ${textColorClass} flex items-center gap-2`}>
            {isClient && <User size={14} className="opacity-50" />}
            {clientName}
          </h4>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const updateFn = 
                targetTab === 'comercial' ? onUpdateCommercialCard :
                targetTab === 'integracao' ? onUpdateFinancialCard :
                targetTab === 'operacao' ? onUpdateOperationCard :
                onUpdateInternalTaskCard;
              updateFn(card.id, { completed: true, completedAt: Timestamp.now() });
            }}
            className="p-1 rounded-lg hover:bg-white/50 text-stone-400 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100"
            title="Marcar como concluído"
          >
            <CheckSquare size={16} />
          </button>
        </div>
        
        {list && (
          <div className="mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 bg-white/50 px-2 py-1 rounded-md">
              {list.name}
            </span>
          </div>
        )}

        {client?.serviceTags && client.serviceTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {client.serviceTags.map(tagId => {
              const tag = tags.find(t => t.id === tagId);
              if (!tag) return null;
              return (
                <span 
                  key={tag.id} 
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
                >
                  {tag.name}
                </span>
              );
            })}
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium bg-white/50 w-fit px-2 py-1 rounded-md mb-2">
            <CheckSquare size={12} className={completed === total ? 'text-green-500' : ''} />
            <span className={completed === total ? 'text-green-600' : ''}>
              {completed}/{total}
            </span>
          </div>
        )}

        {(card.startDate || card.deliveryDate) && (
          <div className="flex items-center gap-3 mt-2">
            {card.startDate && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-stone-500">
                <Calendar size={10} />
                <span>{formatDate(card.startDate)}</span>
              </div>
            )}
            {card.deliveryDate && (
              <div className={`flex items-center gap-1 text-[10px] font-bold ${isOverdue(card.deliveryDate) ? 'text-red-500' : 'text-stone-500'}`}>
                <Calendar size={10} />
                <span>{formatDate(card.deliveryDate)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-6 h-full overflow-x-auto pb-4 custom-scrollbar">
      <div className="flex flex-col rounded-3xl p-4 bg-stone-100 min-h-[500px] border border-stone-200/50 shadow-sm min-w-[320px] w-[320px]">
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-widest">Comercial</h2>
            <span className="bg-white text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-stone-200">
              {filteredCommercialCards.length}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          {filteredCommercialCards.map(card => renderCard(card, commercialLists, 'comercial'))}
        </div>
      </div>

      <div className="flex flex-col rounded-3xl p-4 bg-blue-50 min-h-[500px] border border-stone-200/50 shadow-sm min-w-[320px] w-[320px]">
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-widest">Integração</h2>
            <span className="bg-white text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-stone-200">
              {filteredFinancialCards.length}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          {filteredFinancialCards.map(card => renderCard(card, financialLists, 'integracao'))}
        </div>
      </div>

      <div className="flex flex-col rounded-3xl p-4 bg-green-50 min-h-[500px] border border-stone-200/50 shadow-sm min-w-[320px] w-[320px]">
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-widest">Operação</h2>
            <span className="bg-white text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-stone-200">
              {filteredOperationCards.length}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          {filteredOperationCards.map(card => renderCard(card, operationLists, 'operacao'))}
        </div>
      </div>

      <div className="flex flex-col rounded-3xl p-4 bg-stone-200/50 min-h-[500px] border border-stone-200/50 shadow-sm min-w-[320px] w-[320px]">
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-widest">Tarefas Internas</h2>
            <span className="bg-white text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-stone-200">
              {filteredInternalCards.length}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          {filteredInternalCards.map(card => renderCard(card, internalTaskLists, 'internal_tasks'))}
        </div>
      </div>
    </div>
  );
};
