import React, { useState, useEffect } from 'react';
import { CommercialList, CommercialCard, CompanyType, Client, Tag, UserProfile, SectorCardFilter } from '../types';
import { 
  addCommercialList, 
  addCommercialCard, 
  updateCommercialCard, 
  updateCommercialList, 
  deleteCommercialList, 
  updateClient, 
  deleteCommercialCard,
  completeCommercialCard,
  permanentDeleteCommercialCard
} from '../services/firestoreService';
import { Plus, Settings, MoreVertical, CheckSquare, GripVertical, Edit2, User, Calendar, CheckCircle2, Archive, RotateCcw, Trash2, MousePointer2, LayoutGrid, Layers } from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';
import { Timestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Modal } from './Modal';
import { ListSettingsModal } from './ListSettingsModal';
import { EditCommercialCardModal } from './EditCommercialCardModal';
import { QuickViewCardModal } from './QuickViewCardModal';
import { CalendarDashboardView } from './CalendarDashboardView';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHistory } from '../context/HistoryContext';

interface CommercialViewProps {
  viewMode: 'kanban' | 'list' | 'vertical' | 'calendar';
  cardFilter: SectorCardFilter;
  companyId: CompanyType;
  lists: CommercialList[];
  cards: CommercialCard[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  onMoveToSector: (card: CommercialCard, targetSector: string) => void;
}

const SortableCard = ({ card, client, tags, users, onEdit, onQuickView, onUpdateCard, viewMode }: { key?: string | number, card: CommercialCard, client?: Client, tags: Tag[], users: UserProfile[], onEdit: (card: CommercialCard) => void, onQuickView: (card: CommercialCard) => void, onUpdateCard: (cardId: string, data: Partial<CommercialCard>) => Promise<void>, viewMode: 'kanban' | 'list' | 'vertical' | 'calendar' }) => {
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

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const checklist = client?.checklist || card.checklist || [];
  const completed = checklist.filter(i => i.completed).length;
  const total = checklist.length;
  
  const isClient = card.type === 'client' && client;
  const title = isClient ? client.name : (card.title || card.clientName || 'Card sem Título');
  const isOverdue = (date: any) => {
    if (!date) return false;
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d <= today;
  };

  const getLuminance = (hexColor: string) => {
    if (!hexColor || hexColor === '#ffffff') return 1;
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };

  const isCardOverdue = isOverdue(card.deliveryDate);
  const bgColor = isCardOverdue ? '#991b1b' : (card.color || '#ffffff');
  const isDarkBg = getLuminance(bgColor) < 0.6;
  
  const textColorClass = isDarkBg ? 'text-white' : 'text-stone-900';
  const subTextColorClass = isDarkBg ? 'text-white/80' : 'text-stone-500';
  const iconColorClass = isDarkBg ? 'text-white/60 hover:text-white' : (isClient ? (client.themeColor === 'blue' ? 'text-blue-400 hover:text-blue-600' : 'text-yellow-400 hover:text-yellow-600') : 'text-stone-400 hover:text-stone-600');
  const borderColor = isCardOverdue ? '#7f1d1d' : (isDarkBg ? 'transparent' : '#e5e7eb');;

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
          ref={setNodeRef}
          style={{ ...style, backgroundColor: bgColor, borderColor: borderColor }}
          className={`px-3 py-2 rounded-xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer flex items-center justify-between gap-3 ring-2 ring-white ring-inset mb-1 ${isDragging ? 'card-placeholder' : ''}`}
          onClick={() => onQuickView(card)}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${iconColorClass} shrink-0 card-draggable`}>
              <GripVertical size={12} />
            </div>
            <div className={`p-1 rounded-lg ${client.themeColor === 'blue' ? (isDarkBg ? 'bg-white/20' : 'bg-blue-200/50') : (isDarkBg ? 'bg-white/20' : 'bg-yellow-200/50')} shrink-0`}>
              <User size={10} className={textColorClass} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className={`font-black text-xs truncate ${textColorClass}`}>{title}</h4>
              {card.recurrence?.enabled && (
                <RotateCcw size={10} className={textColorClass} />
              )}
            </div>
            {total > 0 && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold shrink-0 ${completed === total ? (client.themeColor === 'blue' ? 'bg-blue-600 text-white' : 'bg-yellow-600 text-white') : (isDarkBg ? 'bg-white/20 text-white' : (client.themeColor === 'blue' ? 'bg-blue-200/50 text-blue-700' : 'bg-yellow-200/50 text-yellow-700'))}`}>
                <CheckSquare size={8} />
                {completed}/{total}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-hidden">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(card);
              }}
              className="p-1.5 rounded-lg hover:bg-white/50 text-stone-400 hover:text-stone-900 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
              title="Editar Card"
            >
              <Edit2 size={12} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.confirm('Tem certeza que deseja excluir este card?')) {
                  await deleteCommercialCard(card.id);
                }
              }}
              className="p-1.5 rounded-lg hover:bg-white/50 text-stone-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
              title="Excluir Card"
            >
              <Trash2 size={12} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                  await completeCommercialCard(card.id);
              }}
              className="p-1.5 rounded-lg hover:bg-white/50 text-stone-400 hover:text-green-600 transition-colors shrink-0 z-30 relative cursor-pointer"
              title="Concluir Atendimento"
            >
              <CheckSquare size={12} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div 
        ref={setNodeRef}
        style={{ ...style, backgroundColor: bgColor, borderColor: borderColor }}
        className={`p-0 rounded-2xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer relative overflow-hidden ring-2 ring-white ring-inset mb-2 card-draggable ${isDragging ? 'card-placeholder' : ''}`}
        onClick={() => onQuickView(card)}
      >
        <div className={`p-2 flex items-center justify-between border-b ${isDarkBg ? 'border-white/10 bg-black/5' : (client.themeColor === 'blue' ? 'border-blue-200 bg-blue-100/30' : 'border-yellow-200 bg-yellow-100/30')}`}>
          <div className="flex items-center gap-1">
            <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${iconColorClass} card-draggable`}>
              <GripVertical size={12} />
            </div>
            <div className="flex items-center gap-1">
              <div className={`p-0.5 rounded-lg ${isDarkBg ? 'bg-white/20' : (client.themeColor === 'blue' ? 'bg-blue-200/50' : 'bg-yellow-200/50')}`}>
                <User size={10} className={textColorClass} />
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${textColorClass}`}>Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(card);
              }}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-all z-30 relative cursor-pointer"
              title="Editar Card"
            >
              <Edit2 size={14} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.confirm('Tem certeza que deseja excluir este card?')) {
                  await deleteCommercialCard(card.id);
                }
              }}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-red-600 transition-all z-30 relative cursor-pointer"
              title="Excluir Card"
            >
              <Trash2 size={14} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                  await completeCommercialCard(card.id);
              }}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-green-600 transition-colors z-30 relative cursor-pointer"
              title="Concluir Atendimento"
            >
              <CheckSquare size={14} />
            </button>
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
              {card.assignees?.slice(0, 2).map(userId => {
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
      </div>
    );
  }

  if (isCompact) {
    return (
      <div 
        ref={setNodeRef}
        style={{ ...style, backgroundColor: bgColor, borderColor: borderColor }}
        className={`px-3 py-2 rounded-xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer flex items-center justify-between gap-3 mb-1 card-draggable ${isDragging ? 'card-placeholder' : ''}`}
        onClick={() => onQuickView(card)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${iconColorClass} shrink-0 card-draggable`}>
            <GripVertical size={14} />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h4 className={`font-extrabold text-xs truncate ${textColorClass}`}>{title}</h4>
            {card.recurrence?.enabled && (
              <RotateCcw size={10} className={textColorClass} />
            )}
          </div>
          {total > 0 && (
            <div className={`flex items-center gap-1.5 text-[10px] font-bold shrink-0 ${completed === total ? 'text-green-600' : 'text-stone-500'}`}>
              <CheckSquare size={10} />
              <span>{completed}/{total}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {card.assignees?.slice(0, 2).map(userId => {
              const u = users.find(user => user.id === userId);
              if (!u) return null;
              return (
                <div key={userId} className="w-4 h-4 rounded-full border border-white overflow-hidden bg-stone-100" title={u.name}>
                  {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-[6px] font-bold text-stone-400">{u.name.charAt(0)}</div>}
                </div>
              );
            })}
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(card);
            }}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
            title="Editar Card"
          >
            <Edit2 size={14} />
          </button>
          <button 
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (window.confirm('Tem certeza que deseja excluir este card?')) {
                await deleteCommercialCard(card.id);
              }
            }}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
            title="Excluir Card"
          >
            <Trash2 size={14} />
          </button>
          <button 
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
                await completeCommercialCard(card.id);
            }}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-green-600 transition-colors shrink-0 z-30 relative cursor-pointer"
            title="Marcar como concluído"
          >
            <CheckCircle2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      style={{ ...style, backgroundColor: bgColor, borderColor: borderColor }}
      className={`p-4 rounded-2xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer relative mb-3 ${isDragging ? 'card-placeholder' : ''}`}
      onClick={() => onQuickView(card)}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${iconColorClass}`}>
            <GripVertical size={14} />
          </div>
          <div className="flex flex-col">
            <h4 className={`font-extrabold text-sm ${textColorClass} flex items-center gap-2`}>
              {title}
              {card.recurrence?.enabled && (
                <RotateCcw size={12} className={textColorClass} />
              )}
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(card);
            }}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-all z-30 relative cursor-pointer"
            title="Editar Card"
          >
            <Edit2 size={14} />
          </button>
          <button 
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (window.confirm('Tem certeza que deseja excluir este card?')) {
                await deleteCommercialCard(card.id);
              }
            }}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-red-600 transition-all z-30 relative cursor-pointer"
            title="Excluir Card"
          >
            <Trash2 size={14} />
          </button>
          <button 
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
                await completeCommercialCard(card.id);
            }}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-green-600 transition-colors z-30 relative cursor-pointer"
            title="Marcar como concluído"
          >
            <CheckSquare size={16} />
          </button>
        </div>
      </div>
      

      {total > 0 && (
        <div className={`flex items-center gap-1.5 text-[10px] font-bold ml-6 ${completed === total ? 'text-green-600' : 'text-stone-500'}`}>
          <CheckSquare size={12} />
          <span>{completed}/{total}</span>
        </div>
      )}

      {(card.startDate || card.deliveryDate) && (
        <div className="flex items-center gap-3 ml-6 mt-2">
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

        <div className="flex items-center justify-between mt-3 ml-6">
          <div className="flex -space-x-1">
            {card.assignees?.map(userId => {
              const u = users.find(user => user.id === userId);
              if (!u) return null;
              return (
                <div key={userId} className="w-5 h-5 rounded-full border border-white overflow-hidden bg-stone-100" title={u.name}>
                  {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center text-[6px] font-bold text-stone-400">{u.name.charAt(0)}</div>}
                </div>
              );
            })}
          </div>
          
          <button 
            onClick={() => onEdit(card)}
            className={`p-1.5 rounded-xl bg-stone-50 border border-stone-200 ${iconColorClass} opacity-0 group-hover:opacity-100 transition-all`}
            title="Editar Card"
          >
            <Edit2 size={12} />
          </button>
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              if (window.confirm('Tem certeza que deseja excluir este card?')) {
                await deleteCommercialCard(card.id);
              }
            }}
            className="p-1.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            title="Excluir Card"
          >
            <Trash2 size={12} />
          </button>
        </div>
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

const SortableList = ({ list, cards, clients, tags, users, onEditCard, onQuickView, onSettings, onAddCard, onUpdateCard, viewMode, cardFilter }: { key?: string | number, list: CommercialList, cards: CommercialCard[], clients: Client[], tags: Tag[], users: UserProfile[], onEditCard: (card: CommercialCard) => void, onQuickView: (card: CommercialCard) => void, onSettings: () => void, onAddCard: () => void, onUpdateCard: (cardId: string, data: Partial<CommercialCard>) => Promise<void>, viewMode: 'kanban' | 'list' | 'vertical' | 'calendar', cardFilter: SectorCardFilter }) => {
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

  const hasClientsInSector = cards.some(c => c.type === 'client');
  const showActivities = localFilter === 'activities' || localFilter === 'both';
  const showClients = (localFilter === 'clients' || (localFilter === 'both' && hasClientsInSector));

  const isLight = isLightColor(list.color || '#E6E6E6');
  const textColor = isLight ? 'text-stone-900' : 'text-white';
  const subtextColor = isLight ? 'text-stone-600/70' : 'text-white/70';
  const iconColor = isLight ? 'text-stone-400' : 'text-stone-400';
  const iconHoverColor = isLight ? 'hover:text-stone-900' : 'hover:text-white';
  const badgeBg = isLight ? 'bg-black/10' : 'bg-white/20';
  const badgeText = isLight ? 'text-stone-900' : 'text-white';

  return (
    <div 
      ref={setNodeRef} 
      style={{ ...style, backgroundColor: list.color || '#E6E6E6' }} 
      className={`${viewMode === 'kanban' ? 'w-[450px] h-full' : 'w-full'} shadow-xl rounded-[2rem] p-6 flex flex-col border border-stone-800/20 shrink-0`}
    >
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing ${iconColor} ${iconHoverColor} transition-colors`}>
            <GripVertical size={16} />
          </div>
          <h3 className={`font-black uppercase tracking-widest text-sm drop-shadow-sm ${textColor}`}>{list.name}</h3>
          <span className={`${badgeBg} ${badgeText} text-[10px] font-black px-2 py-0.5 rounded-full border border-white/20 shadow-sm`}>
            {cards.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
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
        items={cards.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={`flex-1 flex ${viewMode === 'kanban' ? 'gap-6' : 'flex-col gap-4'} min-h-[100px]`}>
          {/* Coluna de Atividades */}
          {showActivities && (
            <div className="flex-1 flex flex-col min-w-0">
              <div className={`text-[10px] font-black tracking-widest ${subtextColor} mb-3 uppercase flex items-center justify-between px-1`}>
                <span>Atividades</span>
                <span className={`${badgeBg} ${badgeText} px-1.5 py-0.5 rounded text-[8px] font-bold`}>{cards.filter(c => c.type !== 'client').length}</span>
              </div>
              <div className="flex-1 space-y-3 pr-1 overflow-y-auto custom-scrollbar">
                {cards
                  .filter(c => c.type !== 'client')
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map(card => (
                    <SortableCard 
                      key={card.id} 
                      card={card} 
                      client={clients.find(c => c.id === card.clientId)}
                      tags={tags}
                      users={users}
                      onEdit={onEditCard} 
                      onQuickView={onQuickView}
                      onUpdateCard={onUpdateCard}
                      viewMode={viewMode}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Coluna de Clientes */}
          {showClients && (
            <div className={`${viewMode === 'kanban' && localFilter === 'both' ? `w-40 border-l ${isLight ? 'border-black/5' : 'border-white/5'} pl-4` : 'w-full'} flex flex-col`}>
              <div className={`text-[10px] font-black tracking-widest ${subtextColor} mb-3 uppercase flex items-center justify-between px-1`}>
                <span>Clientes</span>
                <span className={`${badgeBg} ${badgeText} px-1.5 py-0.5 rounded text-[8px] font-bold`}>{cards.filter(c => c.type === 'client').length}</span>
              </div>
              <div className="flex-1 space-y-2 pr-1 overflow-y-auto custom-scrollbar">
                {cards
                  .filter(c => c.type === 'client')
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map(card => (
                    <SortableCard 
                      key={card.id} 
                      card={card} 
                      client={clients.find(c => c.id === card.clientId)}
                      tags={tags}
                      users={users}
                      onEdit={onEditCard} 
                      onQuickView={onQuickView}
                      onUpdateCard={onUpdateCard}
                      viewMode={viewMode}
                    />
                  ))}
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

export const CommercialView: React.FC<CommercialViewProps> = ({ viewMode, cardFilter, companyId, lists, cards, clients, tags, users, onMoveToSector }) => {
  const { ref: boardRef, props: boardScrollProps, dragClassName } = useDraggableScroll();

  const [isAddListOpen, setIsAddListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [addCardStep, setAddCardStep] = useState<'selection' | 'client' | 'custom'>('selection');
  const [newCardClientName, setNewCardClientName] = useState('');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  
  const [editingList, setEditingList] = useState<CommercialList | null>(null);
  const [editingCard, setEditingCard] = useState<CommercialCard | null>(null);
  const [quickViewCard, setQuickViewCard] = useState<CommercialCard | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<CommercialCard | null>(null);
  const { pushAction } = useHistory();

  const activeCards = cards.filter(c => !c.completed && !c.deleted);
  const completedCards = cards.filter(c => c.completed);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const card = cards.find(c => c.id === active.id);
    if (card) setActiveCard(card);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveCard(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveList = active.data.current?.type === 'List';
    
    if (isActiveList) {
      const oldIndex = lists.findIndex(l => l.id === activeId);
      const newIndex = lists.findIndex(l => l.id === overId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newLists = arrayMove(lists, oldIndex, newIndex) as CommercialList[];
        newLists.forEach((list, index) => {
          if (list.order !== index) {
            updateCommercialList(list.id, { order: index });
          }
        });
      }
      return;
    }

    const activeCard = cards.find(c => c.id === activeId);
    if (!activeCard) return;

    const isOverList = lists.some(l => l.id === overId);
    const overListId = isOverList ? overId : cards.find(c => c.id === overId)?.listId;

    if (overListId && activeCard.listId !== overListId) {
      // Moving to a new list
      const targetList = lists.find(l => l.id === overListId);
      const activeClient = clients.find(c => c.id === activeCard.clientId);
      
      let newChecklist = activeClient ? [...(activeClient.checklist || [])] : [...(activeCard.checklist || [])];
      
      if (activeCard.type === 'client' && targetList && targetList.defaultChecklist) {
        targetList.defaultChecklist.forEach(itemText => {
          if (!newChecklist.some(item => item.text === itemText)) {
            newChecklist.push({
              id: Date.now().toString() + Math.random().toString(36).substring(7),
              text: itemText,
              completed: false
            });
          }
        });
      }

      const previousListId = activeCard.listId;
      const previousOrder = activeCard.order;
      const newOrder = cards.filter(c => c.listId === overListId).length;

      const executeMove = (listId: string, order: number) => updateCommercialCard(activeId, { listId, order });

      await executeMove(overListId, newOrder);
      
      pushAction({
        name: 'Mover Card',
        undo: () => executeMove(previousListId, previousOrder),
        redo: () => executeMove(overListId, newOrder)
      });
      
      if (activeClient) {
        await updateClient(activeClient.id, { checklist: newChecklist });
      }
    } else if (overListId && activeCard.listId === overListId) {
      // Reordering within the same list
      const listCards = cards.filter(c => c.listId === overListId).sort((a, b) => (a.order || 0) - (b.order || 0));
      const oldIndex = listCards.findIndex(c => c.id === activeId);
      const newIndex = listCards.findIndex(c => c.id === overId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newCards = arrayMove(listCards, oldIndex, newIndex) as CommercialCard[];
        newCards.forEach((card, index) => {
          if (card.order !== index) {
            updateCommercialCard(card.id, { order: index });
          }
        });
      }
    }
  };

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    await addCommercialList({
      name: newListName.trim(),
      companyId,
      order: lists.length,
      color: '#E6E6E6',
      defaultChecklist: []
    });
    setNewListName('');
    setIsAddListOpen(false);
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeListId) return;

    if (addCardStep === 'client') {
      if (!newCardClientName) return;
      
      const targetList = lists.find(l => l.id === activeListId);
      const client = clients.find(c => c.id === newCardClientName);
      
      let newChecklist = client ? [...(client.checklist || [])] : [];
      
      if (targetList && targetList.defaultChecklist) {
        targetList.defaultChecklist.forEach(itemText => {
          if (!newChecklist.some(item => item.text === itemText)) {
            newChecklist.push({
              id: Date.now().toString() + Math.random().toString(36).substring(7),
              text: itemText,
              completed: false
            });
          }
        });
      }

      await addCommercialCard({
        clientId: newCardClientName,
        listId: activeListId,
        companyId,
        order: cards.filter(c => c.listId === activeListId).length,
        type: 'client',
        updatedAt: new Date(),
        ...(!client ? { checklist: newChecklist, notes: '' } : {})
      });
      
      if (client) {
        await updateClient(client.id, { checklist: newChecklist });
      }
    } else if (addCardStep === 'custom') {
      if (!newCardTitle.trim()) return;

      await addCommercialCard({
        title: newCardTitle.trim(),
        listId: activeListId,
        companyId,
        order: cards.filter(c => c.listId === activeListId).length,
        type: 'custom',
        notes: '',
        checklist: [],
        updatedAt: new Date()
      });
    }
    
    setNewCardClientName('');
    setNewCardTitle('');
    setIsAddCardOpen(false);
    setAddCardStep('selection');
  };

  const openAddCard = (listId: string) => {
    setActiveListId(listId);
    setAddCardStep('selection');
    setIsAddCardOpen(true);
  };



  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 py-1 px-2">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Comercial</h1>
          <p className="text-stone-500 text-sm mt-1">Gerencie as oportunidades de negócio da sua empresa.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAddListOpen(true)}
            className="bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors flex items-center gap-2 text-sm font-bold shadow-lg shadow-stone-900/20"
          >
            <Plus size={16} />
            Novo Setor
          </button>
        </div>
      </div>

      <div 
        ref={boardRef}
        {...boardScrollProps}
        className={`flex-1 ${dragClassName} overflow-auto h-full px-1 pb-4 custom-scrollbar`}
      >
        {viewMode === 'calendar' ? (
          <div className="flex-1 min-h-0 bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-200">
            <CalendarDashboardView 
              allCards={activeCards
                .filter(c => {
                  if (cardFilter === 'activities') return c.type !== 'client';
                  if (cardFilter === 'clients') return c.type === 'client';
                  return true;
                })
                .map(c => ({ ...c, sector: 'comercial' }))}
              clients={clients}
              tags={tags}
              users={users}
              onCardClick={(card) => setQuickViewCard(card as any)}
            />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={lists.map(l => l.id)}
              strategy={viewMode === 'kanban' ? horizontalListSortingStrategy : verticalListSortingStrategy}
            >
              <div className={`flex ${viewMode === 'kanban' ? 'flex-row gap-6 h-full items-start min-w-max' : 'flex-col gap-10 w-full pb-10'}`}>
                {lists.map(list => (
                  <SortableList 
                    key={list.id} 
                    list={list} 
                    viewMode={viewMode}
                    cards={activeCards.filter(c => c.listId === list.id)} 
                    clients={clients}
                    tags={tags}
                    users={users}
                    onEditCard={setEditingCard}
                    onQuickView={setQuickViewCard}
                    onSettings={() => setEditingList(list)}
                    onAddCard={() => openAddCard(list.id)}
                    onUpdateCard={updateCommercialCard}
                    cardFilter={cardFilter}
                  />
                ))}

                {lists.length === 0 && (
                  <div className="w-full h-64 flex flex-col items-center justify-center text-stone-400 border-2 border-dashed border-stone-200 rounded-3xl">
                    <p className="mb-4">Nenhum setor criado no funil.</p>
                    <button 
                      onClick={() => setIsAddListOpen(true)}
                      className="bg-white border border-stone-200 text-stone-700 px-4 py-2 rounded-xl hover:bg-stone-50 transition-colors flex items-center gap-2 text-sm font-bold shadow-sm"
                    >
                      <Plus size={16} />
                      Criar Primeiro Setor
                    </button>
                  </div>
                )}
              </div>
            </SortableContext>
            <DragOverlay adjustScale={false} dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.5',
                  },
                },
              }),
            }}>
              {activeId && activeCard ? (
                <div className="tilt-card">
                  <SortableCard 
                    card={activeCard} 
                    client={clients.find(c => c.id === activeCard.clientId)}
                    tags={tags}
                    users={users}
                    onEdit={() => {}} 
                    onQuickView={() => {}}
                    onUpdateCard={async () => {}}
                    viewMode={viewMode}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>


      <Modal isOpen={isAddListOpen} onClose={() => setIsAddListOpen(false)} title="Novo Setor">
        <form onSubmit={handleAddList} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Nome do Setor</label>
            <input 
              required
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              placeholder="Ex: Financeiro, Reunião, etc."
            />
          </div>
          <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold">
            Criar Setor
          </button>
        </form>
      </Modal>

      <Modal isOpen={isAddCardOpen} onClose={() => setIsAddCardOpen(false)} title={addCardStep === 'selection' ? "Adicionar Item" : addCardStep === 'client' ? "Adicionar Cliente ao Setor" : "Adicionar Card Personalizado"}>
        {addCardStep === 'selection' ? (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setAddCardStep('client')}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-stone-100 hover:border-stone-900 hover:bg-stone-50 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <User size={24} />
              </div>
              <span className="font-bold text-sm text-stone-700">Adicionar Cliente</span>
            </button>
            <button
              onClick={() => setAddCardStep('custom')}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-stone-100 hover:border-stone-900 hover:bg-stone-50 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-colors">
                <Edit2 size={24} />
              </div>
              <span className="font-bold text-sm text-stone-700">Card Personalizado</span>
            </button>
          </div>
        ) : addCardStep === 'client' ? (
          <form onSubmit={handleAddCard} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Selecione o Cliente</label>
              <select
                required
                autoFocus
                value={newCardClientName}
                onChange={(e) => setNewCardClientName(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              >
                <option value="">Selecione um cliente...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Nenhum cliente cadastrado. Vá para a aba Clientes para cadastrar.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setAddCardStep('selection')}
                className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl hover:bg-stone-200 transition-all font-bold"
              >
                Voltar
              </button>
              <button 
                type="submit" 
                disabled={!newCardClientName}
                className="flex-[2] bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar Cliente
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAddCard} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Título do Card</label>
              <input 
                required
                autoFocus
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                placeholder="Ex: Lembrete de reunião, Observação interna..."
              />
            </div>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setAddCardStep('selection')}
                className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl hover:bg-stone-200 transition-all font-bold"
              >
                Voltar
              </button>
              <button 
                type="submit" 
                disabled={!newCardTitle.trim()}
                className="flex-[2] bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Criar Card
              </button>
            </div>
          </form>
        )}
      </Modal>

      {editingList && (
        <ListSettingsModal 
          isOpen={!!editingList} 
          onClose={() => setEditingList(null)} 
          list={editingList} 
          onUpdate={updateCommercialList}
          onDelete={deleteCommercialList}
        />
      )}

      {editingCard && (
        <EditCommercialCardModal
          isOpen={!!editingCard}
          onClose={() => setEditingCard(null)}
          card={editingCard}
          client={clients.find(c => c.id === editingCard?.clientId)}
          clients={clients}
          users={users}
          onMoveToSector={(target) => editingCard && onMoveToSector(editingCard, target)}
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
        sector="commercial"
      />
    </div>
  );
};
