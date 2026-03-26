import React, { useState, useEffect } from 'react';
import { UserProfile, Tag, CommercialCard, FinancialCard, OperationCard, InternalTaskCard, InternalTaskList, CompanyType } from '../types';
import { User, Briefcase, Info, Clock, CheckSquare, Plus, X, Search, Hash, ExternalLink, Mail, ListTodo, Bookmark, Send, Loader2, Play, Pause, Square, UserMinus, Calendar, Check, DollarSign } from 'lucide-react';
import { updateUserTags, addInternalTaskCard, updateCardTimer, completeInternalTaskCard, completeCommercialCard, completeFinancialCard, completeOperationCard, updateCommercialCard, updateFinancialCard, updateOperationCard, updateInternalTaskCard } from '../services/firestoreService';
import { Modal } from './Modal';
import { Timestamp } from 'firebase/firestore';
import { updateUserHourlyRate } from '../services/firestoreService';

interface TeamViewProps {
  users: UserProfile[];
  allTags: Tag[];
  allCommercialCards: CommercialCard[];
  allFinancialCards: FinancialCard[];
  allOperationCards: OperationCard[];
  allInternalTaskCards: InternalTaskCard[];
  internalTaskLists: InternalTaskList[];
  selectedCompanyId: CompanyType;
  currentUser?: UserProfile;
  onJumpToCard?: (cardId: string, sector: string) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({ 
  users, 
  allTags,
  allCommercialCards,
  allFinancialCards,
  allOperationCards,
  allInternalTaskCards,
  internalTaskLists,
  selectedCompanyId,
  currentUser,
  onJumpToCard
}) => {
  const [activeCategory, setActiveCategory] = useState<'terceirizado' | 'internalizado' | 'intermediados'>('terceirizado');
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [tagSearch, setTagSearch] = useState('');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyMonth, setHistoryMonth] = useState<number>(-1);
  const [historyYear, setHistoryYear] = useState<number>(-1);
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});

  const unassignedInternalCards = allInternalTaskCards.filter(card => 
    selectedMember && 
    !card.assignees?.includes(selectedMember.id) &&
    !card.deleted &&
    !card.completed
  );

  React.useEffect(() => {
    const interval = setInterval(() => {
      const newElapsed: Record<string, number> = {};
      const allTasks = selectedMember ? getUserTasks(selectedMember.id) : [];
      
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
  }, [selectedMember, allCommercialCards, allFinancialCards, allOperationCards, allInternalTaskCards]);

  const categories = [
    { id: 'terceirizado', name: 'Terceirizados', description: 'Profissionais e empresas parceiras externas.' },
    { id: 'internalizado', name: 'Internalizados', description: 'Equipe interna direta da Tali.' },
    { id: 'intermediados', name: 'Intermediados', description: 'Profissionais em regime de intermediação.' },
  ];

  const filteredUsers = users.filter(u => u.role === 'equipe' && u.teamCategory === activeCategory);

  const handleToggleTag = async (userId: string, tagId: string, currentTags: string[] = []) => {
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter(id => id !== tagId)
      : [...currentTags, tagId];
    
    await updateUserTags(userId, newTags);
    if (selectedMember && selectedMember.id === userId) {
      setSelectedMember({ ...selectedMember, serviceTags: newTags });
    }
  };

  const getUserTasks = (userId: string) => {
    const commercial = allCommercialCards.filter(c => c.assignees?.includes(userId) && !c.deleted && !c.completed);
    const financial = allFinancialCards.filter(c => c.assignees?.includes(userId) && !c.deleted && !c.completed);
    const operation = allOperationCards.filter(c => c.assignees?.includes(userId) && !c.deleted && !c.completed);
    const internal = allInternalTaskCards.filter(c => c.assignees?.includes(userId) && !c.deleted && !c.completed);

    return [
      ...commercial.map(c => ({ ...c, sector: 'comercial', color: '#5271FF' })),
      ...financial.map(c => ({ ...c, sector: 'financeiro', color: '#10b981' })),
      ...operation.map(c => ({ ...c, sector: 'operacional', color: '#f59e0b' })),
      ...internal.map(c => ({ ...c, sector: 'interno', color: '#6b7280' }))
    ];
  };

  const getUserHistory = (userId: string) => {
    const commercial = allCommercialCards.filter(c => c.assignees?.includes(userId) && c.completed && !c.deleted);
    const financial = allFinancialCards.filter(c => c.assignees?.includes(userId) && c.completed && !c.deleted);
    const operation = allOperationCards.filter(c => c.assignees?.includes(userId) && c.completed && !c.deleted);
    const internal = allInternalTaskCards.filter(c => c.assignees?.includes(userId) && c.completed && !c.deleted);

    return [
      ...commercial.map(c => ({ ...c, sector: 'comercial', color: '#5271FF' })),
      ...financial.map(c => ({ ...c, sector: 'financeiro', color: '#10b981' })),
      ...operation.map(c => ({ ...c, sector: 'operacional', color: '#f59e0b' })),
      ...internal.map(c => ({ ...c, sector: 'interno', color: '#6b7280' }))
    ].sort((a, b) => {
      const dateA = a.updatedAt instanceof Timestamp ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
      const dateB = b.updatedAt instanceof Timestamp ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const getTaskStatus = (task: any) => {
    if (task.completed) return { label: 'Arquivado', color: 'bg-stone-100 text-stone-500 border-stone-200' };
    if (task.workerFinished) return { label: 'Concluído pelo Terceirizado', color: 'bg-green-100 text-green-700 border-green-200' };
    if (task.timerStatus === 'running') return { label: 'Em andamento', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    return { label: 'Pendente', color: 'bg-stone-100 text-stone-600 border-stone-200' };
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !selectedTaskId) return;

    setIsCreatingTask(true);
    try {
      const taskToAssign = allInternalTaskCards.find(t => t.id === selectedTaskId);
      if (!taskToAssign) return;

      const currentAssignees = taskToAssign.assignees || [];
      await updateInternalTaskCard(selectedTaskId, {
        assignees: [...currentAssignees, selectedMember.id]
      });

      setSelectedTaskId('');
      setIsAddTaskOpen(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao atribuir tarefa.');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleStartTimer = async (task: any) => {
    if (!selectedMember) return;

    const allTasks = getUserTasks(selectedMember.id);
    const alreadyRunning = allTasks.find(t => t.timerStatus === 'running');

    if (alreadyRunning) {
      alert(`O profissional ${selectedMember.name} já possui uma tarefa em andamento: "${alreadyRunning.title || (alreadyRunning as any).clientName}". Pause a tarefa atual para iniciar uma nova.`);
      return;
    }

    await updateCardTimer(task.id, task.sector, {
      timeSpent: task.timeSpent || 0,
      timerStartedAt: new Date(),
      timerStatus: 'running'
    });
  };

  const handlePauseTimer = async (task: any) => {
    const startedAt = task.timerStartedAt instanceof Timestamp 
      ? task.timerStartedAt.toDate() 
      : new Date(task.timerStartedAt);
    const diffInSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const totalTime = (task.timeSpent || 0) + diffInSeconds;

    await updateCardTimer(task.id, task.sector, {
      timeSpent: totalTime,
      timerStartedAt: null,
      timerStatus: 'paused'
    });
  };

  const handleFinishTimer = async (task: any) => {
    let finalTime = task.timeSpent || 0;
    
    if (task.timerStatus === 'running' && task.timerStartedAt) {
      const startedAt = task.timerStartedAt instanceof Timestamp 
        ? task.timerStartedAt.toDate() 
        : new Date(task.timerStartedAt);
      finalTime += Math.floor((Date.now() - startedAt.getTime()) / 1000);
    }

    const data = {
      timeSpent: finalTime,
      timerStartedAt: null,
      timerStatus: 'idle' as const,
      workerFinished: true
    };

    if (task.sector === 'comercial') await updateCommercialCard(task.id, data);
    else if (task.sector === 'financeiro') await updateFinancialCard(task.id, data);
    else if (task.sector === 'operacional') await updateOperationCard(task.id, data);
    else await updateInternalTaskCard(task.id, data);
  };

  const handleFinalizeAllUserTasks = async () => {
    if (!selectedMember) return;
    const tasks = getUserTasks(selectedMember.id).filter(t => t.workerFinished && !t.completed);
    
    if (tasks.length === 0) {
      alert('Nenhuma tarefa finalizada pelos terceirizados encontrada para este profissional.');
      return;
    }

    if (!window.confirm(`Deseja aprovar e arquivar ${tasks.length} tarefa(s) finalizada(s) para este profissional? Esta ação moverá as tarefas para o histórico.`)) {
      return;
    }

    setIsCreatingTask(true);
    try {
      for (const task of tasks) {
        if (task.sector === 'comercial') await completeCommercialCard(task.id);
        else if (task.sector === 'financeiro') await completeFinancialCard(task.id);
        else if (task.sector === 'operacional') await completeOperationCard(task.id);
        else await completeInternalTaskCard(task.id);
      }
      alert(`${tasks.length} tarefas foram arquivadas com sucesso.`);
    } catch (error) {
      console.error(error);
      alert('Erro ao finalizar tarefas.');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleApproveTask = async (task: any) => {
    if (currentUser?.role !== 'admin') return;
    try {
      if (task.sector === 'comercial') await completeCommercialCard(task.id);
      else if (task.sector === 'financeiro') await completeFinancialCard(task.id);
      else if (task.sector === 'operacional') await completeOperationCard(task.id);
      else await completeInternalTaskCard(task.id);
    } catch (error) {
      console.error(error);
      alert('Erro ao aprovar tarefa.');
    }
  };

  const handleRejectTask = async (task: any) => {
    if (currentUser?.role !== 'admin') return;
    if (!window.confirm(`Deseja reprovar a tarefa "${task.title || (task as any).clientName}"? Ela voltará a ficar como pendente para o colaborador.`)) {
      return;
    }

    try {
      const data = { workerFinished: false };
      if (task.sector === 'comercial') await updateCommercialCard(task.id, data);
      else if (task.sector === 'financeiro') await updateFinancialCard(task.id, data);
      else if (task.sector === 'operacional') await updateOperationCard(task.id, data);
      else await updateInternalTaskCard(task.id, data);
    } catch (error) {
      console.error(error);
      alert('Erro ao reprovar tarefa.');
    }
  };

  const handleWorkerRevokeFinish = async (task: any) => {
    if (!selectedMember || currentUser?.id !== selectedMember.id) return;
    
    try {
      const data = { workerFinished: false, timerStatus: 'idle' as const };
      if (task.sector === 'comercial') await updateCommercialCard(task.id, data);
      else if (task.sector === 'financeiro') await updateFinancialCard(task.id, data);
      else if (task.sector === 'operacional') await updateOperationCard(task.id, data);
      else await updateInternalTaskCard(task.id, data);
    } catch (error) {
      console.error(error);
      alert('Erro ao desconcluir tarefa.');
    }
  };

  const handleRevertTask = async (task: any) => {
    if (currentUser?.role !== 'admin') {
      alert('Apenas administradores podem reverter tarefas concluídas.');
      return;
    }
    
    if (!window.confirm(`Deseja reativar a tarefa "${task.title || (task as any).clientName}"? Ela voltará para a lista de tarefas ativas.`)) {
      return;
    }

    const data = {
      completed: false,
      workerFinished: false,
      timerStatus: 'idle' as const
    };

    try {
      if (task.sector === 'comercial') await updateCommercialCard(task.id, data);
      else if (task.sector === 'financeiro') await updateFinancialCard(task.id, data);
      else if (task.sector === 'operacional') await updateOperationCard(task.id, data);
      else await updateInternalTaskCard(task.id, data);
    } catch (error) {
      console.error(error);
      alert('Erro ao reverter tarefa.');
    }
  };

  const handleUnassignTask = async (task: any) => {
    if (!selectedMember) return;
    if (!window.confirm(`Deseja remover a atribuição desta tarefa para ${selectedMember.name}?`)) return;

    const updatedAssignees = (task.assignees || []).filter((id: string) => id !== selectedMember.id);
    const data = { assignees: updatedAssignees };

    if (task.sector === 'comercial') await updateCommercialCard(task.id, data);
    else if (task.sector === 'financeiro') await updateFinancialCard(task.id, data);
    else if (task.sector === 'operacional') await updateOperationCard(task.id, data);
    else await updateInternalTaskCard(task.id, data);
  };

  const handleJumpToTask = (task: any) => {
    setSelectedMember(null); // Close modal
    const sectorTab = task.sector === 'interno' ? 'internal_tasks' : 
                     task.sector === 'comercial' ? 'commercial' :
                     task.sector === 'financeiro' ? 'financial' : 'operation';
    onJumpToCard?.(task.id, sectorTab);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fdfdfd] overflow-hidden p-6 md:p-8 font-nunito">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 py-1 px-2 gap-4 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-900 leading-tight">Gestão de Equipe</h1>
          <p className="text-stone-500 text-[11px] md:text-sm mt-0.5 font-medium">Organize e visualize todos os membros da sua equipe por categorias.</p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-4 mb-8">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id as any)}
            className={`flex-1 min-w-[200px] p-5 rounded-3xl border-2 transition-all text-left relative group ${
              activeCategory === category.id 
                ? 'bg-stone-900 border-stone-900 shadow-xl shadow-stone-900/10' 
                : 'bg-white border-stone-100 hover:border-stone-200 shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2.5 rounded-2xl ${activeCategory === category.id ? 'bg-white/10 text-white' : 'bg-stone-50 text-stone-400'}`}>
                <Briefcase size={20} />
              </div>
              {activeCategory === category.id && (
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              )}
            </div>
            
            <h3 className={`font-black text-sm uppercase tracking-widest mb-1 ${activeCategory === category.id ? 'text-white' : 'text-stone-900'}`}>
              {category.name}
            </h3>
            <p className={`text-[10px] font-bold leading-relaxed ${activeCategory === category.id ? 'text-white/60' : 'text-stone-400'}`}>
              {category.description}
            </p>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-stone-400 flex items-center gap-2">
            Membros em {categories.find(c => c.id === activeCategory)?.name}
            <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded-md text-[10px]">{filteredUsers.length}</span>
          </h2>
        </div>

        {activeCategory === 'terceirizado' ? (
          filteredUsers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredUsers.map((user) => (
                <div 
                  key={user.id}
                  onClick={() => setSelectedMember(user)}
                  className="bg-white border border-stone-100 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col group cursor-pointer relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-3xl bg-stone-100 border-4 border-stone-50 overflow-hidden flex items-center justify-center transform group-hover:rotate-3 transition-transform duration-500">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User size={28} className="text-stone-300" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-stone-900 border-2 border-white rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Briefcase size={10} />
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-stone-400">Ativo</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-black text-base text-stone-900 leading-tight mb-1 group-hover:text-blue-600 transition-colors">
                      {user.name}
                    </h4>
                    <p className="text-[9px] font-bold text-stone-400 truncate w-full">
                      {user.email}
                    </p>
                  </div>

                  {/* Services Tags Summary */}
                  <div className="flex flex-wrap gap-1 mb-4 h-10 overflow-hidden relative">
                    {(user.serviceTags || []).length > 0 ? (
                      user.serviceTags?.slice(0, 3).map(tagId => {
                        const tag = allTags.find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                          <span 
                            key={tagId}
                            className="text-[8px] font-black px-1.5 py-0.5 rounded-lg border flex items-center gap-1"
                            style={{ 
                              backgroundColor: tag.color + '10', 
                              borderColor: tag.color + '20', 
                              color: tag.color 
                            }}
                          >
                            {tag.name}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[8px] font-medium text-stone-300 italic">Sem serviços</span>
                    )}
                    {(user.serviceTags || []).length > 3 && (
                      <span className="text-[8px] font-black text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-lg">
                        +{(user.serviceTags || []).length - 3}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-stone-50 flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-widest text-stone-400">
                      {user.teamCategory || 'Terceirizado'}
                    </span>
                    <button className="p-2 bg-stone-50 group-hover:bg-blue-600 group-hover:text-white rounded-xl transition-all">
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-stone-50/50 rounded-3xl border-2 border-dashed border-stone-100">
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-stone-100 mb-4">
                <User size={32} className="text-stone-200" />
              </div>
              <p className="text-stone-400 font-bold text-sm">Nenhum membro encontrado nesta categoria.</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-stone-50/50 rounded-3xl border-2 border-dashed border-stone-100">
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-stone-100 mb-4">
              <Info size={32} className="text-stone-200" />
            </div>
            <h3 className="text-stone-900 font-black text-sm uppercase tracking-widest mb-1">Implementação Futura</h3>
            <p className="text-stone-400 font-medium text-xs max-w-xs text-center">
              A categoria de {categories.find(c => c.id === activeCategory)?.name} ainda não possui ferramentas de gestão ativas.
            </p>
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      {selectedMember && (
        <Modal 
          isOpen={!!selectedMember} 
          onClose={() => {
            setSelectedMember(null);
            setIsEditingTags(false);
          }} 
          title="Detalhes do Membro"
          maxWidth="max-w-5xl"
        >
          <div className="space-y-8 pb-4 font-nunito max-h-[85vh] overflow-y-auto px-1 custom-scrollbar">
            {/* Header Detail */}
            <div className="flex items-center gap-6 bg-stone-50 p-6 rounded-[2rem] border border-stone-100">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-white shadow-lg bg-white shrink-0">
                {selectedMember.photoURL ? (
                  <img src={selectedMember.photoURL} alt={selectedMember.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                    <User size={40} />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                    {selectedMember.teamCategory || 'Membro'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Online</span>
                  </div>
                </div>
                <h2 className="text-2xl font-black text-stone-900 leading-tight">{selectedMember.name}</h2>
                <div className="flex items-center gap-2 text-stone-500 mt-1">
                  <Mail size={14} />
                  <span className="text-xs font-bold">{selectedMember.email}</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl p-6 border-2 border-stone-50 shadow-sm">
                <div className="flex items-center gap-3 text-stone-400 mb-4">
                  <div className="p-2 bg-stone-50 rounded-xl">
                    <Clock size={20} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Horas Trabalhadas</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-stone-900">
                    {(() => {
                      const currentMonth = new Date().getMonth();
                      const currentYear = new Date().getFullYear();
                      const hist = getUserHistory(selectedMember.id).filter(t => {
                        const date = t.updatedAt instanceof Timestamp ? t.updatedAt.toDate() : new Date(t.updatedAt || 0);
                        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
                      });
                      const totalSeconds = hist.reduce((acc, t) => acc + (t.timeSpent || 0), 0);
                      return formatTime(totalSeconds);
                    })()}
                  </span>
                  <span className="text-sm font-bold text-stone-400">no mês atual</span>
                </div>
                <div className="mt-4 pt-4 border-t border-stone-50">
                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full w-[0%]" />
                  </div>
                  <p className="text-[10px] font-bold text-stone-400 mt-2">Nenhum registro de tempo encontrado</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border-2 border-stone-50 shadow-sm">
                <div className="flex items-center gap-3 text-stone-400 mb-4">
                  <div className="p-2 bg-stone-50 rounded-xl">
                    <CheckSquare size={20} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Tarefas em Aberto</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-stone-900">
                    {getUserTasks(selectedMember.id).length.toString().padStart(2, '0')}
                  </span>
                  <span className="text-sm font-bold text-stone-400">entregas pendentes</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1">
                  {getUserTasks(selectedMember.id).slice(0, 10).map((task, i) => (
                    <div key={i} className="w-6 h-1 rounded-full" style={{ backgroundColor: task.color }} />
                  ))}
                </div>
              </div>

              {currentUser?.role === 'admin' && (
                <div className="bg-white rounded-3xl p-6 border-2 border-stone-50 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 text-stone-400">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <DollarSign size={20} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-widest text-stone-400">Valor da Hora</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="relative group flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">R$</span>
                        <input 
                          type="number"
                          defaultValue={selectedMember.hourlyRate || 0}
                          onBlur={async (e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              await updateUserHourlyRate(selectedMember.id, val);
                            }
                          }}
                          className="w-full bg-stone-50 border border-stone-100 rounded-2xl pl-12 pr-4 py-3 text-2xl font-black text-stone-900 focus:outline-none focus:border-blue-500 transition-all"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-green-600 mb-1">Total a Pagar (Mês)</span>
                      <div className="text-xl font-black text-stone-900">
                        {(() => {
                          const currentMonth = new Date().getMonth();
                          const currentYear = new Date().getFullYear();
                          const hist = getUserHistory(selectedMember.id).filter(t => {
                            const date = t.updatedAt instanceof Timestamp ? t.updatedAt.toDate() : new Date(t.updatedAt || 0);
                            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
                          });
                          const totalSeconds = hist.reduce((acc, t) => acc + (t.timeSpent || 0), 0);
                          const totalHours = totalSeconds / 3600;
                          const totalPayout = totalHours * (selectedMember.hourlyRate || 0);
                          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPayout);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tasks Section - NEW */}
            <div className="bg-white rounded-[2rem] p-8 border-2 border-stone-50 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-stone-50 rounded-xl text-stone-400">
                  <ListTodo size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-stone-900 leading-none mb-1">Listagem de Tarefas</h3>
                  <p className="text-[10px] font-bold text-stone-400">Cards atribuídos a este profissional</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {currentUser?.role === 'admin' && getUserTasks(selectedMember.id).some(t => t.workerFinished && !t.completed) && (
                    <button 
                      onClick={handleFinalizeAllUserTasks}
                      className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg active:scale-95 border border-stone-800"
                    >
                      <CheckSquare size={14} className="text-green-400" />
                      Concluir Todas as Tarefas
                    </button>
                  )}
                  {!isAddTaskOpen && (
                    <button 
                      onClick={() => setIsAddTaskOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-100"
                    >
                      <Plus size={14} />
                      Nova Tarefa
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Add Form */}
              {isAddTaskOpen && (
                <div className="relative group bg-white rounded-[2.5rem] p-8 border-2 border-stone-100 shadow-2xl overflow-hidden mt-6 mb-10 transition-all hover:border-stone-200">
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-stone-100 rounded-full blur-3xl opacity-50" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                        <ListTodo size={12} />
                      </div>
                      Atribuir Tarefa Existente
                    </h4>
                    <button 
                      onClick={() => setIsAddTaskOpen(false)} 
                      className="p-2 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded-xl transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleCreateTask} className="flex gap-4">
                    <div className="relative flex-1 group/input">
                      <select
                        value={selectedTaskId}
                        onChange={(e) => setSelectedTaskId(e.target.value)}
                        required
                        className="w-full bg-stone-50 border-2 border-stone-100 group-hover/input:border-stone-200 rounded-2xl px-6 py-4 text-stone-900 text-sm focus:outline-none focus:border-blue-500 transition-all font-bold appearance-none cursor-pointer shadow-sm"
                      >
                        <option value="" disabled className="bg-white text-stone-500">Selecione uma tarefa interna...</option>
                        {unassignedInternalCards.map(card => (
                          <option key={card.id} value={card.id} className="bg-white text-stone-900 py-2">
                            {card.title} / {card.clientName || 'Sem Cliente'}
                          </option>
                        ))}
                        {unassignedInternalCards.length === 0 && (
                          <option disabled className="bg-white text-stone-500">Nenhuma tarefa interna disponível.</option>
                        )}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-stone-300 group-hover/input:text-stone-400 transition-colors">
                        <Plus size={18} strokeWidth={3} />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={isCreatingTask || !selectedTaskId}
                      className={`px-10 rounded-2xl transition-all flex items-center justify-center shadow-lg active:scale-95 ${!selectedTaskId || isCreatingTask ? 'bg-stone-100 text-stone-300' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}
                    >
                      {isCreatingTask ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={3} />}
                    </button>
                  </form>
                  <p className="text-[10px] font-bold text-stone-400 mt-6 italic flex items-center gap-2">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                    A tarefa selecionada será atribuída a este profissional e gerenciada pelo cronômetro.
                  </p>
                </div>
              </div>
              )}

              <div className="space-y-3">
                {getUserTasks(selectedMember.id).length > 0 ? (
                  getUserTasks(selectedMember.id).map((task) => (
                    <div 
                      key={task.id}
                      className={`group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden relative shadow-sm hover:shadow-md ${
                        task.workerFinished 
                          ? 'bg-green-50 border-green-100 hover:border-green-200' 
                          : 'bg-stone-50 border-stone-100 hover:border-stone-200 hover:bg-white'
                      }`}
                    >
                      <div 
                        className="flex items-center gap-4 relative z-10 cursor-pointer group/title"
                        onClick={() => handleJumpToTask(task)}
                      >
                        <div 
                          className="w-1.5 h-1.5 rounded-full" 
                          style={{ backgroundColor: task.color }} 
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-stone-900 leading-tight mb-0.5 group-hover/title:text-blue-600 transition-colors">
                            {task.title || (task as any).clientName || 'Card sem Título'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                              <Bookmark size={8} className="rotate-90" style={{ color: task.color }} />
                              Controle {task.sector}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${getTaskStatus(task).color}`}>
                              {getTaskStatus(task).label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 relative z-10 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleUnassignTask(task); }}
                          className="w-10 h-10 flex items-center justify-center bg-stone-50 text-stone-400 hover:bg-red-50 hover:text-red-500 rounded-full transition-all shadow-sm border border-stone-100/50"
                          title="Remover Atribuição"
                        >
                          <UserMinus size={16} />
                        </button>
                        {!task.completed && !task.workerFinished && (
                          <>
                            {task.timerStatus === 'running' ? (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (currentUser?.id !== selectedMember.id) {
                                    alert('Apenas o próprio profissional pode pausar o cronômetro de suas tarefas.');
                                    return;
                                  }
                                  handlePauseTimer(task); 
                                }}
                                className="w-10 h-10 flex items-center justify-center bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white rounded-full transition-all shadow-sm border border-orange-100/50"
                                title="Pausar Timer"
                              >
                                <Pause size={16} fill="currentColor" />
                              </button>
                            ) : (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (currentUser?.id !== selectedMember.id) {
                                    alert('Apenas o próprio profissional pode iniciar o cronômetro de suas tarefas.');
                                    return;
                                  }
                                  handleStartTimer(task); 
                                }}
                                className="w-10 h-10 flex items-center justify-center bg-stone-50 text-stone-300 hover:bg-green-600 hover:text-white rounded-full transition-all shadow-sm border border-stone-100/50"
                                title="Iniciar Timer"
                              >
                                <Play size={16} fill="currentColor" className="ml-0.5" />
                              </button>
                            )}
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (currentUser?.id !== selectedMember.id) {
                                  alert('Apenas o próprio profissional pode finalizar suas tarefas.');
                                  return;
                                }
                                handleFinishTimer(task); 
                              }}
                              className="w-10 h-10 flex items-center justify-center bg-stone-50 text-stone-300 hover:bg-stone-900 hover:text-white rounded-full transition-all shadow-sm border border-stone-100/50"
                              title="Finalizar Tarefa"
                            >
                              <CheckSquare size={16} />
                            </button>
                          </>
                        )}

                        <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 rounded-2xl border border-stone-100/50 shadow-inner min-w-[100px] justify-center">
                          <Clock size={14} className={task.timerStatus === 'running' ? 'text-blue-500 animate-pulse' : 'text-stone-300'} />
                          <span className={`text-xs font-black font-mono tracking-wider ${task.timerStatus === 'running' ? 'text-stone-900' : 'text-stone-400'}`}>
                            {formatTime(elapsedTimes[task.id] || task.timeSpent || 0)}
                          </span>
                        </div>

                        <button 
                          onClick={(e) => { e.stopPropagation(); handleJumpToTask(task); }}
                          className="w-10 h-10 flex items-center justify-center bg-stone-50 text-stone-400 hover:bg-blue-600 hover:text-white rounded-full transition-all shadow-sm border border-stone-100/50"
                          title="Ir para o Card"
                        >
                          <ExternalLink size={16} />
                        </button>

                        {task.workerFinished && !task.completed && (
                          <div className="flex items-center gap-1 group/approve relative">
                            {currentUser?.role === 'admin' ? (
                              <div className="flex items-center gap-1.5 bg-green-50 p-1.5 rounded-2xl border border-green-100 shadow-sm transition-all hover:bg-white hover:shadow-md">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleApproveTask(task); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-sm"
                                  title="Aprovar e Arquivar"
                                >
                                  <Check size={12} strokeWidth={3} />
                                  <span>Concluir</span>
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleRejectTask(task); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-600 rounded-xl text-[8px] font-black uppercase tracking-widest border border-red-50 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                  title="Reprovar Tarefa"
                                >
                                  <X size={12} strokeWidth={3} />
                                  <span>Reprovar</span>
                                </button>
                              </div>
                            ) : currentUser?.id === selectedMember.id ? (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleWorkerRevokeFinish(task); }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-xl border border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all group/revoke shadow-sm"
                                title="Desconcluir e Voltar a Trabalhar"
                              >
                                <CheckSquare size={14} className="group-hover/revoke:hidden" />
                                <X size={14} className="hidden group-hover/revoke:block" />
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-xl border border-green-200">
                                <CheckSquare size={14} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Aguardando Aprovação</span>
                              </div>
                            )}
                          </div>
                        )}
                        <span className="text-[9px] font-black text-stone-900 bg-stone-50 border border-stone-100 px-1.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
                          <Clock size={8} />
                          {formatTime(elapsedTimes[task.id] || task.timeSpent || 0)}
                        </span>
                        {currentUser?.role === 'admin' && task.price > 0 && (
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
                            <DollarSign size={8} />
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(task.price)}
                          </span>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleJumpToTask(task); }}
                          className="p-2 bg-stone-50 text-stone-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                          title="Ver no Painel"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>
                      {/* Decorative hint of the color at the edge */}
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 opacity-10"
                        style={{ backgroundColor: task.color }}
                      />
                    </div>
                  ))
                ) : (
                  <div className="w-full py-12 text-center bg-stone-50/50 rounded-3xl border-2 border-dashed border-stone-100">
                    <ListTodo size={32} className="mx-auto text-stone-200 mb-3" />
                    <p className="text-xs font-black uppercase tracking-widest text-stone-300">Nenhuma tarefa ativa atribuída</p>
                  </div>
                )}
              </div>
            </div>

            {/* Active Tags / Services */}
            <div className="bg-white rounded-[2rem] p-8 border-2 border-stone-50 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-stone-50 rounded-xl text-stone-400">
                    <Hash size={20} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-stone-900">Serviços Atribuídos</h3>
                </div>
                <button 
                  onClick={() => setIsEditingTags(!isEditingTags)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isEditingTags 
                      ? 'bg-stone-900 text-white' 
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {isEditingTags ? <X size={14} /> : <Plus size={14} />}
                  <span>{isEditingTags ? 'Fechar' : 'Gerenciar'}</span>
                </button>
              </div>

              {isEditingTags ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3 bg-stone-50 rounded-2xl px-4 py-3 border border-stone-100">
                    <Search size={16} className="text-stone-400" />
                    <input 
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="bg-transparent border-none text-sm font-bold text-stone-900 focus:outline-none w-full"
                      placeholder="Buscar por serviço ou categoria..."
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {allTags
                      .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                      .map(tag => {
                        const isSelected = selectedMember.serviceTags?.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => handleToggleTag(selectedMember.id, tag.id, selectedMember.serviceTags)}
                            className={`px-4 py-2 rounded-2xl text-xs font-black border transition-all flex items-center gap-2 ${
                              isSelected 
                                ? 'bg-stone-900 text-white border-stone-900 shadow-lg' 
                                : 'bg-white border-stone-100 text-stone-500 hover:border-stone-300 hover:bg-stone-50'
                            }`}
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(selectedMember.serviceTags || []).length > 0 ? (
                    selectedMember.serviceTags?.map(tagId => {
                      const tag = allTags.find(t => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <span 
                          key={tagId}
                          className="px-4 py-2 rounded-2xl text-xs font-black border flex items-center gap-2 shadow-sm"
                          style={{ 
                            backgroundColor: tag.color + '10', 
                            borderColor: tag.color + '20', 
                            color: tag.color 
                          }}
                        >
                          <Hash size={12} />
                          {tag.name}
                        </span>
                      );
                    })
                  ) : (
                    <div className="w-full py-8 text-center bg-stone-50 rounded-3xl border-2 border-dashed border-stone-100">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Nenhum serviço atribuído</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-8">
              <button 
                onClick={() => setIsHistoryOpen(true)}
                className="w-full bg-stone-900 text-white py-5 rounded-3xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20 active:scale-[0.98] flex items-center justify-center gap-3 border border-white/5"
              >
                <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                  <Clock size={16} className="text-blue-400" />
                </div>
                Visualizar Histórico Completo
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* History Modal Overlay */}
      {isHistoryOpen && selectedMember && (
        <Modal 
          isOpen={isHistoryOpen} 
          onClose={() => setIsHistoryOpen(false)} 
          title={`Histórico: ${selectedMember.name}`}
          maxWidth="max-w-5xl"
        >
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-stone-50 p-6 rounded-[2rem] border border-stone-100 shadow-sm">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-stone-100 overflow-hidden shadow-sm flex-shrink-0">
                  {selectedMember.photoURL ? (
                    <img src={selectedMember.photoURL} alt={selectedMember.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <User size={24} />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900 leading-tight">{selectedMember.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Terceirizado</span>
                    <div className="w-1 h-1 bg-stone-300 rounded-full" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{selectedMember.teamCategory || 'Membro'}</span>
                  </div>
                </div>
              </div>

              {/* Filtros de Data */}
              <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-stone-200 shadow-sm w-full md:w-auto overflow-x-auto">
                <div className="flex items-center gap-2 px-3 border-r border-stone-100">
                  <Calendar size={14} className="text-stone-400" />
                  <select 
                    value={historyMonth}
                    onChange={(e) => setHistoryMonth(parseInt(e.target.value))}
                    className="bg-transparent text-xs font-black uppercase tracking-widest text-stone-900 focus:outline-none cursor-pointer"
                  >
                    <option value={-1}>Mês</option>
                    {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pl-3">
                  <select 
                    value={historyYear}
                    onChange={(e) => setHistoryYear(parseInt(e.target.value))}
                    className="bg-transparent text-xs font-black uppercase tracking-widest text-stone-900 focus:outline-none cursor-pointer"
                  >
                    <option value={-1}>Ano</option>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-center md:text-right bg-stone-900 text-white px-10 py-5 rounded-[2rem] shadow-2xl shadow-stone-900/40 relative overflow-hidden group w-full md:w-auto min-w-[250px] border border-white/5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
                <div className="relative z-10 flex flex-col items-center md:items-end gap-2 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-black uppercase tracking-[0.15em] text-stone-400">Tempo Acumulado:</span>
                    <span className="font-black uppercase text-white tracking-[0.15em]">
                      {(() => {
                        const hist = getUserHistory(selectedMember.id).filter(t => {
                          const date = t.updatedAt instanceof Timestamp ? t.updatedAt.toDate() : new Date(t.updatedAt || 0);
                          const matchMonth = historyMonth === -1 || date.getMonth() === historyMonth;
                          const matchYear = historyYear === -1 || date.getFullYear() === historyYear;
                          return matchMonth && matchYear;
                        });
                        return formatTime(hist.reduce((acc, t) => acc + (t.timeSpent || 0), 0));
                      })()}
                    </span>
                  </div>
                  {currentUser?.role === 'admin' && (
                    <div className="flex items-center gap-3">
                      <span className="font-black uppercase tracking-[0.15em] text-stone-400">Soma Total das Tarefas:</span>
                      <span className="font-black uppercase text-white tracking-[0.15em]">
                        {(() => {
                          const hist = getUserHistory(selectedMember.id).filter(t => {
                            const date = t.updatedAt instanceof Timestamp ? t.updatedAt.toDate() : new Date(t.updatedAt || 0);
                            const matchMonth = historyMonth === -1 || date.getMonth() === historyMonth;
                            const matchYear = historyYear === -1 || date.getFullYear() === historyYear;
                            return matchMonth && matchYear;
                          });
                          const total = hist.reduce((acc, t) => acc + (t.price || 0), 0);
                          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
              {(() => {
                const hist = getUserHistory(selectedMember.id).filter(t => {
                  const date = t.updatedAt instanceof Timestamp ? t.updatedAt.toDate() : new Date(t.updatedAt || 0);
                  const matchMonth = historyMonth === -1 || date.getMonth() === historyMonth;
                  const matchYear = historyYear === -1 || date.getFullYear() === historyYear;
                  return matchMonth && matchYear;
                });

                return hist.length > 0 ? (
                  hist.map((task) => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between p-5 bg-white border border-stone-100 rounded-2xl hover:border-blue-200 transition-all shadow-sm group"
                    >
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleRevertTask(task)}
                          disabled={currentUser?.role !== 'admin'}
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                            currentUser?.role === 'admin' 
                              ? 'bg-blue-50 border-blue-100 text-blue-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-100' 
                              : 'bg-stone-50 border-stone-100 text-stone-300'
                          }`}
                          title={currentUser?.role === 'admin' ? "Reativar Tarefa" : "Apenas administradores podem reativar"}
                        >
                          <CheckSquare size={20} />
                        </button>
                        <div>
                          <div className="text-sm font-black text-stone-900 mb-1 leading-none">{task.title || (task as any).clientName || 'Card sem Título'}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 bg-stone-50 px-2 py-0.5 rounded border border-stone-100">
                              Sector {task.sector}
                            </span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                              Concluído
                            </span>
                            {currentUser?.role === 'admin' && task.price > 0 && (
                              <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                <DollarSign size={8} />
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(task.price)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 md:gap-12">
                        <div className="text-right hidden sm:block">
                          <div className="text-[8px] font-black uppercase tracking-widest text-stone-400 mb-0.5">Finalizado em</div>
                          <div className="text-xs font-bold text-stone-700">
                            {task.updatedAt instanceof Timestamp 
                              ? task.updatedAt.toDate().toLocaleDateString('pt-BR') 
                              : new Date(task.updatedAt || 0).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div className="text-right min-w-[100px] bg-stone-50 px-4 py-2 rounded-xl border border-stone-100">
                          <div className="text-[8px] font-black uppercase tracking-widest text-stone-400 mb-0.5">Tempo Gasto</div>
                          <div className="text-sm font-black text-stone-900">{formatTime(task.timeSpent || 0)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-24 text-center bg-stone-50 rounded-[2.5rem] border-2 border-dashed border-stone-200">
                    <Clock size={48} className="text-stone-200 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-stone-400">Nenhum registro para {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][historyMonth]} de {historyYear}</p>
                    <button 
                      onClick={() => { setHistoryMonth(new Date().getMonth()); setHistoryYear(new Date().getFullYear()); }}
                      className="mt-6 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Voltar para o Mês Atual
                    </button>
                  </div>
                );
              })()}
            </div>
            
            <div className="flex justify-end pt-4 border-t border-stone-100">
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="px-10 py-4 bg-stone-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20 active:scale-95"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
