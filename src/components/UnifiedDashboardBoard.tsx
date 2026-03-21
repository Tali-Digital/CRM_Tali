import React, { useState, useMemo } from 'react';
import { CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard, InternalTaskList, InternalTaskCard, Client, Tag, UserProfile } from '../types';
import { Plus, Settings, MoreVertical, CheckSquare, GripVertical, Edit2, User, Calendar as CalendarIcon, Clock, Search, Briefcase, Tag as TagIcon, X, LayoutGrid, Layers, AlignLeft, MousePointer2, RotateCcw, Trash2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { playSuccessSound, playDeleteSound } from '../utils/audio';
import { 
  completeCommercialCard, completeFinancialCard, completeOperationCard, completeInternalTaskCard,
  deleteCommercialCard, deleteFinancialCard, deleteOperationCard, deleteInternalTaskCard,
  duplicateCommercialCard, duplicateFinancialCard, duplicateOperationCard, duplicateInternalTaskCard
} from '../services/firestoreService';
import { CardOptionsMenu } from './CardOptionsMenu';
import { QuickViewCardModal } from './QuickViewCardModal';
import { CalendarDashboardView } from './CalendarDashboardView';

// Reusable helpers
const getNextRecurrenceDate = (recurrence: any) => {
  if (!recurrence || !recurrence.enabled) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let startDate = recurrence.lastTriggeredDate ? new Date(recurrence.lastTriggeredDate) : new Date();
  startDate.setHours(0, 0, 0, 0);
  if (recurrence.lastTriggeredDate) startDate.setDate(startDate.getDate() + 1);
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

const getLuminance = (hexColor: string) => {
  if (!hexColor || hexColor === '#ffffff') return 1;
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

const getDateStatus = (date: any) => {
  if (!date) return 'none';
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cardDate = new Date(d);
  cardDate.setHours(0, 0, 0, 0);
  
  if (cardDate < today) return 'overdue';
  if (cardDate.getTime() === today.getTime()) return 'today';
  
  const diffTime = cardDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) return 'near';
  
  return 'upcoming';
};

const formatDate = (date: any) => {
  if (!date) return '';
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// Stateless list filter helper
const filterCardsHelper = (cards: any[], lists: any[], sector: string, dashboardView: string, currentUserUid: string, users: UserProfile[], clients: Client[], searchTerm: string, selectedSector: string, selectedClient: string, selectedUser: string, selectedTag: string, hasDateOnly: boolean) => {
  const existingListIds = lists.map(l => l.id);
  let validCards = cards.filter(c => existingListIds.includes(c.listId) && !c.deleted && !c.completed);

  const currentUser = users.find(u => u.id === currentUserUid);
  const isAdmin = currentUser?.role === 'admin';

  if (dashboardView === 'minhas') {
    const assignedListIds = lists.filter(l => l.assignees?.includes(currentUserUid)).map(l => l.id);
    validCards = validCards.filter(c => {
      const isAssigned = assignedListIds.includes(c.listId) || c.assignees?.includes(currentUserUid);
      if (isAssigned) return true;
      if (isAdmin) {
        if (['overdue', 'today', 'near'].includes(getDateStatus(c.deliveryDate))) return true;
        if (['overdue', 'today', 'near'].includes(getDateStatus(getNextRecurrenceDate(c.recurrence)))) return true;
      }
      return false;
    });
  }

  return validCards.filter(c => {
    const client = clients.find(cl => cl.id === c.clientId);
    const title = (c.title || c.clientName || client?.name || '').toLowerCase();
    const matchesSearch = !searchTerm || title.includes(searchTerm.toLowerCase());
    const matchesSector = selectedSector === 'all' || sector === selectedSector;
    const matchesClient = selectedClient === 'all' || c.clientId === selectedClient;
    const matchesUser = selectedUser === 'all' || (c.assignees && Array.isArray(c.assignees) && c.assignees.includes(selectedUser));
    const matchesDate = !hasDateOnly || (!!c.deliveryDate || !!c.startDate);
    const hasTag = (client?.serviceTags && Array.isArray(client.serviceTags) && client.serviceTags.includes(selectedTag)) || 
                  (c.tags && Array.isArray(c.tags) && c.tags.includes(selectedTag));
    const matchesTag = selectedTag === 'all' || hasTag;
    return matchesSearch && matchesSector && matchesClient && matchesUser && matchesDate && matchesTag;
  });
};

const sortCardsByDeadline = (cards: any[]) => {
  const getWeight = (status: string) => {
    switch (status) {
      case 'overdue': return 0;
      case 'today': return 1;
      case 'near': return 2;
      case 'upcoming': return 3;
      default: return 4;
    }
  };

  return [...cards].sort((a, b) => {
    const statusA = getDateStatus(a.deliveryDate || getNextRecurrenceDate(a.recurrence));
    const statusB = getDateStatus(b.deliveryDate || getNextRecurrenceDate(b.recurrence));
    
    const weightA = getWeight(statusA);
    const weightB = getWeight(statusB);

    if (weightA !== weightB) return weightA - weightB;

    // Sub-sort by date
    const dateA = a.deliveryDate ? (a.deliveryDate instanceof Timestamp ? a.deliveryDate.toDate() : new Date(a.deliveryDate)) : getNextRecurrenceDate(a.recurrence);
    const dateB = b.deliveryDate ? (b.deliveryDate instanceof Timestamp ? b.deliveryDate.toDate() : new Date(b.deliveryDate)) : getNextRecurrenceDate(b.recurrence);

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    
    return dateA.getTime() - dateB.getTime();
  });
};

const DashboardCard = ({ 
  card, 
  lists, 
  targetTab, 
  clients, 
  users, 
  onQuickView,
  handleOpenMenu,
  onJumpToCard 
}: { 
  key?: any,
  card: any, 
  lists: any[], 
  targetTab: 'comercial' | 'integracao' | 'operacao' | 'internal_tasks',
  clients: Client[],
  users: UserProfile[],
  onQuickView: (card: any, tab: any) => void,
  handleOpenMenu: (e: React.MouseEvent, card: any, tab: any) => void,
  onJumpToCard?: (cardId: string, sector: string) => void
}) => {
  const [isFinishing, setIsFinishing] = useState(false);
  
  const handleComplete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playSuccessSound();
    setIsFinishing(true);
    
    setTimeout(async () => {
      if (targetTab === 'comercial') await completeCommercialCard(card.id);
      else if (targetTab === 'integracao') await completeFinancialCard(card.id);
      else if (targetTab === 'operacao') await completeOperationCard(card.id);
      else if (targetTab === 'internal_tasks') await completeInternalTaskCard(card.id);
    }, 600);
  };

  const client = clients.find(c => c.id === card.clientId);
  const list = lists.find(l => l.id === card.listId);
  const isClient = card.type === 'client' && client;
  const displayName = isClient ? client.name : (card.title || card.clientName || 'Card sem Título');
  const checklist = (card.checklist && card.checklist.length > 0) ? card.checklist : (isClient ? (client?.checklist || []) : []);
  const completed = checklist.filter((i: any) => i.completed).length;
  const total = checklist.length;

  const dateStatus = getDateStatus(card.deliveryDate);
  const isCardOverdue = dateStatus === 'overdue';
  const isCardDueToday = dateStatus === 'today';
  const isCardNearDue = dateStatus === 'near';
  
  const bgColor = isFinishing ? '#22c55e' : (isCardOverdue ? '#991b1b' : (isCardDueToday ? '#FEF2F2' : (isCardNearDue ? '#FFFBF5' : (card.color || '#ffffff'))));
  const isDarkBg = isFinishing || (isCardOverdue && !isFinishing);
  const textColorClass = isDarkBg ? 'text-white' : 'text-stone-900';
  const subTextColorClass = isDarkBg ? 'text-white/80' : 'text-stone-500';
  const borderColor = isFinishing ? '#16a34a' : (isCardOverdue ? '#7f1d1d' : (isCardDueToday ? '#FECACA' : (isCardNearDue ? '#FFEDD5' : (isDarkBg ? 'transparent' : '#e5e7eb'))));

  return (
    <div 
      onClick={() => !isFinishing && onJumpToCard?.(card.id, targetTab === 'internal_tasks' ? 'internal_tasks' : targetTab)}
      style={{ 
        backgroundColor: bgColor, 
        borderColor: borderColor,
        transform: isFinishing ? 'scale(1.02)' : 'none',
        zIndex: isFinishing ? 50 : undefined
      }}
      className={`p-3.5 rounded-2xl shadow-sm border-2 mb-2 cursor-pointer hover:shadow-md transition-all group relative card-draggable ${isDarkBg ? 'shadow-black/20' : ''} ${isFinishing ? 'shadow-[0_0_20px_rgba(34,197,94,0.4)] pointer-events-none' : ''}`}
    >
      {(isCardOverdue || isCardDueToday || isCardNearDue) && (
        <div className="flex items-center justify-between mb-2 px-1">
          <div 
            className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-white shadow-sm shadow-black/5 ${isCardNearDue ? 'bg-orange-500' : isCardOverdue ? 'bg-red-600' : ''}`}
            style={isCardDueToday ? { backgroundColor: '#ff3f42' } : undefined}
          >
            {isCardOverdue ? 'EM ATRASO' : isCardDueToday ? 'VENCE HOJE' : 'PERTO DE VENCER'}
          </div>
          <span className={`text-[9px] font-black ${isDarkBg ? 'text-white/80' : isCardNearDue ? 'text-orange-500' : 'text-red-500'}`}>
            {formatDate(card.deliveryDate)}
          </span>
        </div>
      )}
      
      <div className="flex justify-between items-start mb-1 gap-2">
        <h4 className={`font-extrabold text-[13px] leading-tight flex-1 ${textColorClass}`}>
          {isClient ? 'Atendimento Geral' : displayName}
        </h4>
        
        {!isClient && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              type="button"
              onClick={handleComplete}
              className={`p-1 rounded-lg transition-colors z-30 relative cursor-pointer ${isFinishing ? 'text-white' : (isDarkBg ? 'hover:bg-white/20 text-white/60 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-green-600')}`}
              title="Marcar como concluído"
            >
              <CheckSquare size={16} className={isFinishing ? 'animate-bounce' : ''} />
            </button>
            <button 
              type="button"
              onClick={(e) => handleOpenMenu(e, card, targetTab)}
              className={`p-1 rounded-lg transition-all z-30 relative cursor-pointer ${isDarkBg ? 'hover:bg-white/20 text-white/60 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-900'}`}
              title="Mais opções"
            >
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Hover Information Section */}
      <div className="opacity-0 max-h-0 group-hover:max-h-40 group-hover:opacity-100 group-hover:mb-3 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden space-y-2">
        {client && (
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg w-fit border ${isDarkBg ? 'bg-white/10 border-white/10' : 'bg-stone-50 border-stone-100'}`}>
            <User size={10} className={isDarkBg ? 'text-white/40' : 'text-stone-400'} />
            <span className={`text-[9px] font-black uppercase tracking-wider truncate max-w-[150px] ${isDarkBg ? 'text-white/80' : 'text-stone-500'}`}>
              {client.name}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {list && (
            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${isDarkBg ? 'bg-white/10 text-white border-white/20' : 'text-stone-500 bg-stone-100 border-stone-200/50'}`}>
              {list.name}
            </span>
          )}
          {card.recurrence?.enabled && (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${isDarkBg ? 'bg-blue-400/20 text-blue-300 border-blue-400/30' : 'bg-blue-50 text-blue-600 border-blue-100 font-black'}`}>
              <RotateCcw size={10} />
              <span className="text-[8px] font-black uppercase tracking-widest">Recorrente</span>
            </div>
          )}
          {total > 0 && (
            <div className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md bg-stone-50 border border-stone-100 ${isDarkBg ? 'text-white/90 bg-white/10' : (completed === total ? 'text-green-600' : 'text-stone-500')}`}>
              <CheckSquare size={10} />
              <span>{completed}/{total}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Area - Always visible responsible icons */}
      <div className="flex justify-end mt-1">
        <div className="flex -space-x-1.5">
          {card.assignees?.map((userId: string) => {
            const u = users.find(user => user.id === userId);
            if (!u) return null;
            return (
              <div key={userId} className={`w-5 h-5 rounded-full border-2 overflow-hidden shadow-sm ${isDarkBg ? 'border-white/20 bg-white/10' : 'border-white bg-stone-100'}`} title={u.name}>
                {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" /> : <div className={`w-full h-full flex items-center justify-center text-[7px] font-black ${isDarkBg ? 'text-white/60' : 'text-stone-400'}`}>{u.name.charAt(0)}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

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
  onJumpToCard?: (cardId: string, sector: string) => void;
  onUpdateCommercialCard: (id: string, data: any) => Promise<void>;
  onUpdateFinancialCard: (id: string, data: any) => Promise<void>;
  onUpdateOperationCard: (id: string, data: any) => Promise<void>;
  onUpdateInternalTaskCard: (id: string, data: any) => Promise<void>;
  setDashboardView: (view: 'minhas' | 'global') => void;
  userRole: string;
  viewMode: 'board' | 'calendar';
  setViewMode: (mode: 'board' | 'calendar') => void;
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
  onJumpToCard,
  onUpdateCommercialCard,
  onUpdateFinancialCard,
  onUpdateOperationCard,
  onUpdateInternalTaskCard,
  setDashboardView,
  userRole,
  viewMode,
  setViewMode,
}) => {
  const [quickViewCard, setQuickViewCard] = useState<any>(null);
  const [quickViewTab, setQuickViewTab] = useState<'comercial' | 'integracao' | 'operacao' | 'internal_tasks' | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuCard, setMenuCard] = React.useState<any>(null);
  const [menuTab, setMenuTab] = React.useState<'comercial' | 'integracao' | 'operacao' | 'internal_tasks' | null>(null);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

  // Sector Colors
  const [sectorColors, setSectorColors] = useState(() => {
    const saved = localStorage.getItem('sectorColors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing sectorColors from localStorage', e);
      }
    }
    return {
      comercial: '#ffbf00', // Amber
      integracao: '#3b82f6', // Blue
      operacao: '#22c55e', // Green
      internal_tasks: '#78716c' // Stone
    };
  });

  React.useEffect(() => {
    localStorage.setItem('sectorColors', JSON.stringify(sectorColors));
  }, [sectorColors]);
  
  // Dashboard Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [hasDateOnly, setHasDateOnly] = useState(false);

  const filteredCommercialCards = filterCardsHelper(commercialCards, commercialLists, 'comercial', dashboardView, currentUserUid, users, clients, searchTerm, selectedSector, selectedClient, selectedUser, selectedTag, hasDateOnly);
  const filteredFinancialCards = filterCardsHelper(financialCards, financialLists, 'integracao', dashboardView, currentUserUid, users, clients, searchTerm, selectedSector, selectedClient, selectedUser, selectedTag, hasDateOnly);
  const filteredOperationCards = filterCardsHelper(operationCards, operationLists, 'operacao', dashboardView, currentUserUid, users, clients, searchTerm, selectedSector, selectedClient, selectedUser, selectedTag, hasDateOnly);
  const filteredInternalCards = filterCardsHelper(internalTaskCards, internalTaskLists, 'internal_tasks', dashboardView, currentUserUid, users, clients, searchTerm, selectedSector, selectedClient, selectedUser, selectedTag, hasDateOnly);

  const { ref: boardRef, props: boardScrollProps, dragClassName } = useDraggableScroll();

  const allFilteredCards = useMemo(() => [
    ...filteredCommercialCards.map(c => ({...c, sector: 'comercial'})),
    ...filteredFinancialCards.map(c => ({...c, sector: 'integracao'})),
    ...filteredOperationCards.map(c => ({...c, sector: 'operacao'})),
    ...filteredInternalCards.map(c => ({...c, sector: 'internal_tasks'}))
  ], [filteredCommercialCards, filteredFinancialCards, filteredOperationCards, filteredInternalCards]);

  const handleOpenMenu = (e: React.MouseEvent, card: any, tab: any) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuCard(card);
    setMenuTab(tab);
    setAnchorRect(e.currentTarget.getBoundingClientRect());
    setMenuOpen(true);
  };

  const handleMenuAction = async (action: string) => {
    if (!menuCard || !menuTab) return;
    
    switch (action) {
      case 'open':
        setQuickViewCard(menuCard);
        setQuickViewTab(menuTab);
        break;
      case 'edit':
        onNavigate(menuTab);
        break;
      case 'copy':
      case 'duplicate':
        if (menuTab === 'comercial') await duplicateCommercialCard(menuCard.id);
        else if (menuTab === 'integracao') await duplicateFinancialCard(menuCard.id);
        else if (menuTab === 'operacao') await duplicateOperationCard(menuCard.id);
        else if (menuTab === 'internal_tasks') await duplicateInternalTaskCard(menuCard.id);
        break;
      case 'archive':
        playDeleteSound();
        if (window.confirm('Deseja excluir este card?')) {
          if (menuTab === 'comercial') await deleteCommercialCard(menuCard.id);
          else if (menuTab === 'integracao') await deleteFinancialCard(menuCard.id);
          else if (menuTab === 'operacao') await deleteOperationCard(menuCard.id);
          else if (menuTab === 'internal_tasks') await deleteInternalTaskCard(menuCard.id);
        }
        break;
      default:
        break;
    }
  };


  const FilterSection = () => (
    <div className="bg-white rounded-3xl border border-stone-200 p-4 mb-1 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        {/* Busca */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" size={14} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="BUSCA: NOME OU TÍTULO..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            />
          </div>
        </div>

        {/* Setor */}
        <div className="w-[180px]">
          <select 
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-900/10"
          >
            <option value="all">TODOS OS SETORES</option>
            <option value="comercial">COMERCIAL</option>
            <option value="integracao">INTEGRAÇÃO</option>
            <option value="operacao">OPERAÇÃO</option>
            <option value="internal_tasks">INTERNO</option>
          </select>
        </div>

        {/* Tag */}
        <div className="w-[180px]">
          <select 
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
          >
            <option value="all">TODAS AS TAGS</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name.toUpperCase()}</option>)}
          </select>
        </div>

        {/* Cliente */}
        <div className="w-[180px]">
          <select 
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-900/10"
          >
            <option value="all">TODOS OS CLIENTES</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
          </select>
        </div>

        {/* Responsável */}
        <div className="w-[180px]">
          <select 
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-stone-900/10"
          >
            <option value="all">TODOS OS RESPONSÁVEIS</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>)}
          </select>
        </div>

        {/* Toggle Data */}
        <div className="w-[180px]">
          <button 
            onClick={() => setHasDateOnly(!hasDateOnly)}
            className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${hasDateOnly ? 'bg-stone-900 border-stone-900 text-white shadow-md' : 'bg-stone-50 border border-stone-200 text-stone-400 hover:bg-stone-100'}`}
          >
            {hasDateOnly ? <CalendarIcon size={12} /> : <Clock size={12} />}
            {hasDateOnly ? 'COM PRAZO' : 'TODOS OS CARDS'}
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
    <div className="flex flex-col h-full bg-[#fdfdfd] overflow-hidden">
      {/* Search Header */}
      <div className="flex justify-between items-center mb-1 py-1 px-2">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
          <p className="text-stone-500 text-sm mt-0.5 font-medium">
            Visão geral das atividades. Cards onde você está atribuído, em atraso ou próximos do vencimento.
          </p>
        </div>
      </div>

      <div className="px-2 pb-2">
        <FilterSection />
      </div>

      <div className="flex-1 min-h-0 px-1 overflow-visible">
        {viewMode === 'board' ? (
          <div 
            ref={boardRef}
            {...boardScrollProps}
            className={`flex gap-6 overflow-x-auto pb-4 h-full custom-scrollbar pr-4 ${dragClassName}`}
          >
            {[
              { id: 'comercial', name: 'Comercial', cards: sortCardsByDeadline(filteredCommercialCards), lists: commercialLists, tab: 'comercial' },
              { id: 'integracao', name: 'Integração', cards: sortCardsByDeadline(filteredFinancialCards), lists: financialLists, tab: 'integracao' },
              { id: 'operacao', name: 'Operação', cards: sortCardsByDeadline(filteredOperationCards), lists: operationLists, tab: 'operacao' },
              { id: 'internal_tasks', name: 'Tarefas Internas', cards: sortCardsByDeadline(filteredInternalCards), lists: internalTaskLists, tab: 'internal_tasks' }
            ].filter(s => selectedSector === 'all' || s.id === selectedSector).map(sector => (
              <div key={sector.id} className="flex flex-col rounded-3xl bg-[#E6E6E6] shadow-sm min-w-[340px] w-[340px] border border-stone-300/50 overflow-hidden relative group/sector">
                {/* Color Strip */}
                <div 
                  className="h-1.5 w-full shrink-0" 
                  style={{ backgroundColor: sectorColors[sector.id as keyof typeof sectorColors] }}
                />
                
                <div className="p-5 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-6 px-2 shrink-0">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sectorColors[sector.id as keyof typeof sectorColors], width: '8px', height: '8px' }}></span>
                        {sector.name}
                      </h2>
                      <span className="bg-stone-200/50 text-stone-500 text-[10px] font-black px-2 py-0.5 rounded-full border border-stone-300/50">{sector.cards.length}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover/sector:opacity-100 transition-opacity">
                      <input 
                        type="color" 
                        value={sectorColors[sector.id as keyof typeof sectorColors]}
                        onChange={(e) => setSectorColors(prev => ({ ...prev, [sector.id]: e.target.value }))}
                        className="w-4 h-4 rounded-full overflow-hidden border-0 p-0 bg-transparent cursor-pointer"
                        title="Trocar Cor"
                      />
                    </div>
                  </div>
                  
                  {/* Individual Scroll Area */}
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 pb-4">
                    {sector.cards.map(card => (
                      <DashboardCard 
                        key={card.id}
                        card={card}
                        lists={sector.lists}
                        targetTab={sector.tab as any}
                        clients={clients}
                        users={users}
                        onQuickView={(c, tab) => { setQuickViewCard(c); setQuickViewTab(tab); }}
                        handleOpenMenu={handleOpenMenu}
                        onJumpToCard={onJumpToCard}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
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
        allCommercialCards={commercialCards}
        allFinancialCards={financialCards}
        allOperationCards={operationCards}
        allInternalTaskCards={internalTaskCards}
        onJumpToCard={(targetCard, targetSector) => {
          setQuickViewCard(targetCard);
          setQuickViewTab(targetSector as any);
        }}
      />

      <CardOptionsMenu 
        isOpen={menuOpen} 
        onClose={() => setMenuOpen(false)} 
        anchorRect={anchorRect}
        onAction={handleMenuAction}
      />
    </div>
  );
};
