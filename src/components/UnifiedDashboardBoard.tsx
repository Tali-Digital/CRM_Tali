import React, { useState, useMemo } from 'react';
import { CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard, InternalTaskList, InternalTaskCard, Client, Tag, UserProfile } from '../types';
import { Plus, Settings, MoreVertical, CheckSquare, GripVertical, Edit2, User, Calendar as CalendarIcon, Clock, Search, Briefcase, Tag as TagIcon, X, LayoutGrid, Layers, AlignLeft, MousePointer2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { completeCommercialCard, completeFinancialCard, completeOperationCard, completeInternalTaskCard } from '../services/firestoreService';
import { QuickViewCardModal } from './QuickViewCardModal';
import { RotateCcw, Trash2 } from 'lucide-react';
import { deleteCommercialCard, deleteFinancialCard, deleteOperationCard, deleteInternalTaskCard } from '../services/firestoreService';
import { CalendarDashboardView } from './CalendarDashboardView';

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
  setDashboardView: (view: 'minhas' | 'global') => void;
  userRole: string;
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
  setDashboardView,
  userRole,
}) => {
  const [quickViewCard, setQuickViewCard] = useState<any>(null);
  const [quickViewTab, setQuickViewTab] = useState<'comercial' | 'integracao' | 'operacao' | 'internal_tasks' | null>(null);
  const [viewMode, setViewMode] = useState<'board' | 'calendar'>('board');
  
  // Dashboard Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [hasDateOnly, setHasDateOnly] = useState(false);

  const getNextRecurrenceDate = (recurrence: any) => {
    if (!recurrence || !recurrence.enabled) return null;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let startDate = recurrence.lastTriggeredDate ? new Date(recurrence.lastTriggeredDate) : new Date();
    startDate.setHours(0, 0, 0, 0);

    if (recurrence.lastTriggeredDate) {
      startDate.setDate(startDate.getDate() + 1);
    }

    if (recurrence.period === 'daily') return startDate;

    if (recurrence.period === 'weekly' && recurrence.daysOfWeek?.length) {
      let nextDate = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        if (recurrence.daysOfWeek.includes(nextDate.getDay())) return nextDate;
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }

    if (recurrence.period === 'monthly' && recurrence.dayOfMonth) {
      let nextDate = new Date(startDate.getFullYear(), startDate.getMonth(), recurrence.dayOfMonth);
      if (nextDate < startDate) nextDate.setMonth(nextDate.getMonth() + 1);
      return nextDate;
    }

    if (recurrence.period === 'yearly' && recurrence.monthOfYear && recurrence.dayOfMonth) {
      let nextDate = new Date(startDate.getFullYear(), recurrence.monthOfYear - 1, recurrence.dayOfMonth);
      if (nextDate < startDate) nextDate.setFullYear(nextDate.getFullYear() + 1);
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

  const filterCards = (cards: any[], lists: any[], sector: string) => {
    const existingListIds = lists.map(l => l.id);
    let validCards = cards.filter(c => existingListIds.includes(c.listId) && !c.deleted && !c.completed);

    const currentUser = users.find(u => u.id === currentUserUid);
    const isAdmin = currentUser?.role === 'admin';

    // Base My Cards vs Global View
    if (dashboardView === 'minhas') {
      const assignedListIds = lists.filter(l => l.assignees?.includes(currentUserUid)).map(l => l.id);
      validCards = validCards.filter(c => {
        const isAssigned = assignedListIds.includes(c.listId) || c.assignees?.includes(currentUserUid);
        if (isAssigned) return true;
        if (isAdmin) {
          if (getDateProximity(c.deliveryDate) !== 'normal') return true;
          if (getDateProximity(getNextRecurrenceDate(c.recurrence)) !== 'normal') return true;
        }
        return false;
      });
    }

    // Apply Dashbaord Filters
    return validCards.filter(c => {
      const client = clients.find(cl => cl.id === c.clientId);
      const title = (c.title || c.clientName || client?.name || '').toLowerCase();
      
      const matchesSearch = title.includes(searchTerm.toLowerCase());
      const matchesSector = selectedSector === 'all' || sector === selectedSector;
      const matchesClient = selectedClient === 'all' || c.clientId === selectedClient;
      const matchesUser = selectedUser === 'all' || c.assignees?.includes(selectedUser);
      const matchesDate = !hasDateOnly || (!!c.deliveryDate || !!c.startDate);
      
      const matchesTag = selectedTag === 'all' || (client?.serviceTags?.includes(selectedTag));

      return matchesSearch && matchesSector && matchesClient && matchesUser && matchesDate && matchesTag;
    });
  };

  const filteredCommercialCards = filterCards(commercialCards, commercialLists, 'comercial');
  const filteredFinancialCards = filterCards(financialCards, financialLists, 'integracao');
  const filteredOperationCards = filterCards(operationCards, operationLists, 'operacao');
  const filteredInternalCards = filterCards(internalTaskCards, internalTaskLists, 'internal_tasks');

  const { ref: boardRef, props: boardScrollProps, dragClassName } = useDraggableScroll();

  const allFilteredCards = useMemo(() => [
    ...filteredCommercialCards.map(c => ({...c, sector: 'comercial'})),
    ...filteredFinancialCards.map(c => ({...c, sector: 'integracao'})),
    ...filteredOperationCards.map(c => ({...c, sector: 'operacao'})),
    ...filteredInternalCards.map(c => ({...c, sector: 'internal_tasks'}))
  ], [filteredCommercialCards, filteredFinancialCards, filteredOperationCards, filteredInternalCards]);

  const renderCard = (card: any, lists: any[], targetTab: 'comercial' | 'integracao' | 'operacao' | 'internal_tasks') => {
    const client = clients.find(c => c.id === card.clientId);
    const list = lists.find(l => l.id === card.listId);
    const isClient = card.type === 'client' && client;
    const displayName = isClient ? client.name : (card.title || card.clientName || 'Card sem Título');
    const checklist = client?.checklist || card.checklist || [];
    const completed = checklist.filter((i: any) => i.completed).length;
    const total = checklist.length;

    return (
      <div 
        key={card.id} 
        onClick={() => {
          setQuickViewCard(card);
          setQuickViewTab(targetTab);
        }}
        className="p-4 rounded-2xl shadow-sm border-2 mb-3 cursor-pointer hover:shadow-md transition-all group relative bg-white border-stone-200 card-draggable"
      >
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            {client && (
              <div className="flex items-center gap-1.5 mb-1 bg-stone-50 border border-stone-100 px-2 py-0.5 rounded-lg w-fit">
                <User size={10} className="text-stone-400" />
                <span className="text-[9px] font-black uppercase tracking-wider text-stone-500 truncate max-w-[150px]">
                  {client.name}
                </span>
              </div>
            )}
            <h4 className="font-extrabold text-sm leading-tight text-stone-900 truncate">
              {isClient ? 'Atendimento Geral' : displayName}
            </h4>
          </div>
          
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                onNavigate(targetTab);
              }}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-all z-30 relative cursor-pointer"
              title="Ver no Setor"
            >
              <Edit2 size={14} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault(); e.stopPropagation();
                if (window.confirm('Tem certeza que deseja excluir este card?')) {
                  if (targetTab === 'comercial') await deleteCommercialCard(card.id);
                  else if (targetTab === 'integracao') await deleteFinancialCard(card.id);
                  else if (targetTab === 'operacao') await deleteOperationCard(card.id);
                  else if (targetTab === 'internal_tasks') await deleteInternalTaskCard(card.id);
                }
              }}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-red-500 transition-all z-30 relative cursor-pointer"
              title="Excluir Atendimento"
            >
              <Trash2 size={14} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault(); e.stopPropagation();
                if (targetTab === 'comercial') await completeCommercialCard(card.id);
                else if (targetTab === 'integracao') await completeFinancialCard(card.id);
                else if (targetTab === 'operacao') await completeOperationCard(card.id);
                else if (targetTab === 'internal_tasks') await completeInternalTaskCard(card.id);
              }}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-green-600 transition-colors z-30 relative cursor-pointer"
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

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {total > 0 && (
              <div className={`flex items-center gap-1 text-[10px] font-bold ${completed === total ? 'text-green-600' : 'text-stone-500'}`}>
                <CheckSquare size={12} />
                <span>{completed}/{total}</span>
              </div>
            )}
            {(card.startDate || card.deliveryDate) && (
              <div className="flex items-center gap-2">
                {[card.deliveryDate].filter(Boolean).map((date, i) => {
                  const proximity = getDateProximity(date);
                  const colorClass = proximity === 'overdue' ? 'text-red-500' : proximity === 'near' ? 'text-orange-500' : 'text-stone-500';
                  return (
                    <div key={i} className={`flex items-center gap-1 text-[10px] font-bold ${colorClass}`}>
                      <CalendarIcon size={10} />
                      <span>{formatDate(date)}</span>
                    </div>
                  );
                })}
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

  const FilterSection = () => (
    <div className="bg-white rounded-3xl border border-stone-200 p-6 mb-8 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {/* Busca */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
            <Search size={12} /> Busca
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={14} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nome ou Título..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900/10 font-bold"
            />
          </div>
        </div>

        {/* Setor */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
            <Briefcase size={12} /> Setor
          </label>
          <select 
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900/10 font-bold"
          >
            <option value="all">Todos os Setores</option>
            <option value="comercial">Comercial</option>
            <option value="integracao">Integração</option>
            <option value="operacao">Operação</option>
            <option value="internal_tasks">Interno</option>
          </select>
        </div>

        {/* Tag */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
            <TagIcon size={12} /> Tag / Serviço
          </label>
          <select 
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900/10 font-bold transition-all"
          >
            <option value="all">Todas as Tags</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Cliente */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
            <User size={12} /> Cliente Central
          </label>
          <select 
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900/10 font-bold"
          >
            <option value="all">Todos os Clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Responsável */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
            <Clock size={12} /> Responsável
          </label>
          <select 
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900/10 font-bold"
          >
            <option value="all">Todos os Responsáveis</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Outros / Toggle Data */}
        <div className="space-y-2 flex flex-col justify-end">
          <button 
            onClick={() => setHasDateOnly(!hasDateOnly)}
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all border ${hasDateOnly ? 'bg-stone-900 border-stone-900 text-white shadow-md' : 'bg-stone-50 border-stone-200 text-stone-400 hover:bg-stone-100'}`}
          >
            {hasDateOnly ? <CalendarIcon size={12} /> : <Clock size={12} />}
            {hasDateOnly ? 'Somente com Prazo' : 'Todos os Cards'}
          </button>
        </div>
      </div>

      {(searchTerm || selectedSector !== 'all' || selectedTag !== 'all' || selectedClient !== 'all' || selectedUser !== 'all' || hasDateOnly) && (
        <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
          <p className="text-[10px] font-bold text-stone-400 italic">Filtrando {allFilteredCards.length} cards</p>
          <button 
            onClick={() => {
              setSearchTerm(''); setSelectedSector('all'); setSelectedTag('all'); setSelectedClient('all'); setSelectedUser('all'); setHasDateOnly(false);
            }}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
          >
            <X size={12} /> Limpar Filtros
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center gap-4 shrink-0 mb-2 flex-wrap">
        {userRole === 'admin' && (
          <div className="flex bg-stone-200 p-1 rounded-xl shadow-inner h-10 items-center">
            <button 
              onClick={() => setDashboardView('minhas')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all h-full ${dashboardView === 'minhas' ? 'bg-white shadow-md text-stone-900 border border-stone-100' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Meus Cards
            </button>
            <button 
              onClick={() => setDashboardView('global')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all h-full ${dashboardView === 'global' ? 'bg-white shadow-md text-stone-900 border border-stone-100' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Visão Global
            </button>
          </div>
        )}

        <div className="flex bg-stone-200 p-1 rounded-xl shadow-inner h-10 items-center">
          <button 
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all h-full ${viewMode === 'board' ? 'bg-white shadow-md text-stone-900 border border-stone-100' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <LayoutGrid size={14} /> Blocos
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all h-full ${viewMode === 'calendar' ? 'bg-white shadow-md text-stone-900 border border-stone-100' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <CalendarIcon size={14} /> Calendário
          </button>
        </div>
      </div>

      <FilterSection />

      <div className="min-h-0">
        {viewMode === 'board' ? (
          <div 
            ref={boardRef}
            {...boardScrollProps}
            className={`flex gap-6 overflow-x-auto pb-4 custom-scrollbar ${dragClassName}`}
          >
            <div className="flex flex-col rounded-3xl p-5 bg-[#1c222d] shadow-xl min-w-[340px] w-[340px] border border-stone-800/20">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Comercial
                  </h2>
                  <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-full border border-white/5">{filteredCommercialCards.length}</span>
                </div>
              </div>
              <div className="flex-1">
                {filteredCommercialCards.map(card => renderCard(card, commercialLists, 'comercial'))}
              </div>
            </div>

            <div className="flex flex-col rounded-3xl p-5 bg-[#1c222d] shadow-xl min-w-[340px] w-[340px] border border-stone-800/20">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    Integração
                  </h2>
                  <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-full border border-white/5">{filteredFinancialCards.length}</span>
                </div>
              </div>
              <div className="flex-1">
                {filteredFinancialCards.map(card => renderCard(card, financialLists, 'integracao'))}
              </div>
            </div>

            <div className="flex flex-col rounded-3xl p-5 bg-[#1c222d] shadow-xl min-w-[340px] w-[340px] border border-stone-800/20">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    Operação
                  </h2>
                  <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-full border border-white/5">{filteredOperationCards.length}</span>
                </div>
              </div>
              <div className="flex-1">
                {filteredOperationCards.map(card => renderCard(card, operationLists, 'operacao'))}
              </div>
            </div>

            <div className="flex flex-col rounded-3xl p-5 bg-[#1c222d] shadow-xl min-w-[340px] w-[340px] border border-stone-800/20">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-stone-500"></span>
                    Tarefas Internas
                  </h2>
                  <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-full border border-white/5">{filteredInternalCards.length}</span>
                </div>
              </div>
              <div className="flex-1">
                {filteredInternalCards.map(card => renderCard(card, internalTaskLists, 'internal_tasks'))}
              </div>
            </div>
          </div>
        ) : (
          <CalendarDashboardView 
            allCards={allFilteredCards} 
            clients={clients} 
            tags={tags} 
            users={users} 
            onCardClick={(card, sector) => {
              setQuickViewCard(card);
              setQuickViewTab(sector as any);
            }} 
          />
        )}
      </div>

      <QuickViewCardModal 
        isOpen={!!quickViewCard}
        onClose={() => { setQuickViewCard(null); setQuickViewTab(null); }}
        card={quickViewCard}
        client={clients.find(c => c.id === quickViewCard?.clientId)}
        users={users}
        tags={tags}
        onEdit={() => { if (quickViewTab) onNavigate(quickViewTab); }}
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
