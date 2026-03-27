import React, { useState, useEffect } from 'react';
import { 
  CommercialList, CommercialCard, 
  FinancialList, FinancialCard, 
  OperationList, OperationCard, 
  InternalTaskList, InternalTaskCard, 
  CompanyType, Client, Tag, UserProfile, SectorCardFilter, Sector
} from '../types';
import { playSuccessSound, playDeleteSound } from '../utils/audio';
import { 
  // Commercial
  addCommercialList, addCommercialCard, updateCommercialCard, updateCommercialList, deleteCommercialList, 
  deleteCommercialCard, completeCommercialCard, duplicateCommercialCard,
  // Financial
  addFinancialList, addFinancialCard, updateFinancialCard, updateFinancialList, deleteFinancialList, 
  deleteFinancialCard, completeFinancialCard, duplicateFinancialCard,
  // Operation
  addOperationList, addOperationCard, updateOperationCard, updateOperationList, deleteOperationList, 
  deleteOperationCard, completeOperationCard, duplicateOperationCard,
  // Internal
  addInternalTaskList, addInternalTaskCard, updateInternalTaskCard, updateInternalTaskList, deleteInternalTaskList, 
  deleteInternalTaskCard, completeInternalTaskCard, duplicateInternalTaskCard,
  // Dynamic
  addDynamicList, updateDynamicList, deleteDynamicList,
  addDynamicCard, updateDynamicCard, deleteDynamicCard, completeDynamicCard, duplicateDynamicCard
} from '../services/firestoreService';
import { Plus, Settings, MoreVertical, CheckSquare, GripVertical, Edit2, User, Calendar, CheckCircle2, Archive, RotateCcw, Trash2, MousePointer2, LayoutGrid, Layers } from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { Timestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Modal } from './Modal';
import { ListSettingsModal } from './ListSettingsModal';
import { UnifiedCardModal } from './UnifiedCardModal';
import { QuickViewCardModal } from './QuickViewCardModal';
import { CardOptionsMenu } from './CardOptionsMenu';
import { CalendarDashboardView } from './CalendarDashboardView';
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { useHistory } from '../context/HistoryContext';
import { auth } from '../firebase';
import { CSS } from '@dnd-kit/utilities';

export type SectorType = 'commercial' | 'financial' | 'operation' | 'internal_tasks';

interface UnifiedSectorViewProps {
  sector: SectorType;
  viewMode: 'kanban' | 'list' | 'vertical' | 'calendar';
  cardFilter: SectorCardFilter;
  companyId: CompanyType;
  lists: any[];
  cards: any[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  onMoveToSector: (card: any, targetSector: string) => void;
  // All cards for related tasks
  allCommercialCards?: CommercialCard[];
  allFinancialCards?: FinancialCard[];
  allOperationCards?: OperationCard[];
  allInternalTaskCards?: InternalTaskCard[];
  jumpToCard?: { id: string, sector: string, mode?: 'view' | 'edit' } | null;
  onClearJump?: () => void;
  onJumpToCard?: (cardId: string, sector: string, mode?: 'view' | 'edit') => void;
  allSectors?: Sector[];
  userRole?: string;
  // Drag props from parent
  activeId?: string | null;
  activeCard?: any | null;
}

const SortableCard = ({ card, client, tags, users, onEdit, onQuickView, onUpdateCard, onDuplicate, onArchive, onComplete, viewMode, isHighlighted, sector, userRole }: any) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

