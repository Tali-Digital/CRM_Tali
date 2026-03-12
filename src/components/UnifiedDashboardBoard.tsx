import React from 'react';
import { CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard, InternalTaskList, InternalTaskCard, Client, Tag, UserProfile } from '../types';
import { CheckSquare, Calendar, User } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { completeCommercialCard, completeFinancialCard, completeOperationCard, completeInternalTaskCard } from '../services/firestoreService';
import { QuickViewCardModal } from './QuickViewCardModal';
import { Edit2, CheckCircle2 } from 'lucide-react';

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
  onUpdateInternalTaskCard,
}) => {
  const [quickViewCard, setQuickViewCard] = React.useState<any>(null);
  const [quickViewTab, setQuickViewTab] = React.useState<'comercial' | 'integracao' | 'operacao' | 'internal_tasks' | null>(null);

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
    const isClient = card.type === 'client' && client;
    const clientName = isClient ? client.name : (card.title || card.clientName || 'Card sem Título');
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

    if (isClient) {
      return (
        <div 
          key={card.id} 
          onClick={() => {
            setQuickViewCard(card);
            setQuickViewTab(targetTab);
          }}
          className={`p-0 rounded-2xl shadow-sm border-2 mb-3 cursor-pointer hover:shadow-md transition-all group relative overflow-hidden ${bgColorClass} ring-2 ring-white ring-inset`}
        >
          <div className={`p-2 px-3 flex items-center justify-between border-b ${themeColor === 'blue' ? 'border-blue-200 bg-blue-100/30' : 'border-yellow-200 bg-yellow-100/30'}`}>
            <div className="flex items-center gap-1.5 focus-within:ring-2 focus-within:ring-blue-500">
              <div className={`p-1 rounded-lg ${themeColor === 'blue' ? 'bg-blue-200/50' : 'bg-yellow-200/50'}`}>
                <User size={10} className={textColorClass} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${textColorClass}`}>Cliente</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNavigate(targetTab);
                }}
                className="p-1 rounded-lg hover:bg-white/50 text-stone-400 hover:text-stone-900 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
                title="Ver no Setor"
              >
                <Edit2 size={12} />
              </button>
              <button 
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (targetTab === 'comercial') await completeCommercialCard(card.id);
                  else if (targetTab === 'integracao') await completeFinancialCard(card.id);
                  else if (targetTab === 'operacao') await completeOperationCard(card.id);
                  else await completeInternalTaskCard(card.id);
                }}
                className="p-1 rounded-lg hover:bg-white/50 text-stone-400 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
                title="Concluir Atendimento"
              >
                <CheckSquare size={14} />
              </button>
            </div>
          </div>

          <div className="p-4">
            <h4 className={`font-black text-sm leading-tight ${textColorClass}`}>{clientName}</h4>
            
            {list && (
              <div className="mt-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-stone-500 bg-stone-100/50 px-1.5 py-0.5 rounded-md">
                  {list.name}
                </span>
              </div>
            )}
            
            <div className="mt-3 flex items-center justify-between">
              <div className="flex -space-x-1.5">
                {card.assignees?.map((userId: string) => {
                  const u = users.find(user => user.id === userId);
                  if (!u) return null;
                  return (
                    <div key={userId} className="w-5 h-5 rounded-full border-2 border-white overflow-hidden bg-stone-100" title={u.name}>
                      {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-stone-400">{u.name.charAt(0)}</div>}
                    </div>
                  );
                })}
              </div>
              
              {total > 0 && (
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${completed === total ? (themeColor === 'blue' ? 'bg-blue-600 text-white' : 'bg-yellow-600 text-white') : (themeColor === 'blue' ? 'bg-blue-200/50 text-blue-700' : 'bg-yellow-200/50 text-yellow-700')}`}>
                  <CheckSquare size={10} />
                  {completed}/{total}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        key={card.id} 
        onClick={() => {
          setQuickViewCard(card);
          setQuickViewTab(targetTab);
        }}
        className={`p-4 rounded-2xl shadow-sm border-2 mb-3 cursor-pointer hover:shadow-md transition-all group relative ${bgColorClass}`}
      >
        <div className="flex justify-between items-start mb-2">
          <h4 className={`font-extrabold text-sm ${textColorClass}`}>
            {clientName}
          </h4>
          <div className="flex items-center gap-1">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigate(targetTab);
              }}
              className="p-1 rounded-lg hover:bg-white/50 text-stone-400 hover:text-stone-900 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
              title="Ver no Setor"
            >
              <Edit2 size={12} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (targetTab === 'comercial') await completeCommercialCard(card.id);
                else if (targetTab === 'integracao') await completeFinancialCard(card.id);
                else if (targetTab === 'operacao') await completeOperationCard(card.id);
                else await completeInternalTaskCard(card.id);
              }}
              className="p-1 rounded-lg hover:bg-white/50 text-stone-400 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
              title="Marcar como concluído"
            >
              <CheckSquare size={16} />
            </button>
          </div>
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

      <QuickViewCardModal 
        isOpen={!!quickViewCard}
        onClose={() => {
          setQuickViewCard(null);
          setQuickViewTab(null);
        }}
        card={quickViewCard}
        client={clients.find(c => c.id === quickViewCard?.clientId)}
        users={users}
        tags={tags}
        onEdit={() => {
          if (quickViewTab) {
            onNavigate(quickViewTab);
          }
        }}
        sector={quickViewTab === 'integracao' ? 'financial' : quickViewTab === 'operacao' ? 'operation' : quickViewTab === 'internal_tasks' ? 'internal' : (quickViewTab as any)}
      />
    </div>
  );
};
