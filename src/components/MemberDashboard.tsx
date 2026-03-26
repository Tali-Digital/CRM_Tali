import React, { useState } from 'react';
import { UserProfile, CommercialCard, FinancialCard, OperationCard, InternalTaskCard, Tag, Client } from '../types';
import { Clock, CheckSquare, DollarSign, User, Mail, Briefcase, GripVertical, Timer, AlertCircle, Calendar, RotateCcw, CheckCircle2, Play, Pause, ExternalLink } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent,
  DragOverlay,
  useDroppable,
  DragStartEvent
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateCardTimer } from '../services/firestoreService';
import { QuickViewCardModal } from './QuickViewCardModal';

interface MemberDashboardProps {
  userProfile: UserProfile;
  commercialCards: CommercialCard[];
  financialCards: FinancialCard[];
  operationCards: OperationCard[];
  internalTaskCards: InternalTaskCard[];
  tags: Tag[];
  clients: Client[];
  users: UserProfile[];
  onUpdateCard: (cardId: string, sector: string, data: any) => Promise<void>;
}

const SortableMemberCard = ({ card, sector, clients, users, onQuickView, elapsedTime, onStartTimer, onPauseTimer, formatTime }: { card: any, sector: string, clients: Client[], users: UserProfile[], onQuickView: (card: any, sector: string) => void, elapsedTime: number, onStartTimer: (card: any, sector: string) => Promise<void>, onPauseTimer: (card: any, sector: string) => Promise<void>, formatTime: (s: number) => string, key?: string | number }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: card.id,
    data: { type: 'Card', card, sector }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const client = clients.find(c => c.id === card.clientId);
  const isRunning = card.timerStatus === 'running';
  const isFinished = card.workerFinished;

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
  
  const bgColor = isCardOverdue ? '#991b1b' : (isCardDueToday ? '#FEF2F2' : (isCardNearDue ? '#FFFBF5' : (card.color || '#ffffff')));
  const isDarkBg = isCardOverdue;
  
  const textColorClass = isDarkBg ? 'text-white' : 'text-stone-900';
  const iconColorClass = isDarkBg ? 'text-white/60 hover:text-white' : 'text-stone-400 hover:text-stone-600';
  const borderColor = isCardOverdue ? '#7f1d1d' : (isCardDueToday ? '#FECACA' : (isCardNearDue ? '#FFEDD5' : '#e5e7eb'));

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const checklist = card.checklist || [];
  const completed = checklist.filter((i: any) => i.completed).length;
  const total = checklist.length;

  return (
    <div 
      ref={setNodeRef}
      style={{ 
        ...style, 
        backgroundColor: bgColor, 
        borderColor: borderColor,
      }}
      className={`p-4 rounded-[2rem] shadow-sm border-2 hover:shadow-md transition-all group cursor-pointer relative mb-3 ring-2 ring-white ring-inset ${isDragging ? 'opacity-0' : ''}`}
    >
      <div 
        className="absolute inset-0 z-0" 
        onClick={() => onQuickView(card, sector)}
      />

      <div className="relative z-10 pointer-events-none">
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
            <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing transition-colors pointer-events-auto ${iconColorClass}`}>
                <GripVertical size={14} />
            </div>
            <div className="flex flex-col">
              <h4 className={`font-extrabold text-sm ${textColorClass} flex items-center gap-2`}>
                {card.title || card.clientName || 'Card sem título'}
                {card.recurrence?.enabled && (
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${isDarkBg ? 'bg-blue-400/20 text-blue-300 border-blue-400/30' : 'bg-blue-50 text-blue-600 border-blue-100 font-black'}`}>
                    <RotateCcw size={10} />
                    <span className="text-[8px] font-black uppercase tracking-widest">Recorrente</span>
                  </div>
                )}
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <div className="flex items-center gap-1 text-blue-600 animate-pulse">
                <Timer size={14} />
              </div>
            )}
            {isFinished && !isRunning && (
               <CheckCircle2 size={16} className="text-green-600" />
            )}
          </div>
        </div>

        {card.statusTags && card.statusTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {card.statusTags.includes('aguardando equipe') && (
              <span className={`px-1.5 py-0.5 rounded-full ${isDarkBg ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600 border border-blue-200'} text-[6.5px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm`}>
                <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                Aguardando Equipe
              </span>
            )}
            {card.statusTags.includes('em aprovação') && (
              <span className={`px-1.5 py-0.5 rounded-full ${isDarkBg ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600 border border-green-200'} text-[6.5px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm`}>
                <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                Em Aprovação
              </span>
            )}
            {card.statusTags.includes('aguardando cliente') && (
              <span className={`px-1.5 py-0.5 rounded-full ${isDarkBg ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600 border border-orange-200'} text-[6.5px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm`}>
                <div className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                Aguardando Cliente
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

        <div className="flex items-center justify-between mt-3 ml-6 flex-wrap gap-y-2">
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

          <div className="flex items-center gap-2">
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
              sector === 'comercial' ? 'bg-amber-100/50 text-amber-700' :
              sector === 'integracao' ? 'bg-blue-100/50 text-blue-700' :
              sector === 'operacao' ? 'bg-green-100/50 text-green-700' :
              'bg-stone-100/50 text-stone-700'
            }`}>
              {sector === 'internal_tasks' ? 'Interno' : sector}
            </span>
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
        </div>

        {/* Action Row - PREMIUM - Only visible on hover */}
        <div className="mt-4 pt-4 border-t border-stone-100/30 flex items-center justify-center gap-2 transition-all duration-300 pointer-events-auto opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
          {/* Action: Start/Pause */}
          {isRunning ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onPauseTimer(card, sector); }}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all shadow-sm border ${isDarkBg ? 'bg-white/10 text-white border-white/20' : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-600 hover:text-white'}`}
            >
              <Pause size={14} fill="currentColor" />
            </button>
          ) : (
            !isFinished && (
              <button 
                onClick={(e) => { e.stopPropagation(); onStartTimer(card, sector); }}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all shadow-sm border ${isDarkBg ? 'bg-white/10 text-white border-white/20' : 'bg-stone-50 text-stone-300 border-stone-100 hover:bg-green-600 hover:text-white'}`}
              >
                <Play size={14} fill="currentColor" className="ml-0.5" />
              </button>
            )
          )}

          {/* Timer Display */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-stone-100 shadow-inner min-w-[90px] justify-center">
            <Clock size={12} className={isRunning ? 'text-blue-500 animate-pulse' : 'text-stone-300'} />
            <span className="text-[10px] font-black font-mono tracking-wider text-stone-900">
              {formatTime(elapsedTime)}
            </span>
          </div>

          <button 
            onClick={() => onQuickView(card, sector)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all shadow-sm border ${isDarkBg ? 'bg-white/10 text-white border-white/20' : 'bg-stone-50 text-stone-400 border-stone-100 hover:bg-blue-600 hover:text-white'}`}
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const DroppableColumn = ({ id, title, cards, clients, users, onQuickView, elapsedTimes, onStartTimer, onPauseTimer, formatTime }: { id: string, title: string, cards: any[], clients: Client[], users: UserProfile[], onQuickView: (card: any, sector: string) => void, elapsedTimes: Record<string, number>, onStartTimer: (card: any, sector: string) => Promise<void>, onPauseTimer: (card: any, sector: string) => Promise<void>, formatTime: (s: number) => string }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  const getColColor = () => {
    return 'bg-[#E6E6E6]';
  };

  const getTitleColor = () => {
    if (id === 'pendente') return 'text-blue-600';
    if (id === 'andamento') return 'text-yellow-700';
    if (id === 'concluido') return 'text-green-700';
    return 'text-stone-500';
  };

  const getBadgeColor = () => {
    if (id === 'pendente') return 'bg-blue-100 text-blue-600';
    if (id === 'andamento') return 'bg-yellow-100 text-yellow-700';
    if (id === 'concluido') return 'bg-green-100 text-green-700';
    return 'bg-stone-100 text-stone-500';
  };

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 flex flex-col rounded-[2.5rem] p-6 transition-all duration-300 min-h-[500px] border border-stone-200/50 ${getColColor()} ${isOver ? 'ring-4 ring-black/5 scale-[1.01]' : 'shadow-inner'}`}
    >
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${getTitleColor()}`}>{title}</h3>
        <span className={`${getBadgeColor()} text-[10px] font-black px-2 py-0.5 rounded-full border border-black/5`}>{cards.length}</span>
      </div>
      
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3">
          {cards.map(card => (
            <SortableMemberCard 
              key={card.id} 
              card={card} 
              sector={card.sector} 
              clients={clients} 
              users={users} 
              onQuickView={onQuickView} 
              elapsedTime={elapsedTimes[card.id] || card.timeSpent || 0}
              onStartTimer={onStartTimer}
              onPauseTimer={onPauseTimer}
              formatTime={formatTime}
            />
          ))}
          {cards.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-30 py-12 text-stone-400">
              <AlertCircle size={32} className="mb-2" />
              <p className="text-[9px] font-black uppercase tracking-widest leading-relaxed text-center">Nenhum card<br />nesta coluna</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export const MemberDashboard: React.FC<MemberDashboardProps> = ({ 
  userProfile, 
  commercialCards, 
  financialCards, 
  operationCards, 
  internalTaskCards,
  tags,
  clients,
  users,
  onUpdateCard
}) => {
  const [activeDragCard, setActiveDragCard] = useState<any>(null);
  const [quickViewCard, setQuickViewCard] = useState<any>(null);
  const [quickViewSector, setQuickViewSector] = useState<'commercial' | 'financial' | 'operation' | 'internal'>('internal');
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});

  React.useEffect(() => {
    const interval = setInterval(() => {
      const newElapsed: Record<string, number> = {};
      const allTasks = [
        ...commercialCards.filter(c => c.assignees?.includes(userProfile.id) && !c.deleted && !c.completed),
        ...financialCards.filter(c => c.assignees?.includes(userProfile.id) && !c.deleted && !c.completed),
        ...operationCards.filter(c => c.assignees?.includes(userProfile.id) && !c.deleted && !c.completed),
        ...internalTaskCards.filter(c => c.assignees?.includes(userProfile.id) && !c.deleted && !c.completed)
      ];
      
      allTasks.forEach(task => {
        if (task.timerStatus === 'running' && task.timerStartedAt) {
          const startedAt = task.timerStartedAt instanceof Timestamp 
            ? task.timerStartedAt.toDate() 
            : new Date(task.timerStartedAt);
          const diffInSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
          newElapsed[task.id] = (task.timeSpent || 0) + diffInSeconds;
        }
      });
      
      setElapsedTimes(newElapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [userProfile.id, commercialCards, financialCards, operationCards, internalTaskCards]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getUserTasksCount = (userId: string) => {
    const tasks = [
      ...commercialCards.filter(c => c.assignees?.includes(userId) && !c.deleted && !c.completed),
      ...financialCards.filter(c => c.assignees?.includes(userId) && !c.deleted && !c.completed),
      ...operationCards.filter(c => c.assignees?.includes(userId) && !c.deleted && !c.completed),
      ...internalTaskCards.filter(c => c.assignees?.includes(userId) && !c.deleted && !c.completed)
    ];
    return tasks.length;
  };

  const getUserHistory = (userId: string) => {
    return [
      ...commercialCards.filter(c => c.assignees?.includes(userId) && c.completed && !c.deleted),
      ...financialCards.filter(c => c.assignees?.includes(userId) && c.completed && !c.deleted),
      ...operationCards.filter(c => c.assignees?.includes(userId) && c.completed && !c.deleted),
      ...internalTaskCards.filter(c => c.assignees?.includes(userId) && c.completed && !c.deleted)
    ];
  };

  const allActiveTasks = [
    ...commercialCards.filter(c => c.assignees?.includes(userProfile.id) && !c.deleted && !c.completed).map(c => ({ ...c, sector: 'comercial' })),
    ...financialCards.filter(c => c.assignees?.includes(userProfile.id) && !c.deleted && !c.completed).map(c => ({ ...c, sector: 'integracao' })),
    ...operationCards.filter(c => c.assignees?.includes(userProfile.id) && !c.deleted && !c.completed).map(c => ({ ...c, sector: 'operacao' })),
    ...internalTaskCards.filter(c => c.assignees?.includes(userProfile.id) && !c.deleted && !c.completed).map(c => ({ ...c, sector: 'internal_tasks' }))
  ];

  const columns = {
    pendente: allActiveTasks.filter(t => !t.workerFinished && (t.timerStatus === 'idle' || !t.timerStatus)),
    andamento: allActiveTasks.filter(t => !t.workerFinished && (t.timerStatus === 'running' || t.timerStatus === 'paused')),
    concluido: allActiveTasks.filter(t => t.workerFinished)
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragCard(active.data.current?.card);
  };

  const handleStartTimer = async (card: any, sector: string) => {
    // Check if another task is running
    const runningTask = allActiveTasks.find(t => t.timerStatus === 'running');
    if (runningTask && runningTask.id !== card.id) {
      alert(`Você já tem uma tarefa em andamento: "${runningTask.title || (runningTask as any).clientName}". Pause-a primeiro.`);
      return;
    }

    await updateCardTimer(card.id, sector, {
      timeSpent: card.timeSpent || 0,
      timerStartedAt: new Date(),
      timerStatus: 'running'
    });
  };

  const handlePauseTimer = async (card: any, sector: string) => {
    if (!card.timerStartedAt) return;
    const startedAt = card.timerStartedAt instanceof Timestamp 
      ? card.timerStartedAt.toDate() 
      : new Date(card.timerStartedAt);
    const diffInSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const totalTime = (card.timeSpent || 0) + diffInSeconds;

    await updateCardTimer(card.id, sector, {
      timeSpent: totalTime,
      timerStartedAt: null,
      timerStatus: 'paused'
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragCard(null);
    if (!over) return;

    const card = active.data.current?.card;
    const sector = active.data.current?.sector;
    const targetColumn = over.id as string;

    if (targetColumn === 'andamento') {
      const updates: any = { workerFinished: false };
      if (card.timerStatus === 'idle' || !card.timerStatus) {
        updates.timerStatus = 'paused';
      }
      await onUpdateCard(card.id, sector, updates);
    } else if (targetColumn === 'concluido') {
      if (card.timerStatus === 'running') {
        await handlePauseTimer(card, sector);
      }
      await onUpdateCard(card.id, sector, { workerFinished: true });
    } else if (targetColumn === 'pendente') {
      if (card.timerStatus === 'running') {
        await handlePauseTimer(card, sector);
      }
      await onUpdateCard(card.id, sector, { workerFinished: false, timerStatus: 'idle' });
    }
  };

  const handleOpenQuickView = (card: any, sector: string) => {
    setQuickViewCard(card);
    setQuickViewSector(sector === 'internal_tasks' ? 'internal' : 
                      sector === 'comercial' ? 'commercial' :
                      sector === 'integracao' ? 'financial' :
                      sector === 'operacao' ? 'operation' : 'internal');
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const historyMonth = getUserHistory(userProfile.id).filter(t => {
    const date = t.updatedAt instanceof Timestamp ? t.updatedAt.toDate() : new Date(t.updatedAt || 0);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
  const totalSeconds = historyMonth.reduce((acc, t) => acc + (t.timeSpent || 0), 0);
  const totalHours = totalSeconds / 3600;
  const totalPayout = totalHours * (userProfile.hourlyRate || 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fdfdfd] overflow-hidden p-6 md:p-8">
      <div className="flex-1 overflow-y-auto custom-scrollbar h-full pr-2 space-y-8 pb-10">
        {/* Top Section - Member Quickview in Large Scale */}
        <div className="bg-white rounded-[2.5rem] p-8 border-2 border-stone-100 shadow-sm space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col md:flex-row items-center gap-8">
             <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-4 border-white shadow-xl bg-stone-50 shrink-0">
               {userProfile.photoURL ? (
                 <img src={userProfile.photoURL} alt={userProfile.name} className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                   <User size={60} />
                 </div>
               )}
             </div>
             
             <div className="flex-1 text-center md:text-left">
               <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                 <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50 px-3 py-1 rounded-xl border border-blue-100">
                   {userProfile.teamCategory || 'Membro da Equipe'}
                 </span>
                 <div className="flex items-center gap-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Status Ativo</span>
                 </div>
               </div>
               <h1 className="text-3xl md:text-5xl font-black text-stone-900 leading-tight tracking-tight mb-3 uppercase">{userProfile.name}</h1>
               <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-stone-500">
                 <div className="flex items-center gap-2">
                   <Mail size={16} className="text-stone-300" />
                   <span className="text-sm font-bold">{userProfile.email}</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <Briefcase size={16} className="text-stone-300" />
                   <span className="text-sm font-bold uppercase tracking-widest text-stone-400">{userProfile.role}</span>
                 </div>
               </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Hours Card */}
            <div className="bg-stone-50 rounded-[2rem] p-8 border border-stone-100 flex flex-col justify-between group hover:bg-stone-100 transition-all duration-300">
              <div className="flex items-center gap-4 text-stone-400 mb-8">
                <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                  <Clock size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tempo Trabalhado</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-stone-900 leading-none">{formatTime(totalSeconds)}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Mês Atual</span>
              </div>
            </div>

            {/* Tasks Card */}
            <div className="bg-stone-50 rounded-[2rem] p-8 border border-stone-100 flex flex-col justify-between group hover:bg-stone-100 transition-all duration-300">
              <div className="flex items-center gap-4 text-stone-400 mb-8">
                <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                  <CheckSquare size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tarefas Pendentes</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-stone-900 leading-none">{getUserTasksCount(userProfile.id).toString().padStart(2, '0')}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Em Aberto</span>
              </div>
            </div>

            {/* Earnings Card */}
            <div className="bg-stone-900 rounded-[2rem] p-8 shadow-xl shadow-stone-900/20 flex flex-col justify-between group hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center gap-4 text-stone-400 mb-8">
                <div className="p-3 bg-white/10 rounded-2xl group-hover:bg-white/20 transition-colors">
                  <DollarSign size={24} className="text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Previsão de Ganhos</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-white leading-none">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPayout)}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Mês Atual</span>
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Section */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col md:flex-row gap-6 h-full px-1">
            <DroppableColumn 
              id="pendente" 
              title="Pendente" 
              cards={columns.pendente} 
              clients={clients} 
              users={users} 
              onQuickView={handleOpenQuickView}
              elapsedTimes={elapsedTimes}
              onStartTimer={handleStartTimer}
              onPauseTimer={handlePauseTimer}
              formatTime={formatTime}
            />
            <DroppableColumn 
              id="andamento" 
              title="Em Andamento" 
              cards={columns.andamento} 
              clients={clients} 
              users={users} 
              onQuickView={handleOpenQuickView}
              elapsedTimes={elapsedTimes}
              onStartTimer={handleStartTimer}
              onPauseTimer={handlePauseTimer}
              formatTime={formatTime}
            />
            <DroppableColumn 
              id="concluido" 
              title="Concluído" 
              cards={columns.concluido} 
              clients={clients} 
              users={users} 
              onQuickView={handleOpenQuickView}
              elapsedTimes={elapsedTimes}
              onStartTimer={handleStartTimer}
              onPauseTimer={handlePauseTimer}
              formatTime={formatTime}
            />
          </div>

          <DragOverlay>
            {activeDragCard ? (
              <div className="bg-white p-4 rounded-2xl border-2 border-blue-500 shadow-2xl opacity-80 scale-105">
                <h4 className="font-bold text-xs text-stone-900 uppercase tracking-tight">{activeDragCard.title || activeDragCard.clientName || 'Tarefa'}</h4>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <QuickViewCardModal 
          isOpen={!!quickViewCard}
          onClose={() => setQuickViewCard(null)}
          card={quickViewCard}
          client={clients.find(c => c.id === quickViewCard?.clientId)}
          users={[userProfile]}
          tags={tags}
          onEdit={() => {}} // Team members cannot edit full card details from dashboard
          sector={quickViewSector}
          allCommercialCards={commercialCards}
          allFinancialCards={financialCards}
          allOperationCards={operationCards}
          allInternalTaskCards={internalTaskCards}
        />
      </div>
    </div>
  );
};