  const handleOpenMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchorRect(e.currentTarget.getBoundingClientRect());
    setMenuOpen(true);
  };

  const handleMenuAction = async (action: string) => {
    switch (action) {
      case 'open':
        onQuickView(card);
        break;
      case 'edit':
        onEdit(card);
        break;
      case 'duplicate':
        await onDuplicate(card.id);
        break;
      case 'archive':
        playDeleteSound();
        if (window.confirm('Deseja excluir este card?')) {
          await onArchive(card.id);
        }
        break;
      default:
        break;
    }
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: card.id,
    data: { type: 'Card', card }
  });

  const [isFinishing, setIsFinishing] = useState(false);

  const handleComplete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playSuccessSound();
    setIsFinishing(true);
    
    setTimeout(async () => {
      await onComplete(card.id);
    }, 600);
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const isClient = card.type === 'client' && client;
  const title = isClient ? client.name : (card.title || card.clientName || 'Card sem Título');
  const checklist = (card.checklist && card.checklist.length > 0) ? card.checklist : (isClient ? (client?.checklist || []) : []);
  const completed = checklist.filter((i: any) => i.completed).length;
  const total = checklist.length;
  
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

  const dateStatus = getDateStatus(card.deliveryDate);
  const isCardOverdue = dateStatus === 'overdue';
  const isCardDueToday = dateStatus === 'today';
  const isCardNearDue = dateStatus === 'near';
  
  const selectedStatus = card.statusTags && card.statusTags.length > 0 ? card.statusTags[0] : null;

  let bgColor = isFinishing ? '#22c55e' : (isCardOverdue ? '#991b1b' : (isCardDueToday ? '#FEF2F2' : (isCardNearDue ? '#FFFBF5' : (card.color || '#ffffff'))));
  let borderColor = isFinishing ? '#16a34a' : (isCardOverdue ? '#7f1d1d' : (isCardDueToday ? '#FECACA' : (isCardNearDue ? '#FFEDD5' : (card.color ? 'transparent' : '#e5e7eb'))));

  if (!isFinishing && selectedStatus) {
    if (selectedStatus === 'aguardando equipe') {
      bgColor = '#eff6ff'; // blue-50
      borderColor = '#dbeafe'; // blue-100
    } else if (selectedStatus === 'em aprovação') {
      bgColor = '#f0fdf4'; // green-50
      borderColor = '#dcfce7'; // green-100
    }
  }

  const isDarkBg = isFinishing || (isCardOverdue && !isFinishing && !selectedStatus);
  const textColorClass = isDarkBg ? 'text-white' : 'text-stone-900';
  const subTextColorClass = isDarkBg ? 'text-white/80' : 'text-stone-500';
  const iconColorClass = isDarkBg ? 'text-white/60 hover:text-white' : 'text-stone-400 hover:text-stone-600';

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const isCompact = viewMode === 'list';

  if (isClient) {
    if (isCompact) {
      return (
        <div 
          id={`card-${card.id}`}
          ref={setNodeRef}
          style={{ 
            ...style, 
            backgroundColor: isFinishing ? '#22c55e' : bgColor, 
            borderColor: isFinishing ? '#16a34a' : borderColor,
            transform: isFinishing ? `${style.transform} scale(1.02)` : style.transform,
            zIndex: isFinishing ? 50 : undefined
          }}
          className={`px-3 py-2 rounded-xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer flex items-center justify-between gap-3 mb-1 card-draggable ${isDragging ? 'card-placeholder' : ''} ${isHighlighted ? 'highlight-pulse' : ''} ${isFinishing ? 'shadow-[0_0_20px_rgba(34,197,94,0.4)] pointer-events-none' : ''}`}
          onClick={() => !isFinishing && onQuickView(card)}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${client.themeColor === 'blue' ? 'text-[#5271FF]' : 'text-yellow-400'} shrink-0 card-draggable`}>
              <GripVertical size={12} />
            </div>
            <div className={`p-0.5 rounded-lg ${isDarkBg ? 'bg-white/20' : (client.themeColor === 'blue' ? 'bg-[#5271FF]/20' : 'bg-yellow-400/20')}`}>
              <User size={10} className={textColorClass} />
            </div>
             <div className="flex items-center gap-1.5 min-w-0">
               <h4 className={`font-black text-xs truncate ${textColorClass}`}>{title}</h4>
              {card.recurrence?.enabled && (
                <RotateCcw size={10} className={textColorClass} />
              )}
            </div>
            {card.statusTags && card.statusTags.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {card.statusTags.includes('aguardando equipe') && (userRole !== 'equipe') && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Aguardando Equipe" />
                )}
                {card.statusTags.includes('em aprovação') && (userRole !== 'equipe') && (
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Em Aprovação" />
                )}
              </div>
            )}
            {total > 0 && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold shrink-0 ${completed === total ? (client.themeColor === 'blue' ? 'bg-blue-600 text-white' : 'bg-yellow-600 text-white') : (isDarkBg ? 'bg-white/20 text-white' : (client.themeColor === 'blue' ? 'bg-blue-50 text-blue-500 border border-blue-100' : 'bg-yellow-50 text-yellow-500 border border-yellow-100'))}`}>
                <CheckSquare size={8} />
                {completed}/{total}
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div 
        id={`card-${card.id}`}
        ref={setNodeRef}
        style={{ 
          ...style, 
          backgroundColor: isFinishing ? '#22c55e' : bgColor, 
          borderColor: isFinishing ? '#16a34a' : borderColor,
          transform: isFinishing ? `${style.transform} scale(1.02)` : style.transform,
          zIndex: isFinishing ? 50 : undefined
        }}
        className={`p-0 rounded-2xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer relative overflow-hidden ring-2 ring-white ring-inset mb-2 card-draggable ${isDragging ? 'card-placeholder' : ''} ${isHighlighted ? 'highlight-pulse' : ''} ${isFinishing ? 'shadow-[0_0_20px_rgba(34,197,94,0.4)] pointer-events-none' : ''}`}
        onClick={() => !isFinishing && onQuickView(card)}
      >
        <div className={`p-2 flex items-center justify-between border-b ${isDarkBg ? 'border-white/10 bg-black/5' : (client.themeColor === 'blue' ? 'border-[#5271FF]/20 bg-[#5271FF]/90' : 'border-yellow-200/60 bg-yellow-200/40')}`}>
          <div className="flex items-center gap-1">
            <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${client.themeColor === 'blue' || isDarkBg ? 'text-white' : 'text-yellow-400'} card-draggable`}>
              <GripVertical size={12} />
            </div>
            <div className="flex items-center gap-1">
              <div className={`p-0.5 rounded-lg ${isDarkBg ? 'bg-white/20' : (client.themeColor === 'blue' ? 'bg-white/10' : 'bg-yellow-400/20')}`}>
                <User size={10} className={client.themeColor === 'blue' || isDarkBg ? 'text-white' : textColorClass} />
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${client.themeColor === 'blue' || isDarkBg ? 'text-white' : textColorClass}`}>Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {(isCardOverdue || isCardDueToday || isCardNearDue) && (
              <div 
                className={`px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest text-white animate-pulse ${isCardNearDue ? 'bg-orange-500' : isCardOverdue ? 'bg-red-600' : ''}`}
                style={isCardDueToday ? { backgroundColor: '#ff3f42' } : undefined}
              >
                {isCardOverdue ? 'EM ATRASO' : isCardDueToday ? 'VENCE HOJE' : 'PERTO DE VENCER'}
              </div>
            )}
            {card.statusTags && card.statusTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {card.statusTags.includes('aguardando equipe') && (userRole !== 'equipe') && (
                  <span className={`px-1.5 py-0.5 rounded-full ${isDarkBg ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600 border border-blue-200'} text-[6.5px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm`}>
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                    Aguardando Equipe
                  </span>
                )}
                {card.statusTags.includes('em aprovação') && (userRole !== 'equipe') && (
                  <span className={`px-1.5 py-0.5 rounded-full ${isDarkBg ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600 border border-green-200'} text-[6.5px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm`}>
                    <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                    Em Aprovação
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-black text-xs leading-tight ${textColorClass}`}>{title}</h4>
            {card.recurrence?.enabled && (
              <RotateCcw size={10} className={textColorClass} />
            )}
          </div>
          
          <div className="mt-2 flex items-center justify-between">
            <div className="flex -space-x-1">
              {card.assignees?.slice(0, 2).map((userId: string) => {
                const u = users.find(user => user.id === userId);
                if (!u) return null;
                return (
                  <div key={userId} className="w-4 h-4 rounded-full border border-white overflow-hidden bg-stone-100" title={u.name}>
                    {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-[6px] font-bold text-stone-400">{u.name.charAt(0)}</div>}
                  </div>
                );
              })}
            </div>
            
            {total > 0 && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${completed === total ? (client.themeColor === 'blue' ? 'bg-blue-600 text-white' : 'bg-yellow-600 text-white') : (client.themeColor === 'blue' ? 'bg-blue-200/50 text-blue-700' : 'bg-yellow-200/50 text-yellow-700')}`}>
                <CheckSquare size={8} />
                {completed}/{total}
              </div>
            )}
          </div>
        </div>
        <CardOptionsMenu 
          isOpen={menuOpen} 
          onClose={() => setMenuOpen(false)} 
          anchorRect={anchorRect}
          onAction={handleMenuAction}
        />
      </div>
    );
  }

  if (isCompact) {
    return (
      <div 
        id={`card-${card.id}`}
        ref={setNodeRef}
        style={{ 
          ...style, 
          backgroundColor: isFinishing ? '#22c55e' : bgColor, 
          borderColor: isFinishing ? '#16a34a' : borderColor,
          transform: isFinishing ? `${style.transform} scale(1.02)` : style.transform,
          zIndex: isFinishing ? 50 : undefined
        }}
        className={`px-3 py-2 rounded-xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer flex items-center justify-between gap-3 mb-1 card-draggable ${isDragging ? 'card-placeholder' : ''} ${isHighlighted ? 'highlight-pulse' : ''} ${isFinishing ? 'shadow-[0_0_20px_rgba(34,197,94,0.4)] pointer-events-none' : ''}`}
        onClick={() => !isFinishing && onQuickView(card)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${iconColorClass} shrink-0`}>
            <GripVertical size={14} />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h4 className={`font-extrabold text-xs truncate ${textColorClass}`}>{title}</h4>
            {card.recurrence?.enabled && (
              <RotateCcw size={10} className={textColorClass} />
            )}
          </div>
          {card.statusTags && card.statusTags.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {card.statusTags.includes('aguardando equipe') && (userRole !== 'equipe') && (
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Aguardando Equipe" />
              )}
              {card.statusTags.includes('em aprovação') && (userRole !== 'equipe') && (
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Em Aprovação" />
              )}
              </div>
          )}
          {total > 0 && (
            <div className={`flex items-center gap-1.5 text-[10px] font-bold shrink-0 ${isDarkBg ? 'text-white/90' : (completed === total ? 'text-green-600' : 'text-stone-500')}`}>
              <CheckSquare size={10} />
              <span>{completed}/{total}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handleComplete}
            className={`p-1 rounded-lg transition-colors shrink-0 z-30 relative cursor-pointer ${isFinishing ? 'text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-green-600'}`}
            title="Marcar como concluído"
          >
            <CheckCircle2 size={16} className={isFinishing ? 'animate-bounce' : ''} />
          </button>
          <button 
            type="button"
            onClick={handleOpenMenu}
            className={`p-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer text-pencil-button ${isDarkBg ? 'hover:bg-white/20 text-white/60 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-900'}`}
            title="Mais opções"
          >
            <Edit2 size={14} />
          </button>
        </div>
        <CardOptionsMenu 
          isOpen={menuOpen} 
          onClose={() => setMenuOpen(false)} 
          anchorRect={anchorRect}
          onAction={handleMenuAction}
        />
      </div>
    );
  }

  return (
    <div
      id={`card-${card.id}`}
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: isFinishing ? '#22c55e' : bgColor,
        borderColor: isFinishing ? '#16a34a' : borderColor,
        transform: isFinishing ? `${style.transform} scale(1.02)` : style.transform,
        zIndex: isFinishing ? 50 : undefined
      }}
      className={`p-4 rounded-2xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer relative mb-3 ${isDragging ? 'card-placeholder' : ''} ${isHighlighted ? 'highlight-pulse' : ''} ${isFinishing ? 'shadow-[0_0_30px_rgba(34,197,94,0.5)] pointer-events-none text-white' : ''}`}
      onClick={() => !isFinishing && onQuickView(card)}
    >
      {(isCardOverdue || isCardDueToday || isCardNearDue) && (
        <div className="flex items-center justify-between mb-3 px-1">
          <div 
            className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-white shadow-sm shadow-black/5 ${isCardNearDue ? 'bg-orange-500' : isCardOverdue ? 'bg-red-600' : ''}`}
            style={isCardDueToday ? { backgroundColor: '#ff3f42' } : undefined}
          >
            {isCardOverdue ? 'EM ATRASO' : isCardDueToday ? 'VENCE HOJE' : 'PERTO DE VENCER'}
          </div>
          <span className={`text-[9px] font-black transition-opacity duration-200 opacity-0 group-hover:opacity-100 ${isDarkBg ? 'text-white/80' : isCardNearDue ? 'text-orange-500' : 'text-red-500'}`}>
            {formatDate(card.deliveryDate)}
          </span>
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${iconColorClass}`}>
            <GripVertical size={14} />
          </div>
          <div className="flex flex-col">
            <h4 className={`font-extrabold text-sm ${textColorClass} flex items-center gap-2`}>
              {title}
              {card.recurrence?.enabled && (
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${isDarkBg ? 'bg-blue-400/20 text-blue-300 border-blue-400/30' : 'bg-blue-50 text-blue-600 border-blue-100 font-black'}`}>
                  <RotateCcw size={10} />
                  <span className="text-[8px] font-black uppercase tracking-widest">Recorrente</span>
                </div>
              )}
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleComplete}
            className={`p-1 rounded-lg transition-colors z-30 relative cursor-pointer ${isFinishing ? 'text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-green-600'}`}
            title="Marcar como concluído"
          >
            <CheckSquare size={16} className={isFinishing ? 'animate-bounce' : ''} />
          </button>
          <button
            type="button"
            onClick={handleOpenMenu}
            className={`p-1 rounded-lg transition-all z-30 relative cursor-pointer text-pencil-button ${isDarkBg ? 'hover:bg-white/20 text-white/60 hover:text-white' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-900'}`}
            title="Mais opções"
          >
            <Edit2 size={14} />
          </button>
        </div>
      </div>

      {card.statusTags && card.statusTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.statusTags.includes('aguardando equipe') && (userRole !== 'equipe') && (
            <span className={`px-1.5 py-0.5 rounded-full ${isDarkBg ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600 border border-blue-200'} text-[6.5px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm`}>
              <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
              Aguardando Equipe
            </span>
          )}
          {card.statusTags.includes('em aprovação') && (userRole !== 'equipe') && (
            <span className={`px-1.5 py-0.5 rounded-full ${isDarkBg ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600 border border-green-200'} text-[6.5px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm`}>
              <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
              Em Aprovação
            </span>
          )}
          </div>
      )}
      {total > 0 && (
        <div className={`flex items-center gap-1.5 text-[10px] font-bold ml-6 transition-opacity duration-200 opacity-0 group-hover:opacity-100 ${isDarkBg ? 'text-white/90' : (completed === total ? 'text-green-600' : 'text-stone-500')}`}>
          <CheckSquare size={12} />
          <span>{completed}/{total}</span>
        </div>
      )}

      {(card.startDate || card.deliveryDate) && !isCardOverdue && !isCardDueToday && !isCardNearDue && (
        <div className="flex items-center gap-3 ml-6 mt-2 transition-opacity duration-200 opacity-0 group-hover:opacity-100">
          {card.startDate && (
            <div className={`flex items-center gap-1 text-[10px] font-bold ${isDarkBg ? 'text-white/80' : 'text-stone-500'}`}>
              <Calendar size={10} />
              <span>{formatDate(card.startDate)}</span>
            </div>
          )}
          {card.deliveryDate && (
            <div className={`flex items-center gap-1 text-[10px] font-bold ${isDarkBg ? 'text-white' : 'text-stone-500'}`}>
              <Calendar size={10} />
              <span>{formatDate(card.deliveryDate)}</span>
            </div>
          )}
        </div>
      )}

        <div className="flex items-center justify-between mt-3 ml-6">
          <div className="flex -space-x-2">
            {card.assignees?.map((userId: string) => {
              const user = users.find(u => u.id === userId);
              if (!user) return null;
              return (
                <div 
                  key={user.id} 
                  title={user.name}
                  className={`w-5 h-5 rounded-full border overflow-hidden flex items-center justify-center shadow-sm ${isDarkBg ? 'border-white/20 bg-white/10' : 'border-white bg-stone-200'}`}
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className={`text-[8px] font-bold ${isDarkBg ? 'text-white/60' : 'text-stone-600'}`}>{user.name.charAt(0)}</span>
                  )}
                </div>
              );
            })}
          </div>

          {client && (
            <div 
              title={`Cliente: ${client.name}`}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-opacity duration-200 opacity-0 group-hover:opacity-100 ${isDarkBg ? 'bg-white/10 border-white/10 text-white/80' : 'bg-stone-50 border-stone-100 text-stone-500'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${client.themeColor === 'yellow' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
              <span className="text-[9px] font-bold truncate max-w-[80px] uppercase tracking-tight">
                {client.name}
              </span>
            </div>
          )}
        </div>
        
        <CardOptionsMenu 
          isOpen={menuOpen} 
          onClose={() => setMenuOpen(false)} 
          anchorRect={anchorRect}
          onAction={handleMenuAction}
        />
    </div>
  );
};

