import React, { useState, useEffect } from 'react';
import { NotesEditor } from './NotesEditor';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit2, CheckSquare, Calendar, User, AlignLeft, Clock, RotateCcw, Trash2, Check, CheckCircle2, Layers, MousePointer2 } from 'lucide-react';
import { 
  deleteCommercialCard, 
  deleteFinancialCard, 
  deleteOperationCard, 
  deleteInternalTaskCard,
  permanentDeleteCommercialCard,
  permanentDeleteFinancialCard,
  permanentDeleteOperationCard,
  permanentDeleteInternalTaskCard,
  updateCommercialCard,
  updateFinancialCard,
  updateOperationCard,
  updateInternalTaskCard
} from '../services/firestoreService';
import { Timestamp } from 'firebase/firestore';
import { CommercialCard, FinancialCard, OperationCard, InternalTaskCard, Client, UserProfile, Tag, ChecklistItem } from '../types';

const isLightColor = (color: string) => {
  if (!color) return true;
  if (!color.startsWith('#')) return true;
  const hex = color.replace('#', '');
  if (hex.length !== 6) return true;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155; // Slightly higher threshold for better contrast
};

interface QuickViewCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CommercialCard | FinancialCard | OperationCard | InternalTaskCard | null;
  client?: Client;
  users: UserProfile[];
  tags: Tag[];
  onEdit: () => void;
  sector: 'commercial' | 'financial' | 'operation' | 'internal';
  // All cards for related tasks
  allCommercialCards?: CommercialCard[];
  allFinancialCards?: FinancialCard[];
  allOperationCards?: OperationCard[];
  allInternalTaskCards?: InternalTaskCard[];
  onJumpToCard?: (card: any, sector: string) => void;
}

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

