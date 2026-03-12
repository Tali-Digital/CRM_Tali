import React, { useState } from 'react';
import { OperationList, OperationCard, CompanyType, Client, Tag, UserProfile, SectorCardFilter } from '../types';
import { 
  addOperationList, 
  addOperationCard, 
  updateOperationCard, 
  updateOperationList, 
  deleteOperationList, 
  updateClient, 
  deleteOperationCard,
  permanentDeleteOperationCard,
  completeOperationCard
} from '../services/firestoreService';
import { Plus, Settings, CheckSquare, GripVertical, Edit2, Calendar, CheckCircle2, Archive, User, RotateCcw, Trash2 } from 'lucide-react';
import { CompletedCardsModal } from './CompletedCardsModal';
import { useHistory } from '../context/HistoryContext';
import { Timestamp } from 'firebase/firestore';
import { Modal } from './Modal';
import { ListSettingsModal } from './ListSettingsModal';
import { EditOperationCardModal } from './EditOperationCardModal';
import { QuickViewCardModal } from './QuickViewCardModal';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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

interface OperationViewProps {
  viewMode: 'kanban' | 'list' | 'vertical';
  cardFilter: SectorCardFilter;
  companyId: CompanyType;
  lists: OperationList[];
  cards: OperationCard[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  onMoveToSector: (card: OperationCard, targetSector: string) => void;
}

const SortableCard = ({ card, client, tags, users, onEdit, onQuickView, onUpdateCard, viewMode }: { key?: string | number, card: OperationCard, client?: Client, tags: Tag[], users: UserProfile[], onEdit: (card: OperationCard) => void, onQuickView: (card: OperationCard) => void, onUpdateCard: (cardId: string, data: Partial<OperationCard>) => Promise<void>, viewMode: 'kanban' | 'list' | 'vertical' }) => {
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
    opacity: isDragging ? 0.5 : 1,
    ...(isDragging ? { zIndex: 50, position: 'relative' as const } : {}),
  };

  const isCustom = card.type === 'custom' || (!card.clientId && !!card.title);
  const checklist = client?.checklist || card.checklist || [];
  const completed = checklist.filter(i => i.completed).length;
  const total = checklist.length;
  
  const isClient = card.type === 'client' && client;
  const title = isClient ? client.name : (card.title || 'Card sem Título');
  
  const bgColorClass = isClient
    ? client.themeColor === 'blue' 
      ? 'bg-blue-50 border-blue-300 shadow-blue-900/5' 
      : 'bg-yellow-50 border-yellow-300 shadow-yellow-900/5'
    : 'bg-white border-stone-200';

  const textColorClass = isClient
    ? client.themeColor === 'blue' 
      ? 'text-blue-900' 
      : 'text-yellow-900'
    : 'text-stone-900';

  const iconColorClass = isClient
    ? client.themeColor === 'blue' 
      ? 'text-blue-400 hover:text-blue-600' 
      : 'text-yellow-400 hover:text-yellow-600'
    : 'text-stone-400 hover:text-stone-600';

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

  const isCompact = viewMode === 'list';