const isLightColor = (color: string) => {
  if (!color) return true;
  if (!color.startsWith('#')) return true;
  const hex = color.replace('#', '');
  if (hex.length !== 6) return true;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
};

const SortableList = ({ list, cards, clients, tags, users, onEditCard, onQuickView, onSettings, onAddCard, onUpdateCard, viewMode, cardFilter, highlightedListId, highlightedCardId, sector, onDuplicate, onArchive, onComplete, userRole }: any) => {
  const [localFilter, setLocalFilter] = useState<SectorCardFilter>(cardFilter);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ 
    id: list.id,
    data: { type: 'List', list }
  });

  useEffect(() => {
    setLocalFilter(cardFilter);
  }, [cardFilter]);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(isDragging ? { zIndex: 40, position: 'relative' as const } : {}),
  };

  const hasClientsInSector = cards.some(c => c.clientId);
  const showActivities = localFilter === 'activities' || localFilter === 'both';
  const showClients = (localFilter === 'clients' || (localFilter === 'both' && hasClientsInSector));

  const isLight = isLightColor(list.color || '#E6E6E6');
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subtextColor = isLight ? 'text-stone-600/70' : 'text-white/70';
  const iconColor = isLight ? 'text-stone-400' : 'text-stone-400';
  const iconHoverColor = isLight ? 'hover:text-stone-900' : 'hover:text-white';
  const badgeBg = isLight ? 'bg-black/10' : 'bg-white/20';
  const badgeText = isLight ? 'text-stone-900' : 'text-white';

  const activities = cards
    .filter((c: any) => c.type !== 'client')
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  const clientIdsInList = [...new Set(cards.map((c: any) => c.clientId).filter(Boolean))];
  const virtualClientCards = clientIdsInList.map(clientId => {
    const existingCard = cards.find((c: any) => c.clientId === clientId && c.type === 'client');
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;

    return existingCard || {
      id: `virtual-${clientId}`,
      clientId,
      type: 'client',
      listId: list.id,
      order: 0,
      companyId: list.companyId,
      createdAt: client.createdAt,
      updatedAt: client.createdAt,
      title: client.name,
    };
  }).filter(Boolean);

  const allRenderedCardIds = [
    ...activities.map((c: any) => c.id),
    ...virtualClientCards.map((c: any) => c.id)
  ];

  return (
    <div 
      id={`list-${list.id}`}
      ref={setNodeRef} 
      style={{ ...style, backgroundColor: list.color || '#E6E6E6' }} 
      className={`${viewMode === 'kanban' ? 'w-[88vw] sm:w-[450px] h-full' : 'w-full'} shadow-xl rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 flex flex-col border border-stone-800/20 shrink-0 transition-all duration-500 ${highlightedListId === list.id ? 'highlight-pulse' : ''}`}
    >
      <div className="flex items-center justify-between mb-2 px-2 group/header">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing ${iconColor} ${iconHoverColor} transition-colors`}>
            <GripVertical size={16} />
          </div>
          <h3 className={`font-black uppercase tracking-widest text-sm drop-shadow-sm ${textColor}`}>{list.name}</h3>
          <span className={`opacity-0 group-hover/header:opacity-100 transition-opacity ${badgeBg} ${badgeText} text-[10px] font-black px-2 py-0.5 rounded-full border border-white/20 shadow-sm`}>
            {cards.length}
          </span>
        </div>
        <div className="flex items-center gap-3 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5">
            <button 
              onClick={() => setLocalFilter('activities')}
              className={`p-1 rounded-md transition-all ${localFilter === 'activities' ? 'bg-white/90 text-stone-900 shadow-sm' : 'text-white/40 hover:text-white'}`}
              title="Apenas Atividades"
            >
              <LayoutGrid size={12} />
            </button>
            <button 
              onClick={() => setLocalFilter('clients')}
              className={`p-1 rounded-md transition-all ${localFilter === 'clients' ? 'bg-white/90 text-stone-900 shadow-sm' : 'text-white/40 hover:text-white'}`}
              title="Apenas Clientes"
            >
              <User size={12} />
            </button>
            <button 
              onClick={() => setLocalFilter('both')}
              className={`p-1 rounded-md transition-all ${localFilter === 'both' ? 'bg-white/90 text-stone-900 shadow-sm' : 'text-white/40 hover:text-white'}`}
              title="Duo"
            >
              <Layers size={12} />
            </button>
          </div>
          <button onClick={onSettings} className={`${iconColor} ${iconHoverColor} p-1 rounded-lg hover:bg-white/20 transition-colors`}>
            <Settings size={16} />
          </button>
        </div>
      </div>

      <SortableContext
        id={list.id}
        items={allRenderedCardIds}
        strategy={verticalListSortingStrategy}
      >
        <div className={`flex-1 flex ${viewMode === 'kanban' ? 'gap-6' : 'flex-col gap-4'} min-h-[100px]`}>
          {showActivities && (
            <div className="flex-1 flex flex-col min-w-0">
              <div className={`text-[10px] font-black tracking-widest ${subtextColor} mb-3 uppercase flex items-center justify-between px-1 group/column`}>
                <span>Atividades</span>
                <span className={`opacity-0 group-hover/column:opacity-100 transition-opacity ${badgeBg} ${badgeText} px-1.5 py-0.5 rounded text-[8px] font-bold`}>{activities.length}</span>
              </div>
              <div className="flex-1 space-y-3 pr-1 overflow-y-auto custom-scrollbar">
                {activities.map((card: any) => (
                  <SortableCard 
                    key={card.id} 
                    card={card} 
                    client={clients.find(c => c.id === card.clientId)}
                    tags={tags}
                    users={users}
                    onEdit={onEditCard} 
                    onQuickView={onQuickView}
                    onUpdateCard={onUpdateCard}
                    onDuplicate={onDuplicate}
                    onArchive={onArchive}
                    onComplete={onComplete}
                    viewMode={viewMode}
                    isHighlighted={highlightedCardId === card.id}
                    sector={sector}
                    userRole={userRole}
                  />
                ))}
              </div>
            </div>
          )}
          {showClients && (
            <div className={`${viewMode === 'kanban' && localFilter === 'both' ? `w-40 border-l ${isLight ? 'border-black/5' : 'border-white/5'} pl-4` : 'w-full'} flex flex-col`}>
              <div className={`text-[10px] font-black tracking-widest ${subtextColor} mb-3 uppercase flex items-center justify-between px-1 group/column`}>
                <span>Clientes</span>
                <span className={`opacity-0 group-hover/column:opacity-100 transition-opacity ${badgeBg} ${badgeText} px-1.5 py-0.5 rounded text-[8px] font-bold`}>
                  {virtualClientCards.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 pr-1 overflow-y-auto custom-scrollbar">
                {virtualClientCards.map((cardToRender: any) => {
                  const client = clients.find(c => c.id === cardToRender.clientId);
                  if (!client) return null;

                  return (
                    <SortableCard 
                      key={cardToRender.id} 
                      card={cardToRender} 
                      client={client}
                      tags={tags}
                      users={users}
                      onEdit={onEditCard} 
                      onQuickView={onQuickView}
                      onUpdateCard={onUpdateCard}
                      onDuplicate={onDuplicate}
                      onArchive={onArchive}
                      onComplete={onComplete}
                      viewMode={viewMode}
                      isHighlighted={highlightedCardId === cardToRender.id}
                      sector={sector}
                      userRole={userRole}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SortableContext>

      <button 
        onClick={onAddCard}
        className="mt-3 w-full py-3 rounded-xl border-2 border-dashed border-stone-200 text-stone-500 font-bold text-sm hover:border-stone-300 hover:text-stone-700 transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} />
        Adicionar Item
      </button>
    </div>
  );
};

export const UnifiedSectorView: React.FC<UnifiedSectorViewProps> = ({ 
  sector, viewMode, cardFilter, companyId, lists, cards, clients, tags, users, onMoveToSector,
  allCommercialCards = [],
  allFinancialCards = [],
  allOperationCards = [],
  allInternalTaskCards = [],
  jumpToCard,
  onClearJump,
  onJumpToCard,
  allSectors = [],
  userRole,
  activeId,
  activeCard
}) => {
  const { ref: boardRef, props: boardScrollProps, dragClassName } = useDraggableScroll();

  const [isAddListOpen, setIsAddListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [addCardStep, setAddCardStep] = useState<'selection' | 'client' | 'custom'>('selection');
  const [newCardClientName, setNewCardClientName] = useState('');
  const [customCardTitle, setCustomCardTitle] = useState('');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  
  const [editingList, setEditingList] = useState<any | null>(null);
  const [editingCard, setEditingCard] = useState<any | null>(null);
  const [quickViewCard, setQuickViewCard] = useState<any>(null);
  const [quickViewSector, setQuickViewSector] = useState<any>(sector);
  const { pushAction } = useHistory();

  const [highlightedListId, setHighlightedListId] = useState<string | null>(null);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  // Mapeamento de Serviços
  const servicesMap: any = {
    commercial: {
      addList: addCommercialList,
      addCard: addCommercialCard,
      updateCard: updateCommercialCard,
      updateList: updateCommercialList,
      deleteList: deleteCommercialList,
      deleteCard: deleteCommercialCard,
      completeCard: completeCommercialCard,
      duplicateCard: duplicateCommercialCard
    },
    financial: {
      addList: addFinancialList,
      addCard: addFinancialCard,
      updateCard: updateFinancialCard,
      updateList: updateFinancialList,
      deleteList: deleteFinancialList,
      deleteCard: deleteFinancialCard,
      completeCard: completeFinancialCard,
      duplicateCard: duplicateFinancialCard
    },
    operation: {
      addList: addOperationList,
      addCard: addOperationCard,
      updateCard: updateOperationCard,
      updateList: updateOperationList,
      deleteList: deleteOperationList,
      deleteCard: deleteOperationCard,
      completeCard: completeOperationCard,
      duplicateCard: duplicateOperationCard
    },
    internal_tasks: {
      addList: addInternalTaskList,
      addCard: addInternalTaskCard,
      updateCard: updateInternalTaskCard,
      updateList: updateInternalTaskList,
      deleteList: deleteInternalTaskList,
      deleteCard: deleteInternalTaskCard,
      completeCard: completeInternalTaskCard,
      duplicateCard: duplicateInternalTaskCard
    }
  };

  const dynamicServices = {
    addList: (data: any) => addDynamicList({ ...data, sectorId: sector }),
    addCard: (data: any) => addDynamicCard({ ...data, sectorId: sector }),
    updateCard: updateDynamicCard,
    updateList: updateDynamicList,
    deleteList: deleteDynamicList,
    deleteCard: deleteDynamicCard,
    completeCard: completeDynamicCard,
    duplicateCard: duplicateDynamicCard
  };

  const services = servicesMap[sector] || dynamicServices;

  useEffect(() => {
    if (jumpToCard && jumpToCard.id && (
      (sector === 'commercial' && (jumpToCard.sector === 'commercial' || jumpToCard.sector === 'comercial')) ||
      (sector === 'financial' && (jumpToCard.sector === 'financial' || jumpToCard.sector === 'integracao')) ||
      (sector === 'operation' && (jumpToCard.sector === 'operation' || jumpToCard.sector === 'operacao')) ||
      (sector === 'internal_tasks' && (jumpToCard.sector === 'internal_tasks' || jumpToCard.sector === 'internal'))
    )) {
      const relevantCards = sector === 'commercial' ? allCommercialCards : 
                           sector === 'financial' ? allFinancialCards : 
                           sector === 'operation' ? allOperationCards : 
                           allInternalTaskCards;
      
      const targetCard = relevantCards.find(c => c.id === jumpToCard.id);
      if (targetCard) {
        setHighlightedListId(targetCard.listId);
        const listEl = document.getElementById(`list-${targetCard.listId}`);
        listEl?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        
        const cardTimer = setTimeout(() => {
          setHighlightedCardId(targetCard.id);
          const cardEl = document.getElementById(`card-${targetCard.id}`);
          cardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          const openTimer = setTimeout(() => {
            if (jumpToCard?.mode === 'edit') {
              setEditingCard(targetCard);
            } else {
              setQuickViewCard(targetCard);
            }
            setHighlightedCardId(null);
            setHighlightedListId(null);
            onClearJump?.();
          }, 1000);

          return () => clearTimeout(openTimer);
        }, 2000);

        return () => clearTimeout(cardTimer);
      }
    }
  }, [jumpToCard, sector, allCommercialCards, allFinancialCards, allOperationCards, allInternalTaskCards, onClearJump]);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      (window as any).__lastPointerX = e.clientX;
      (window as any).__lastPointerY = e.clientY;
    };
    window.addEventListener('pointermove', handleGlobalPointerMove);
    return () => window.removeEventListener('pointermove', handleGlobalPointerMove);
  }, []);

  const isSystemAdmin = userRole === 'admin';
  const visibleLists = lists.filter(list => {
    if (userRole === 'admin') return true;
    if (!list.visibleTo || list.visibleTo.length === 0) return false;
    if (!auth.currentUser?.uid) return false;
    return list.visibleTo.includes(auth.currentUser.uid);
  });

  const visibleListIds = visibleLists.sort((a, b) => (a.order || 0) - (b.order || 0)).map(l => l.id);
  const activeCards = cards.filter(c => !c.completed && !c.deleted && visibleListIds.includes(c.listId));

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newListName.trim()) {
      await services.addList({
        name: newListName.trim(),
        order: lists.length,
        companyId,
        color: '#E6E6E6'
      });
      setNewListName('');
      setIsAddListOpen(false);
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeListId) return;

    if (addCardStep === 'client' && newCardClientName.trim()) {
      const client = clients.find(c => c.name === newCardClientName);
      if (client) {
        const list = lists.find(l => l.id === activeListId);
        let checklist: any[] = [];
        if (list?.defaultChecklist) {
          checklist = list.defaultChecklist.map((text: string) => ({
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            text,
            completed: false
          }));
        }

        await services.addCard({
          clientId: client.id,
          type: 'client',
          listId: activeListId,
          order: cards.filter(c => c.listId === activeListId).length,
          companyId,
          checklist: checklist,
          title: null,
          clientName: client.name
        });
      }
    } else if (addCardStep === 'custom' && customCardTitle.trim()) {
      await services.addCard({
        title: customCardTitle.trim(),
        type: 'custom',
        listId: activeListId,
        order: cards.filter(c => c.listId === activeListId).length,
        companyId,
        checklist: [],
        clientId: null
      });
    }

    setIsAddCardOpen(false);
    setNewCardClientName('');
    setCustomCardTitle('');
    setAddCardStep('selection');
  };

  if (viewMode === 'calendar') {
    return (
      <CalendarDashboardView 
        cards={activeCards}
        clients={clients}
        users={users}
        onEditCard={(card) => {
          setEditingCard(card);
        }}
        onQuickView={(card) => {
          setQuickViewCard(card);
          setQuickViewSector(sector);
        }}
      />
    );
  }

  const getSectorInfo = () => {
    switch (sector) {
      case 'commercial': return { title: 'Comercial', subtitle: 'Gerencie as oportunidades de negócio da sua empresa.' };
      case 'financial': case 'integracao': return { title: 'Integração do Cliente', subtitle: 'Acompanhe e gerencie a integração dos novos clientes.' };
      case 'operation': case 'operacao': return { title: 'Operação Contínua', subtitle: 'Gerencie as atividades recorrentes e entregas contínuas.' };
      case 'internal': case 'internal_tasks': return { title: 'Tarefas Internas', subtitle: 'Organize as demandas internas da equipe.' };
      default: 
        const info = (allSectors as any[])?.find(s => s.id === sector);
        return { title: info?.name || 'Setor', subtitle: '' };
    }
  };

  const { title, subtitle } = getSectorInfo();

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fdfdfd] overflow-hidden p-6 md:p-8">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 py-1 px-2 gap-4 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-900 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-stone-500 text-[11px] md:text-sm mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col min-h-0 bg-[#F5F5F7] rounded-[2.5rem] overflow-hidden border border-stone-200 shadow-inner p-1`}>
      
        <div 
          ref={boardRef}
          {...boardScrollProps}
          className={`flex-1 overflow-x-auto overflow-y-hidden select-none p-4 sm:p-8 custom-scrollbar-horizontal flex gap-8 ${dragClassName || ''}`}
        >
          <SortableContext 
            items={visibleListIds}
            strategy={horizontalListSortingStrategy}
          >
            {visibleLists
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map(list => (
                <SortableList 
                  key={list.id} 
                  list={list} 
                  cards={activeCards.filter(c => c.listId === list.id)}
                  clients={clients}
                  tags={tags}
                  users={users}
                  onEditCard={setEditingCard} 
                  onQuickView={(card: any) => {
                    setQuickViewCard(card);
                    setQuickViewSector(sector);
                  }}
                  onSettings={() => setEditingList(list)}
                  onAddCard={() => {
                    setActiveListId(list.id);
                    setIsAddCardOpen(true);
                  }}
                  onUpdateCard={services.updateCard}
                  onDuplicate={services.duplicateCard}
                  onArchive={services.deleteCard}
                  onComplete={services.completeCard}
                  viewMode={viewMode}
                  cardFilter={cardFilter}
                  highlightedListId={highlightedListId}
                  highlightedCardId={highlightedCardId}
                  sector={sector}
                  userRole={userRole}
                />
              ))}
          </SortableContext>

          <button 
            onClick={() => setIsAddListOpen(true)}
            className="w-[88vw] sm:w-[450px] shrink-0 h-full bg-white/50 border-4 border-dashed border-stone-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-stone-400 hover:text-stone-600 hover:border-stone-300 hover:bg-white/80 transition-all group"
          >
            <div className="p-6 bg-stone-100 rounded-3xl group-hover:scale-110 transition-transform">
              <Plus size={40} />
            </div>
            <span className="font-black uppercase tracking-[0.2em] text-sm">Novo Setor</span>
          </button>
        </div>
      </div>
      

      {/* Modais de Criar Lista/Card */}
      <Modal isOpen={isAddListOpen} onClose={() => setIsAddListOpen(false)} title="Novo Setor" maxWidth="max-w-md">
        <form onSubmit={handleAddList} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Nome da Lista</label>
            <input 
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Ex: Pendente, Em Produção..."
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            />
          </div>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => setIsAddListOpen(false)}
              className="flex-1 py-4 rounded-2xl border border-stone-200 font-bold text-stone-600 hover:bg-stone-50 transition-all font-nunito"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={!newListName.trim()}
              className="flex-[2] bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed font-nunito"
            >
              Criar Lista
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isAddCardOpen} onClose={() => setIsAddCardOpen(false)} title="Adicionar ao Kanban" maxWidth="max-w-md">
        <form onSubmit={handleAddCard} className="space-y-6">
          {addCardStep === 'selection' && (
            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button"
                onClick={() => setAddCardStep('client')}
                className="flex flex-col items-center gap-4 p-8 rounded-[2rem] border-2 border-stone-100 hover:border-stone-900/10 hover:bg-stone-50 transition-all group"
              >
                <div className="p-4 bg-yellow-400/10 rounded-2xl text-yellow-600 group-hover:scale-110 transition-transform">
                  <User size={32} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-stone-600">Cliente</span>
              </button>
              <button 
                type="button"
                onClick={() => setAddCardStep('custom')}
                className="flex flex-col items-center gap-4 p-8 rounded-[2rem] border-2 border-stone-100 hover:border-stone-900/10 hover:bg-stone-50 transition-all group"
              >
                <div className="p-4 bg-stone-100 rounded-2xl text-stone-600 group-hover:scale-110 transition-transform">
                  <Edit2 size={32} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-stone-600">Personalizado</span>
              </button>
            </div>
          )}

          {addCardStep === 'client' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Selecionar Cliente</label>
                <select 
                  autoFocus
                  value={newCardClientName}
                  onChange={(e) => setNewCardClientName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 font-bold"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients
                    .filter(c => !cards.some(card => card.clientId === c.id && card.type === 'client' && card.listId === activeListId))
                    .map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setAddCardStep('selection')}
                  className="flex-1 py-4 rounded-2xl border border-stone-200 font-bold text-stone-600 hover:bg-stone-50 transition-all font-nunito"
                >
                  Voltar
                </button>
                <button 
                  type="submit" 
                  disabled={!newCardClientName.trim()}
                  className="flex-[2] bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed font-nunito"
                >
                  Adicionar Cliente
                </button>
              </div>
            </div>
          )}

          {addCardStep === 'custom' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Título do Card</label>
                <input 
                  autoFocus
                  value={customCardTitle}
                  onChange={(e) => setCustomCardTitle(e.target.value)}
                  placeholder="Ex: Nota de Reunião, Lembrete, etc."
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                />
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => setAddCardStep('selection')}
                  className="flex-1 py-4 rounded-2xl border border-stone-200 font-bold text-stone-600 hover:bg-stone-50 transition-all"
                >
                  Voltar
                </button>
                <button 
                  type="submit" 
                  disabled={!customCardTitle.trim()}
                  className="flex-[2] bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Criar Card
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {editingList && (
        <ListSettingsModal 
          isOpen={!!editingList} 
          onClose={() => setEditingList(null)} 
          list={editingList} 
          onUpdate={services.updateList}
          onDelete={services.deleteList}
        />
      )}

      {editingCard && (
        <UnifiedCardModal 
          isOpen={!!editingCard} 
          onClose={() => setEditingCard(null)} 
          card={editingCard}
          sector={sector}
          client={clients.find(c => c.id === editingCard?.clientId)}
          clients={clients}
          users={users}
          onMoveToSector={(target) => {
            if (editingCard) {
              onMoveToSector(editingCard, target);
              setEditingCard(null);
            }
          }}
          allSectors={allSectors}
        />
      )}

      <QuickViewCardModal 
        isOpen={!!quickViewCard}
        onClose={() => setQuickViewCard(null)}
        card={quickViewCard}
        client={clients.find(c => c.id === quickViewCard?.clientId)}
        users={users}
        tags={tags}
        onEdit={() => {
          if (quickViewCard) {
            setEditingCard(quickViewCard);
          }
        }}
        sector={quickViewSector}
        allCommercialCards={allCommercialCards}
        allFinancialCards={allFinancialCards}
        allOperationCards={allOperationCards}
        allInternalTaskCards={allInternalTaskCards}
        onJumpToCard={(targetTask, targetSector) => {
          setQuickViewCard(null);
          onJumpToCard?.(targetTask.id, targetSector);
        }}
        userRole={userRole}
      />
    </div>
  );
};