export const QuickViewCardModal: React.FC<QuickViewCardModalProps> = ({ 
  isOpen, 
  onClose, 
  card, 
  client, 
  users, 
  tags, 
  onEdit,
  sector,
  allCommercialCards = [],
  allFinancialCards = [],
  allOperationCards = [],
  allInternalTaskCards = [],
  onJumpToCard
}) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localNotes, setLocalNotes] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (card) {
      setLocalNotes(card.notes || '');
      setLocalTitle(card.type === 'client' && client ? client.name : (card.title || (card as any).clientName || ''));
      setLocalChecklist(card.checklist || client?.checklist || []);
    }
  }, [card, client]);
  if (!card) return null;

  const isClientCard = card.type === 'client';
  
  const relatedTasks = isClientCard && client ? [
    ...allCommercialCards.filter(c => c.clientId === client.id && c.id !== card.id && !c.deleted && c.type !== 'client').map(c => ({ ...c, metaType: 'commercial' as const })),
    ...allFinancialCards.filter(c => c.clientId === client.id && c.id !== card.id && !c.deleted && c.type !== 'client').map(c => ({ ...c, metaType: 'financial' as const })),
    ...allOperationCards.filter(c => c.clientId === client.id && c.id !== card.id && !c.deleted && c.type !== 'client').map(c => ({ ...c, metaType: 'operation' as const })),
    ...allInternalTaskCards.filter(c => c.clientId === client.id && c.id !== card.id && !c.deleted && c.type !== 'client').map(c => ({ ...c, metaType: 'internal' as const })),
  ].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const t1 = (a as any).createdAt?.seconds || new Date((a as any).createdAt || 0).getTime();
    const t2 = (b as any).createdAt?.seconds || new Date((b as any).createdAt || 0).getTime();
    return t1 - t2;
  }) : [];

  const checklist = localChecklist;
  const completedCount = checklist.filter(i => i.completed).length + relatedTasks.filter(t => t.completed).length;
  const totalCount = checklist.length + relatedTasks.length;
  
  const formatDate = (date: any) => {
    if (!date) return 'Não definida';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const syncUpdate = async (data: any) => {
    try {
      if (sector === 'commercial') await updateCommercialCard(card.id, data);
      else if (sector === 'financial') await updateFinancialCard(card.id, data);
      else if (sector === 'operation') await updateOperationCard(card.id, data);
      else if (sector === 'internal') await updateInternalTaskCard(card.id, data);
    } catch (err) {
      console.error('Erro ao atualizar card:', err);
    }
  };

  const toggleCheckItem = async (itemId: string) => {
    const updated = localChecklist.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setLocalChecklist(updated);
    await syncUpdate({ checklist: updated });
  };

  const toggleRelatedTask = async (taskId: string, type: string, currentCompleted: boolean) => {
    const data = { completed: !currentCompleted, updatedAt: Timestamp.now() };
    if (type === 'commercial') await updateCommercialCard(taskId, data);
    else if (type === 'financial') await updateFinancialCard(taskId, data);
    else if (type === 'operation') await updateOperationCard(taskId, data);
    else if (type === 'internal') await updateInternalTaskCard(taskId, data);
  };

  const handleNotesBlur = async () => {
    setIsEditingNotes(false);
    if (localNotes !== card.notes) {
      await syncUpdate({ notes: localNotes });
    }
  };

  const handleTitleBlur = async () => {
    setIsEditingTitle(false);
    if (card.type !== 'client' && localTitle !== (card.title || '')) {
      await syncUpdate({ title: localTitle });
    }
  };

  const getSectorLabel = () => {
    switch (sector) {
      case 'commercial': return 'Comercial';
      case 'financial': return 'Integração';
      case 'operation': return 'Operação';
      case 'internal': return 'Tarefas Internas';
      default: return '';
    }
  };

  const getSectorColor = () => {
    switch (sector) {
      case 'commercial': return 'stone';
      case 'financial': return 'blue';
      case 'operation': return 'green';
      case 'internal': return 'purple';
      default: return 'stone';
    }
  };

  const sectorColor = getSectorColor();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-nunito">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="relative bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
          >
            {/* Header com Gradiente Sutil */}
            {(() => {
              const proximity = getDateProximity(card.deliveryDate);
              const isOverdue = proximity === 'overdue';
              const displayColor = isOverdue ? '#991b1b' : (card.color || '');
              
              if (displayColor) {
                return <div className="h-2 shadow-sm" style={{ backgroundColor: displayColor }} />;
              }
              return <div className={`h-2 bg-gradient-to-r from-${sectorColor}-500 to-${sectorColor}-700 shadow-sm`} />;
            })()}
            
            <div className="flex items-center justify-between p-8 pb-4">
              <div className="flex items-center gap-3">
                <div className="px-4 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-stone-700 text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getDateProximity(card.deliveryDate) === 'overdue' ? '#991b1b' : (card.color || '#e5e7eb') }} />
                  {getSectorLabel()}
                </div>
                {client && (
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
                    <User size={12} className="text-blue-500" />
                    {client.name}
                  </div>
                )}
                {card.recurrence?.enabled && (
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
                    <RotateCcw size={12} className="animate-spin-slow" />
                    Notificação Recorrente
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    onClose();
                    onEdit();
                  }}
                  className="p-3 bg-stone-100 hover:bg-stone-900 text-stone-500 hover:text-white rounded-2xl transition-all duration-300 group shadow-sm border border-stone-200"
                  title="Editar Card"
                >
                  <Edit2 size={20} className="group-hover:scale-110 transition-transform" />
                </button>
                {!isClientCard && (
                  <button 
                    onClick={async () => {
                      if (card.deleted) {
                        if (window.confirm('Tem certeza que deseja excluir PERMANENTEMENTE? Esta ação não pode ser desfeita.')) {
                          if (sector === 'commercial') await permanentDeleteCommercialCard(card.id);
                          else if (sector === 'financial') await permanentDeleteFinancialCard(card.id);
                          else if (sector === 'operation') await permanentDeleteOperationCard(card.id);
                          else if (sector === 'internal') await permanentDeleteInternalTaskCard(card.id);
                          onClose();
                        }
                      } else {
                        if (window.confirm('Deseja mover este card para a lixeira?')) {
                          if (sector === 'commercial') await deleteCommercialCard(card.id);
                          else if (sector === 'financial') await deleteFinancialCard(card.id);
                          else if (sector === 'operation') await deleteOperationCard(card.id);
                          else if (sector === 'internal') await deleteInternalTaskCard(card.id);
                          onClose();
                        }
                      }
                    }}
                    className="p-3 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all duration-300 group shadow-sm border border-red-100"
                    title="Excluir Card"
                  >
                    <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
                  </button>
                )}
                <button 
                  onClick={onClose}
                  className="p-3 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-2xl transition-all duration-300 ml-2"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="px-8 pb-8 overflow-y-auto custom-scrollbar">
              {/* Título Editável */}
              {isEditingTitle && card.type !== 'client' ? (
                <input 
                  autoFocus
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
                  className="text-3xl font-black text-stone-900 leading-tight mb-8 w-full bg-transparent border-b-2 border-stone-200 focus:outline-none focus:border-stone-900 pb-1"
                />
              ) : (
                <h1 
                  onClick={() => card.type !== 'client' && setIsEditingTitle(true)}
                  className={`text-3xl font-black text-stone-900 leading-tight mb-8 ${card.type !== 'client' ? 'cursor-text hover:text-stone-600 transition-colors' : ''}`}
                >
                  {localTitle}
                </h1>
              )}

              {/* Informações Básicas: Datas e Responsáveis em Linha */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
                {/* Datas */}
                <div className="bg-stone-50 rounded-3xl p-6 border border-stone-200 flex flex-wrap gap-4 items-center shadow-sm">
                  <div className="flex-1 space-y-1.5 text-center px-2 py-3 rounded-2xl bg-white border border-stone-200 shadow-sm">
                    <div className="flex items-center justify-center gap-1.5 text-stone-500 text-[9px] font-black uppercase tracking-widest">
                      <Calendar size={12} className="text-stone-400" />
                      Início
                    </div>
                    <div className="text-sm font-black text-stone-900">{formatDate(card.startDate)}</div>
                  </div>
                  
                  <div className="flex-1 space-y-1.5 text-center px-2 py-3 rounded-2xl bg-white border border-stone-200 shadow-sm">
                    <div className="flex items-center justify-center gap-1.5 text-stone-500 text-[9px] font-black uppercase tracking-widest">
                      <Clock size={12} className="text-stone-400" />
                      Entrega
                    </div>
                    {(() => {
                      const proximity = getDateProximity(card.deliveryDate);
                      const colorClass = proximity === 'overdue' ? 'text-red-600 bg-red-50/30' : proximity === 'near' ? 'text-orange-600 bg-orange-50/30' : 'text-stone-900';
                      return (
                        <div className={`text-sm font-black rounded-lg py-0.5 ${colorClass}`}>{formatDate(card.deliveryDate)}</div>
                      );
                    })()}
                  </div>

                  {card.recurrence?.enabled && (() => {
                    const nextRec = getNextRecurrenceDate(card.recurrence);
                    if (!nextRec) return null;
                    const proximity = getDateProximity(nextRec);
                    const colorClass = proximity === 'overdue' ? 'text-red-700 font-black' : proximity === 'near' ? 'text-orange-700 font-black' : 'text-stone-900 font-black';
                    return (
                      <div className="flex-1 space-y-1.5 text-center px-2 py-3 rounded-2xl bg-orange-50 border border-orange-200 shadow-sm min-w-[120px]">
                        <div className="flex items-center justify-center gap-1.5 text-orange-600 text-[9px] font-black uppercase tracking-widest">
                          <RotateCcw size={12} className={proximity === 'near' || proximity === 'overdue' ? 'animate-spin-slow' : ''} />
                          Recorrência
                        </div>
                        <div className={`text-sm ${colorClass}`}>{formatDate(nextRec)}</div>
                      </div>
                    );
                  })()}
                </div>

                {/* Responsáveis */}
                <div className="space-y-4 bg-stone-50 rounded-3xl p-6 border border-stone-200 shadow-sm lg:col-span-1">
                  <div className="text-stone-500 text-[11px] font-black uppercase tracking-[0.2em] px-1">
                    Responsáveis
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {card.assignees && card.assignees.length > 0 ? (
                      card.assignees.map(userId => {
                        const u = users.find(user => user.id === userId);
                        if (!u) return null;
                        return (
                          <div key={userId} className="flex items-center gap-2 bg-white border border-stone-200 p-1.5 pr-4 rounded-2xl shadow-sm hover:border-stone-400 transition-all group">
                            <div className="w-8 h-8 rounded-xl border-2 border-stone-100 overflow-hidden bg-stone-100 group-hover:scale-105 transition-transform shadow-sm">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-black text-stone-500 uppercase">
                                  {u.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-black text-stone-700">{u.name}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs font-bold text-stone-400 italic px-1">Ninguém atribuído.</div>
                    )}
                  </div>
                </div>

                {/* Tags de Serviço (se for cliente) */}
                {client?.serviceTags && client.serviceTags.length > 0 && (
                  <div className="space-y-4 bg-stone-50 rounded-3xl p-6 border border-stone-200 shadow-sm">
                    <div className="text-stone-500 text-[11px] font-black uppercase tracking-[0.2em] px-1">
                      Serviços Contratados
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {client.serviceTags.map(tagId => {
                        const tag = tags.find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <span 
                            key={tag.id} 
                            className="text-[10px] font-black px-4 py-2 rounded-2xl shadow-sm border"
                            style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
                          >
                            {tag.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Seção Principal de Conteúdo */}
              <div className="space-y-12">
                {/* Linked Cards (Primary for Clients) */}
                {isClientCard && relatedTasks.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-stone-600 text-[11px] font-black uppercase tracking-[0.2em]">
                        <Layers size={16} className="text-stone-400" />
                        Cards Vinculados
                      </div>
                      <div className="text-[10px] font-black text-stone-400 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                        {relatedTasks.length} CARDS
                      </div>
                    </div>
                    
                    <div className="max-h-[360px] overflow-y-auto custom-scrollbar pr-2 -mr-2 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {relatedTasks.map(task => {
                          const taskSector = (task as any).metaType;
                          const taskSectorLabel = 
                            taskSector === 'commercial' ? 'Comercial' :
                            taskSector === 'financial' ? 'Integração' :
                            taskSector === 'operation' ? 'Operação' : 'Tarefas Internas';

                          const sectorColorClass = 
                            taskSector === 'commercial' ? 'stone' :
                            taskSector === 'financial' ? 'blue' :
                            taskSector === 'operation' ? 'green' : 'purple';

                          const isOverdue = !task.completed && task.deliveryDate && getDateProximity(task.deliveryDate) === 'overdue';

                          return (
                            <div 
                              key={task.id}
                              onClick={() => onJumpToCard?.(task, taskSector === 'commercial' ? 'comercial' : taskSector === 'financial' ? 'integracao' : taskSector === 'operation' ? 'operacao' : 'internal_tasks')}
                              className={`rounded-[1.5rem] p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group border-2 flex flex-col justify-between min-h-[110px] ${
                                task.completed ? 'bg-green-50 border-green-200 opacity-80' : 
                                isOverdue ? 'bg-red-50 border-red-200' : 
                                'bg-white border-stone-100 hover:border-stone-300'
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                                    task.completed ? 'bg-green-600 text-white' : 
                                    isOverdue ? 'bg-red-600 text-white' : 
                                    `bg-${sectorColorClass}-50 text-${sectorColorClass}-600 border border-${sectorColorClass}-100`
                                  }`}>
                                    {task.completed ? 'Concluído' : isOverdue ? 'Em Atraso' : taskSectorLabel}
                                  </span>
                                  {task.deliveryDate && !task.completed && (
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${isOverdue ? 'text-red-500 font-bold' : 'text-stone-400'}`}>
                                      {formatDate(task.deliveryDate)}
                                    </span>
                                  )}
                                </div>
                                <h4 className={`text-sm font-black transition-colors line-clamp-2 leading-tight ${task.completed ? 'text-green-900/60' : isOverdue ? 'text-red-900' : 'text-stone-900 group-hover:text-stone-600'}`}>
                                  {task.title || task.clientName || 'Card sem Título'}
                                </h4>
                              </div>
                              
                              {!task.completed && (
                                  <div className="mt-3 flex items-center justify-between">
                                      <div className="flex -space-x-1">
                                          {task.assignees?.slice(0, 3).map(uid => {
                                              const u = users.find(user => user.id === uid);
                                              return u ? (
                                                  <div key={uid} className="w-5 h-5 rounded-full border border-white overflow-hidden bg-stone-100 shadow-sm" title={u.name}>
                                                      {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[6px] font-bold text-stone-400">{u.name.charAt(0)}</div>}
                                                  </div>
                                              ) : null;
                                          })}
                                      </div>
                                  </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Checklist Interativo */}
                {(localChecklist.length > 0) && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-stone-600 text-[11px] font-black uppercase tracking-[0.2em]">
                        <CheckSquare size={16} className="text-stone-400" />
                        Checklist do Cliente
                      </div>
                      <div className="text-[11px] font-black text-stone-900 bg-stone-200 px-3 py-1 rounded-full border border-stone-300 shadow-sm">
                        {localChecklist.filter(i => i.completed).length}/{localChecklist.length}
                      </div>
                    </div>
                    
                    {/* Barra de Progresso do Checklist Específico */}
                    <div className="h-4 bg-stone-100 rounded-full overflow-hidden border border-stone-200 shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(localChecklist.filter(i => i.completed).length / localChecklist.length) * 100}%` }}
                        className={`h-full bg-gradient-to-r from-${sectorColor}-600 to-${sectorColor}-800 shadow-xl`}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {localChecklist.map((item) => (
                        <button 
                          key={item.id}
                          onClick={() => toggleCheckItem(item.id)}
                          className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group ${item.completed ? 'bg-green-50/50 border-green-200 text-green-800/60 shadow-none' : 'bg-white border-stone-100 text-stone-700 shadow-md hover:border-stone-200 active:scale-[0.98]'}`}
                        >
                          <div className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${item.completed ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-400 group-hover:bg-stone-200'}`}>
                            {item.completed ? <Check size={16} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-stone-300" />}
                          </div>
                          <span className={`text-sm font-bold flex-1 ${item.completed ? 'line-through opacity-70' : ''}`}>
                            {item.text}
                          </span>
                          {!item.completed && (
                            <CheckCircle2 size={16} className="text-stone-200 opacity-0 group-hover:opacity-100 transition-all" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notas Editáveis */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-stone-600 text-[11px] font-black uppercase tracking-[0.2em]">
                    <AlignLeft size={16} className="text-stone-400" />
                    Anotações Gerais
                  </div>
                  <div 
                    className={`transition-all min-h-[160px] shadow-sm rounded-3xl overflow-hidden ${isEditingNotes ? '' : 'bg-stone-50 border-2 border-stone-200 hover:border-stone-300 cursor-text p-8'}`}
                    onClick={() => !isEditingNotes && setIsEditingNotes(true)}
                  >
                    {isEditingNotes ? (
                      <div className="space-y-3">
                        <NotesEditor 
                          value={localNotes}
                          onChange={setLocalNotes}
                          placeholder="Adicione informações importantes..."
                          minHeight="250px"
                        />
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleNotesBlur(); }}
                            className="px-8 py-2.5 bg-stone-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-stone-800 transition-all shadow-lg active:scale-95"
                          >
                            Salvar Alterações
                          </button>
                        </div>
                      </div>
                    ) : localNotes ? (
                      <div 
                        className="text-stone-700 text-sm leading-relaxed rich-text-content"
                        dangerouslySetInnerHTML={{ __html: localNotes }}
                      />
                    ) : (
                      <p className="text-stone-400 text-sm italic">Nenhuma anotação disponível. Clique para adicionar.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 pt-4 bg-stone-100/50 border-t border-stone-200 flex justify-between items-center mt-auto">
              <div className="text-[10px] text-stone-500 font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-stone-200 shadow-sm">
                ID: {card.id.substring(0, 8)}
              </div>
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-stone-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-stone-800 transition-all shadow-lg hover:shadow-stone-900/20 active:scale-95 flex items-center gap-2"
              >
                <Check size={16} strokeWidth={3} />
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