  if (isClient) {
    if (isCompact) {
      return (
        <div 
          ref={setNodeRef}
          style={style}
          className={`px-3 py-2 rounded-xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer flex items-center justify-between gap-3 ${bgColorClass} ring-2 ring-white ring-inset mb-1`}
          onClick={() => onQuickView(card)}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${iconColorClass} shrink-0`}>
              <GripVertical size={12} />
            </div>
            <div className={`p-1 rounded-lg ${client.themeColor === 'blue' ? 'bg-blue-200/50' : 'bg-yellow-200/50'} shrink-0`}>
              <User size={10} className={textColorClass} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className={`font-black text-xs truncate ${textColorClass}`}>{title}</h4>
              {card.recurrence?.enabled && (
                <RotateCcw size={10} className={textColorClass} />
              )}
            </div>
            {total > 0 && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold shrink-0 ${completed === total ? (client.themeColor === 'blue' ? 'bg-blue-600 text-white' : 'bg-yellow-600 text-white') : (client.themeColor === 'blue' ? 'bg-blue-200/50 text-blue-700' : 'bg-yellow-200/50 text-yellow-700')}`}>
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
                  await deleteOperationCard(card.id);
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
                await completeOperationCard(card.id);
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
        style={style}
        className={`p-0 rounded-2xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer relative overflow-hidden ${bgColorClass} ring-2 ring-white ring-inset mb-2`}
        onClick={() => onQuickView(card)}
      >
        <div className={`p-2 flex items-center justify-between border-b ${client.themeColor === 'blue' ? 'border-blue-200 bg-blue-100/30' : 'border-yellow-200 bg-yellow-100/30'}`}>
          <div className="flex items-center gap-1">
            <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors ${iconColorClass}`}>
              <GripVertical size={12} />
            </div>
            <div className="flex items-center gap-1">
              <div className={`p-0.5 rounded-lg ${client.themeColor === 'blue' ? 'bg-blue-200/50' : 'bg-yellow-200/50'}`}>
                <User size={10} className={textColorClass} />
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${textColorClass}`}>Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(card);
              }}
              className="p-1 rounded-lg hover:bg-white/50 text-stone-400 hover:text-stone-900 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
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
                  await deleteOperationCard(card.id);
                }
              }}
              className="p-1 rounded-lg hover:bg-white/50 text-stone-400 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
              title="Excluir Card"
            >
              <Trash2 size={12} />
            </button>
            <button 
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await completeOperationCard(card.id);
              }}
              className="p-1 rounded-lg hover:bg-white/50 text-stone-400 hover:text-green-600 transition-colors opacity-0 group-hover:opacity-100 z-30 relative cursor-pointer"
              title="Concluir Atendimento"
            >
              <CheckSquare size={12} />
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
        style={style}
        className={`px-3 py-2 rounded-xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer flex items-center justify-between gap-3 ${bgColorClass} mb-1`}
        onClick={() => onQuickView(card)}
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
                await deleteOperationCard(card.id);
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
              await completeOperationCard(card.id);
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
      style={style}
      className={`p-4 rounded-2xl shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer relative mb-3 ${bgColorClass}`}
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
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              await completeOperationCard(card.id);
            }}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-green-600 transition-colors z-30 relative cursor-pointer"
            title="Marcar como concluído"
          >
            <CheckCircle2 size={16} />
          </button>
        </div>
      </div>
      
      {client?.serviceTags && client.serviceTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 ml-6">
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
          <div className="flex -space-x-2">
            {card.assignees?.map(userId => {
              const user = users.find(u => u.id === userId);
              if (!user) return null;
              return (
                <div 
                  key={user.id} 
                  title={user.name}
                  className="w-5 h-5 rounded-full border border-white overflow-hidden bg-stone-200 flex items-center justify-center shadow-sm"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[8px] font-bold text-stone-600">{user.name.charAt(0)}</span>
                  )}
                </div>
              );
            })}
          </div>

          {client && (
            <div 
              title={`Cliente: ${client.name}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-50 border border-stone-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${client.themeColor === 'yellow' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
              <span className="text-[9px] font-bold text-stone-500 truncate max-w-[80px] uppercase tracking-tight">
                {client.name}
              </span>
            </div>
          )}
        </div>
    </div>
  );
};

const SortableList = ({ list, cards, clients, tags, users, onEditCard, onQuickView, onSettings, onAddCard, onUpdateCard, viewMode, cardFilter }: { key?: string | number, list: OperationList, cards: OperationCard[], clients: Client[], tags: Tag[], users: UserProfile[], onEditCard: (card: OperationCard) => void, onQuickView: (card: OperationCard) => void, onSettings: () => void, onAddCard: () => void, onUpdateCard: (cardId: string, data: Partial<OperationCard>) => Promise<void>, viewMode: 'kanban' | 'list' | 'vertical', cardFilter: SectorCardFilter }) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ 
    id: list.id,
    data: { type: 'List', list }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(isDragging ? { zIndex: 40, position: 'relative' as const } : {}),
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`${viewMode === 'kanban' ? 'w-[500px]' : 'w-full'} bg-stone-100/50 rounded-3xl p-4 flex flex-col max-h-full border border-stone-200/50 shrink-0`}
    >
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 transition-colors">
            <GripVertical size={16} />
          </div>
          <h3 className="font-bold text-stone-900 uppercase tracking-widest text-sm">{list.name}</h3>
          <span className="bg-white text-stone-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-stone-200">
            {cards.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {list.assignees && list.assignees.length > 0 && (
            <div className="flex -space-x-2 mr-2">
              {list.assignees.slice(0, 3).map(assigneeId => {
                const user = users.find(u => u.id === assigneeId);
                if (!user) return null;
                return (
                  <div key={user.id} className="w-6 h-6 rounded-full border-2 border-stone-100 bg-stone-200 flex items-center justify-center overflow-hidden" title={user.name}>
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[8px] font-bold text-stone-600">{user.name.charAt(0)}</span>
                    )}
                  </div>
                );
              })}
              {list.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full border-2 border-stone-100 bg-stone-100 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-stone-600">+{list.assignees.length - 3}</span>
                </div>
              )}
            </div>
          )}
          <button onClick={onSettings} className="text-stone-400 hover:text-stone-900 p-1 rounded-lg hover:bg-white transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </div>

      <SortableContext
        id={list.id}
        items={cards.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={`flex-1 flex ${viewMode === 'kanban' ? 'gap-6' : 'flex-col gap-4'} overflow-hidden min-h-[100px]`}>
          {/* Coluna de Atividades */}
          {(cardFilter === 'both' || cardFilter === 'activities') && (
            <div className="flex-1 flex flex-col min-w-0">
              <div className="text-[10px] font-black tracking-widest text-stone-400 mb-3 uppercase flex items-center justify-between px-1">
                <span>Atividades</span>
                <span className="bg-white/50 px-1.5 py-0.5 rounded text-[8px]">{cards.filter(c => c.type !== 'client').length}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
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
          {(cardFilter === 'both' || cardFilter === 'clients') && (
            <div className={`${viewMode === 'kanban' && cardFilter === 'both' ? 'w-40 border-l border-stone-200/50 pl-4' : 'w-full'} flex flex-col`}>
              <div className="text-[10px] font-black tracking-widest text-stone-400 mb-3 uppercase flex items-center justify-between px-1">
                <span>Clientes</span>
                <span className="bg-white/50 px-1.5 py-0.5 rounded text-[8px]">{cards.filter(c => c.type === 'client').length}</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
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

export const OperationView: React.FC<OperationViewProps> = ({ viewMode, cardFilter, companyId, lists, cards, clients, tags, users, onMoveToSector }) => {

  const [isAddListOpen, setIsAddListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [addCardStep, setAddCardStep] = useState<'selection' | 'client' | 'custom'>('selection');
  const [newCardClientName, setNewCardClientName] = useState('');
  const [customCardTitle, setCustomCardTitle] = useState('');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  
  const [editingList, setEditingList] = useState<OperationList | null>(null);
  const [editingCard, setEditingCard] = useState<OperationCard | null>(null);
  const [quickViewCard, setQuickViewCard] = useState<OperationCard | null>(null);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const isActiveList = active.data.current?.type === 'List';
    
    if (isActiveList) {
      const oldIndex = lists.findIndex(l => l.id === activeId);
      const newIndex = lists.findIndex(l => l.id === overId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newLists = arrayMove(lists, oldIndex, newIndex) as OperationList[];
        newLists.forEach((list, index) => {
          if (list.order !== index) {
            updateOperationList(list.id, { order: index });
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

      const executeMove = (listId: string, order: number) => updateOperationCard(activeId, { listId, order });

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
        const newCards = arrayMove(listCards, oldIndex, newIndex) as OperationCard[];
        newCards.forEach((card, index) => {
          if (card.order !== index) {
            updateOperationCard(card.id, { order: index });
          }
        });
      }
    }
  };

  const onEditCard = (card: OperationCard) => {
    setEditingCard(card);
  };

  const onQuickView = (card: OperationCard) => {
    setQuickViewCard(card);
  };

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    await addOperationList({
      name: newListName.trim(),
      companyId,
      order: lists.length,
      defaultChecklist: []
    });
    setNewListName('');
    setIsAddListOpen(false);
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeListId) return;

    if (addCardStep === 'selection') return;

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

      await addOperationCard({
        clientId: newCardClientName,
        listId: activeListId,
        companyId,
        type: 'client',
        order: cards.filter(c => c.listId === activeListId).length,
        ...(!client ? { checklist: newChecklist, notes: '' } : {})
      });
      
      if (client) {
        await updateClient(client.id, { checklist: newChecklist });
      }
    } else if (addCardStep === 'custom') {
      if (!customCardTitle.trim()) return;

      await addOperationCard({
        title: customCardTitle.trim(),
        listId: activeListId,
        companyId,
        type: 'custom',
        order: cards.filter(c => c.listId === activeListId).length,
        notes: '',
        checklist: [],
        updatedAt: new Date()
      });
    }
    
    setNewCardClientName('');
    setCustomCardTitle('');
    setIsAddCardOpen(false);
  };

  const openAddCard = (listId: string) => {
    setActiveListId(listId);
    setAddCardStep('selection');
    setIsAddCardOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Operação Contínua</h1>
          <p className="text-stone-500 text-sm mt-1">Gerencie o fluxo de operação e acompanhamento contínuo de clientes.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAddListOpen(true)}
            className="bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors flex items-center gap-2 text-sm font-bold"
          >
            <Plus size={16} />
            Novo Setor
          </button>
        </div>
      </div>

      <div className={`flex-1 ${viewMode === 'kanban' ? 'overflow-x-auto px-1' : 'overflow-y-auto pr-4'} custom-scrollbar pb-8`}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
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
                  onUpdateCard={updateOperationCard}
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
        </DndContext>
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
              placeholder="Ex: Suporte, Manutenção, etc."
            />
          </div>
          <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold">
            Criar Setor
          </button>
        </form>
      </Modal>

      <Modal isOpen={isAddCardOpen} onClose={() => setIsAddCardOpen(false)} title="Adicionar Item ao Setor">
        <form onSubmit={handleAddCard} className="space-y-4">
          {addCardStep === 'selection' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setAddCardStep('client')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-stone-100 hover:border-stone-900 hover:bg-stone-50 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                  <Plus size={24} />
                </div>
                <span className="font-bold text-sm text-stone-900">Adicionar Cliente</span>
              </button>
              <button
                type="button"
                onClick={() => setAddCardStep('custom')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-stone-100 hover:border-stone-900 hover:bg-stone-50 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                  <Edit2 size={24} />
                </div>
                <span className="font-bold text-sm text-stone-900">Card Personalizado</span>
              </button>
            </div>
          )}

          {addCardStep === 'client' && (
            <div className="space-y-4">
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
                  className="flex-1 py-4 rounded-2xl border border-stone-200 font-bold text-stone-600 hover:bg-stone-50 transition-all"
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
            </div>
          )}

          {addCardStep === 'custom' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Título do Card</label>
                <input
                  required
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
          onUpdate={updateOperationList}
          onDelete={deleteOperationList}
        />
      )}

      {editingCard && (
        <EditOperationCardModal 
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
        sector="operation"
      />
    </div>
  );
};
