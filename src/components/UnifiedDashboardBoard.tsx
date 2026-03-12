import React from 'react';
import { CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard, InternalTaskList, InternalTaskCard, Client, Tag, UserProfile } from '../types';
import { CheckSquare, Calendar, User } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { completeCommercialCard, completeFinancialCard, completeOperationCard, completeInternalTaskCard } from '../services/firestoreService';
import { QuickViewCardModal } from './QuickViewCardModal';
import { Edit2, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';
import { deleteCommercialCard, deleteFinancialCard, deleteOperationCard, deleteInternalTaskCard } from '../services/firestoreService';

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

  const getNextRecurrenceDate = (recurrence: any) => {
    if (!recurrence || !recurrence.enabled) return null;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let startDate = recurrence.lastTriggeredDate ? new Date(recurrence.lastTriggeredDate) : new Date();
    startDate.setHours(0, 0, 0, 0);

    if (recurrence.lastTriggeredDate) {
      startDate.setDate(startDate.getDate() + 1);
    }

    if (recurrence.period === 'daily') {
      return startDate;
    }

    if (recurrence.period === 'weekly' && recurrence.daysOfWeek?.length) {
      let nextDate = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        if (recurrence.daysOfWeek.includes(nextDate.getDay())) {
          return nextDate;
        }
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }

    if (recurrence.period === 'monthly' && recurrence.dayOfMonth) {
      let nextDate = new Date(startDate.getFullYear(), startDate.getMonth(), recurrence.dayOfMonth);
      if (nextDate < startDate) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
      return nextDate;
    }

    if (recurrence.period === 'yearly' && recurrence.monthOfYear && recurrence.dayOfMonth) {
      let nextDate = new Date(startDate.getFullYear(), recurrence.monthOfYear - 1, recurrence.dayOfMonth);
      if (nextDate < startDate) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
      return nextDate;
    }

    return null;
  };

  const getDateProximity = (date: any) => {
    if (!date) return 'normal';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const checkDate = new Date(d);
    checkDate.setHours(0, 0, 0, 0);

    const diffTime = checkDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'overdue';
    if (diffDays <= 3) return 'near';
    return 'normal';
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const filterCards = (cards: any[], lists: any[]) => {
    const existingListIds = lists.map(l => l.id);
    const validCards = cards.filter(c => existingListIds.includes(c.listId) && !c.deleted && !c.completed);

    const currentUser = users.find(u => u.id === currentUserUid);
    const isAdmin = currentUser?.role === 'admin';

    if (dashboardView === 'global') return validCards;
    
    const assignedListIds = lists.filter(l => l.assignees?.includes(currentUserUid)).map(l => l.id);
    
    return validCards.filter(c => {
      const isAssigned = assignedListIds.includes(c.listId);
      if (isAssigned) return true;
      
      if (isAdmin) {
        const delProx = getDateProximity(c.deliveryDate);
        if (delProx !== 'normal') return true;
        
        const nextRec = getNextRecurrenceDate(c.recurrence);
        const recProx = getDateProximity(nextRec);
        if (recProx !== 'normal') return true;
      }
      
      return false;
    });
  };

  const filteredCommercialCards = filterCards(commercialCards, commercialLists);
  const filteredFinancialCards = filterCards(financialCards, financialLists);
  const filteredOperationCards = filterCards(operationCards, operationLists);
  const filteredInternalCards = filterCards(internalTaskCards, internalTaskLists);

  const renderCard = (card: any, lists: any[], targetTab: 'comercial' | 'integracao' | 'operacao' | 'internal_tasks') => {
    const client = clients.find(c => c.id === card.clientId);
    const list = lists.find(l => l.id === card.listId);
    const isClient = card.type === 'client' && client;
    const displayName = isClient ? client.name : (card.title || card.clientName || 'Card sem Título');
    const checklist = client?.checklist || card.checklist || [];
    const completed = checklist.filter((i: any) => i.completed).length;
    const total = checklist.length;

    // Background is now unified to white/stone-50
    const bgColorClass = 'bg-white border-stone-200';
    const textColorClass = 'text-stone-900';

    return (
      <div 
        key={card.id} 
        onClick={() => {
          setQuickViewCard(card);
          setQuickViewTab(targetTab);
        }}
        className={`p-4 rounded-2xl shadow-sm border-2 mb-3 cursor-pointer hover:shadow-md transition-all group relative ${bgColorClass}`}
      >
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            {/* Client Indicator (for both client-type cards and linked cards) */}
            {client && (
              <div className="flex items-center gap-1.5 mb-1 bg-stone-50 border border-stone-100 px-2 py-0.5 rounded-lg w-fit">
                <User size={10} className="text-stone-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-stone-500 truncate max-w-[150px]">
                  {client.name}
                </span>
              </div>
            )}
            
            <h4 className={`font-extrabold text-sm leading-tight ${textColorClass} truncate`}>
              {isClient ? 'Atendimento Geral' : displayName}
            </h4>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigate(targetTab);
              }}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
              title="Ver no Setor"
            >
              <Edit2 size={12} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.confirm('Tem certeza que deseja excluir este card?')) {
                  if (targetTab === 'comercial') await deleteCommercialCard(card.id);
                  else if (targetTab === 'integracao') await deleteFinancialCard(card.id);
                  else if (targetTab === 'operacao') await deleteOperationCard(card.id);
                  else if (targetTab === 'internal_tasks') await deleteInternalTaskCard(card.id);
                }
              }}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
              title="Excluir Atendimento"
            >
              <Trash2 size={12} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (targetTab === 'comercial') await completeCommercialCard(card.id);
                else if (targetTab === 'integracao') await completeFinancialCard(card.id);
                else if (targetTab === 'operacao') await completeOperationCard(card.id);
                else if (targetTab === 'internal_tasks') await completeInternalTaskCard(card.id);
              }}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
              title="Marcar como concluído"
            >
              <CheckSquare size={16} />
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {list && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/50">
              {list.name}
            </span>
          )}

          {card.recurrence?.enabled && (
            <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md border border-blue-100">
              <RotateCcw size={10} />
              <span className="text-[9px] font-bold uppercase tracking-tighter">Recorrente</span>
            </div>
          )}
        </div>

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

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {total > 0 && (
              <div className={`flex items-center gap-1 text-[10px] font-bold ${completed === total ? 'text-green-600' : 'text-stone-500'}`}>
                <CheckSquare size={12} />
                <span>{completed}/{total}</span>
              </div>
            )}

            {(card.startDate || card.deliveryDate || card.recurrence?.enabled) && (
              <div className="flex flex-wrap items-center gap-2">
                {card.deliveryDate && (() => {
                  const proximity = getDateProximity(card.deliveryDate);
                  const colorClass = proximity === 'overdue' ? 'text-red-500' : proximity === 'near' ? 'text-orange-500' : 'text-stone-500';
                  return (
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${colorClass}`}>
                      <Calendar size={10} />
                      <span>{formatDate(card.deliveryDate)}</span>
                    </div>
                  );
                })()}
                {card.recurrence?.enabled && (() => {
                  const nextRec = getNextRecurrenceDate(card.recurrence);
                  if (!nextRec) return null;
                  const proximity = getDateProximity(nextRec);
                  const colorClass = proximity === 'overdue' ? 'text-red-500' : proximity === 'near' ? 'text-orange-500' : 'text-stone-500';
                  return (
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${colorClass}`}>
                      <RotateCcw size={10} />
                      <span>{formatDate(nextRec)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="flex -space-x-1.5">
            {card.assignees?.map((userId: string) => {
              const u = users.find(user => user.id === userId);
              if (!u) return null;
              return (
                <div key={userId} className="w-5 h-5 rounded-full border-2 border-white overflow-hidden bg-stone-100 shadow-sm" title={u.name}>
                  {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-stone-400">{u.name.charAt(0)}</div>}
                </div>
              );
            })}
          </div>
        </div>
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
        sector={
          quickViewTab === 'comercial' ? 'commercial' :
          quickViewTab === 'integracao' ? 'financial' :
          quickViewTab === 'operacao' ? 'operation' :
          'internal'
        }
      />
    </div>
  );
};
