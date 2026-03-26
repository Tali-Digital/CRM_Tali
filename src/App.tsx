/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Logo } from './components/Logo';
import { Sidebar } from './components/Sidebar';
import { UnifiedDashboardBoard } from './components/UnifiedDashboardBoard';
import { CommercialView } from './components/CommercialView';
import { FinancialView } from './components/FinancialView';
import { InternalTasksView } from './components/InternalTasksView';
import { OperationView } from './components/OperationView';
import { ClientsView } from './components/ClientsView';
import { UnifiedCardManagerView } from './components/UnifiedCardManagerView';
import { UserMenu } from './components/UserMenu';
import { UserProfileModal } from './components/UserProfileModal';
import { UserManagementModal } from './components/UserManagementModal';
import { NotificationCenter } from './components/NotificationCenter';
import { UnifiedSectorView } from './components/UnifiedSectorView';
import { Modal } from './components/Modal';
import { TeamView } from './components/TeamView';
import { HistoryProvider } from './context/HistoryContext';
import { CompanyType, SectorCardFilter, UserProfile, CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard, InternalTaskList, InternalTaskCard, Client, Tag } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Bell, User, Filter, LayoutGrid, List, LogIn, Briefcase, LogOut, Mail, Lock, Layers, AlignLeft, Calendar as CalendarIcon, Menu, X as CloseIcon, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { auth } from './firebase';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';

import logoLogin from './logo_login.png';
import { playSuccessSound, playDeleteSound, initAudio, setAudioMuted } from './utils/audio';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getAdditionalUserInfo
} from 'firebase/auth';
import { 
  saveUser, 
  subscribeToUsers, 
  subscribeToCommercialLists, 
  subscribeToCommercialCards, 
  subscribeToFinancialLists, 
  subscribeToFinancialCards, 
  subscribeToOperationLists,
  subscribeToOperationCards,
  subscribeToInternalTaskLists,
  subscribeToInternalTaskCards,
  subscribeToClients, 
  subscribeToTags,
  restoreCommercialCard,
  permanentDeleteCommercialCard,
  restoreFinancialCard,
  permanentDeleteFinancialCard,
  restoreOperationCard,
  permanentDeleteOperationCard,
  restoreInternalTaskCard,
  permanentDeleteInternalTaskCard,
  deleteCommercialCard,
  deleteFinancialCard,
  deleteOperationCard,
  deleteInternalTaskCard,
  updateCommercialCard,
  updateFinancialCard,
  updateOperationCard,
  updateInternalTaskCard,
  updateCommercialList,
  updateFinancialList,
  updateOperationList,
  updateInternalTaskList,
  addCommercialCard,
  addFinancialCard,
  addOperationCard,
  addInternalTaskCard,
  updateClient,
  deleteClient,
  createNotification,
  subscribeToSectors,
  subscribeToDynamicLists,
  subscribeToDynamicCards,
  addSector,
  updateSector,
  deleteSector,
  restoreSector,
  addDynamicCard,
  updateDynamicCard,
  deleteDynamicCard
} from './services/firestoreService';
import { MemberDashboard } from './components/MemberDashboard';

export function App() {
  const [jumpToCard, setJumpToCard] = useState<{ id: string, sector: string } | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const selectedCompanyId: CompanyType = 'digital';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'comercial' | 'integracao' | 'operacao' | 'clientes' | 'internal_tasks' | 'gestao' | 'equipe'>('dashboard');
  const [sectorViewMode, setSectorViewMode] = useState<'kanban' | 'list' | 'vertical' | 'calendar'>('kanban');
  const [sectorCardFilter, setSectorCardFilter] = useState<SectorCardFilter>('both');
  const [dashboardView, setDashboardView] = useState<'minhas' | 'global'>('minhas');
  
  // DRAG STATE (Hoisted)
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<any | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      (window as any).__lastPointerX = e.clientX;
      (window as any).__lastPointerY = e.clientY;
    };
    window.addEventListener('pointermove', handleGlobalPointerMove);
    return () => window.removeEventListener('pointermove', handleGlobalPointerMove);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    // Finder global card
    const allCards = [...commercialCards, ...financialCards, ...operationCards, ...internalTaskCards, ...Object.values(dynamicCards).flat()];
    const card = allCards.find(c => c.id === active.id);
    if (card) setActiveCard(card);
  };

  const [hoverTabTimer, setHoverTabTimer] = useState<NodeJS.Timeout | null>(null);

  const handleDragOver = (event: DragOverEvent) => {
    const x = (window as any).__lastPointerX;
    const y = (window as any).__lastPointerY;
    if (x === undefined || y === undefined) return;

    const elements = document.elementsFromPoint(x, y);
    const sidebarTab = elements.find(el => el.hasAttribute('data-sidebar-tab'));
    
    if (sidebarTab) {
      const targetTab = sidebarTab.getAttribute('data-sidebar-tab');
      if (targetTab && targetTab !== activeTab) {
        if (!hoverTabTimer) {
          const timer = setTimeout(() => {
            setActiveTab(targetTab as any);
            setHoverTabTimer(null);
          }, 800);
          setHoverTabTimer(timer);
        }
      } else {
        if (hoverTabTimer) {
          clearTimeout(hoverTabTimer);
          setHoverTabTimer(null);
        }
      }
    } else {
      if (hoverTabTimer) {
        clearTimeout(hoverTabTimer);
        setHoverTabTimer(null);
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (hoverTabTimer) {
      clearTimeout(hoverTabTimer);
      setHoverTabTimer(null);
    }
    
    const { active, over } = event;
    const finalActiveCard = activeCard || [...commercialCards, ...financialCards, ...operationCards, ...internalTaskCards, ...Object.values(dynamicCards).flat()].find(c => c.id === active.id);
    
    setActiveId(null);
    setActiveCard(null);

    // Cross-Tab Drop Support (Sidebar Drop)
    const x = (window as any).__lastPointerX;
    const y = (window as any).__lastPointerY;
    if (x !== undefined && y !== undefined && finalActiveCard) {
      const elements = document.elementsFromPoint(x, y);
      const sidebarTab = elements.find(el => el.hasAttribute('data-sidebar-tab'));
      if (sidebarTab) {
        let targetSector = sidebarTab.getAttribute('data-sidebar-tab');
        if (targetSector === 'tarefas') targetSector = 'internal_tasks';
        const sourceS = activeTab === 'internal_tasks' ? 'tarefas' : activeTab;
        if (targetSector && targetSector !== sourceS) {
          await moveCardBetweenSectors(finalActiveCard, activeTab, targetSector);
          return;
        }
      }
    }

    // Delegar para o handler interno do setor se for no Kanban
    if (!over) return;
    
    const activeIdVal = active.id as string;
    const overId = over.id as string;
    if (activeIdVal === overId) return;

    // Determine current lists and cards
    let currentLists: any[] = [];
    let currentCards: any[] = [];
    let updateCardFn: any = null;
    let updateListFn: any = null;

    if (activeTab === 'comercial') {
      currentLists = commercialLists;
      currentCards = commercialCards;
      updateCardFn = updateCommercialCard;
      updateListFn = updateCommercialList;
    } else if (activeTab === 'integracao') {
      currentLists = financialLists;
      currentCards = financialCards;
      updateCardFn = updateFinancialCard;
      updateListFn = updateFinancialList;
    } else if (activeTab === 'operacao') {
      currentLists = operationLists;
      currentCards = operationCards;
      updateCardFn = updateOperationCard;
      updateListFn = updateOperationList;
    } else if (activeTab === 'internal_tasks') {
      currentLists = internalTaskLists;
      currentCards = internalTaskCards;
      updateCardFn = updateInternalTaskCard;
      updateListFn = updateInternalTaskList;
    } else {
      const dynamicS = allSectors.find(s => s.id === activeTab);
      if (dynamicS) {
        currentLists = dynamicLists[dynamicS.id] || [];
        currentCards = dynamicCards[dynamicS.id] || [];
        updateCardFn = updateDynamicCard;
        // List sorting for dynamic sectors can be added later if needed
      }
    }

    // List sorting
    const isActiveList = active.data.current?.type === 'List';
    if (isActiveList && updateListFn) {
       const oldIndex = currentLists.findIndex(l => l.id === activeIdVal);
       const newIndex = currentLists.findIndex(l => l.id === overId);
       if (oldIndex !== -1 && newIndex !== -1) {
         const newLists = arrayMove(currentLists, oldIndex, newIndex);
         newLists.forEach((list, index) => {
           if (list.order !== index) updateListFn(list.id, { order: index });
         });
       }
       return;
    }

    // Card sorting
    const cardToMove = finalActiveCard;
    if (!cardToMove || !updateCardFn) return;

    const isOverList = currentLists.some(l => l.id === overId);
    const overListId = isOverList ? overId : currentCards.find(c => c.id === overId)?.listId;

    if (overListId && cardToMove.listId !== overListId) {
      const targetList = currentLists.find(l => l.id === overListId);
      let newChecklist = cardToMove.checklist || [];
      if (cardToMove.type === 'client' && targetList?.defaultChecklist) {
         newChecklist = [...newChecklist];
         targetList.defaultChecklist.forEach((itemText: string) => {
           if (!newChecklist.some((item: any) => item.text === itemText)) {
             newChecklist.push({ id: Math.random().toString(36).substring(7), text: itemText, completed: false });
           }
         });
      }
      await updateCardFn(cardToMove.id, { listId: overListId, checklist: cardToMove.type === 'client' ? [] : newChecklist, updatedAt: new Date() });
    }

    const cardsInTargetList = currentCards.filter(c => 
      (isOverList ? c.listId === overId : c.listId === overListId) && c.id !== activeIdVal
    ).sort((a,b) => (a.order || 0) - (b.order || 0));

    if (!isOverList) {
       const overIndex = cardsInTargetList.findIndex(c => c.id === overId);
       const newIndex = overIndex >= 0 ? overIndex : cardsInTargetList.length;
       cardsInTargetList.splice(newIndex, 0, cardToMove);
    } else {
       cardsInTargetList.push(cardToMove);
    }

    cardsInTargetList.forEach((c, index) => {
       if (c.order !== index) updateCardFn(c.id, { order: index });
    });
  };
  const [dashboardViewMode, setDashboardViewMode] = useState<'board' | 'calendar'>('board');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [commercialLists, setCommercialLists] = useState<CommercialList[]>([]);
  const [commercialCards, setCommercialCards] = useState<CommercialCard[]>([]);
  const [financialLists, setFinancialLists] = useState<FinancialList[]>([]);
  const [financialCards, setFinancialCards] = useState<FinancialCard[]>([]);
  const [operationLists, setOperationLists] = useState<OperationList[]>([]);
  const [operationCards, setOperationCards] = useState<OperationCard[]>([]);
  const [internalTaskLists, setInternalTaskLists] = useState<InternalTaskList[]>([]);
  const [internalTaskCards, setInternalTaskCards] = useState<InternalTaskCard[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [allSectors, setAllSectors] = useState<any[]>([]);
  const [dynamicLists, setDynamicLists] = useState<Record<string, any[]>>({});
  const [dynamicCards, setDynamicCards] = useState<Record<string, any[]>>({});

  const userProfile = users.find(u => u.id === user?.uid);

  // Dynamic Sectors management
  const [isAddSectorOpen, setIsAddSectorOpen] = useState(false);
  const [addSectorGroup, setAddSectorGroup] = useState<'cliente' | 'interno'>('cliente');
  const [newSectorName, setNewSectorName] = useState('');
  
  const [isEditSectorOpen, setIsEditSectorOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<any>(null);
  const [editSectorName, setEditSectorName] = useState('');

  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectorName.trim()) return;
    
    const id = await addSector({
      name: newSectorName,
      group: addSectorGroup,
      order: allSectors.length,
      companyId: selectedCompanyId
    });
    
    setNewSectorName('');
    setIsAddSectorOpen(false);
    if (id) setActiveTab(id as any);
  };

  const handleUpdateSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSectorName.trim() || !editingSector) return;
    
    const sectorData = { 
      name: editSectorName,
      visibility: editingSector.visibility || [] 
    };

    if (['comercial', 'integracao', 'operacao', 'internal_tasks'].includes(editingSector.id)) {
      // Check if it exists in allSectors (firestore)
      const exists = allSectors.find(s => s.id === editingSector.id);
      if (!exists) {
        // Create it with fixed ID
        const { doc, setDoc, collection, Timestamp } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        await setDoc(doc(db, 'sectors', editingSector.id), {
          ...sectorData,
          group: editingSector.group,
          order: -1, // Core sectors usually come first or handled by Sidebar
          companyId: selectedCompanyId,
          createdAt: Timestamp.now()
        });
      } else {
        await updateSector(editingSector.id, sectorData);
      }
    } else {
      await updateSector(editingSector.id, sectorData);
    }

    setIsEditSectorOpen(false);
    setEditingSector(null);
  };

  const handleDeleteSector = async () => {
    if (!editingSector) return;
    if (!window.confirm('Tem certeza que deseja excluir este setor? Ele será enviado para a lixeira.')) return;
    
    await deleteSector(editingSector.id);
    setIsEditSectorOpen(false);
    setEditingSector(null);
    setActiveTab('dashboard');
  };

  const handleRestoreSector = async (id: string) => {
    await restoreSector(id);
  };

  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await saveUser(user);
      }
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      const params = new URLSearchParams(window.location.search);
      const jumpToId = params.get('jumpTo');
      const sector = params.get('sector');
      if (jumpToId && sector) {
        setActiveTab(sector as any);
        setJumpToCard({ id: jumpToId, sector });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [loading, user]);

  useEffect(() => {
    if (user) {
      const unsubUsers = subscribeToUsers(setUsers);
      const unsubCommLists = subscribeToCommercialLists(selectedCompanyId, setCommercialLists);
      const unsubCommCards = subscribeToCommercialCards(selectedCompanyId, setCommercialCards);
      const unsubFinLists = subscribeToFinancialLists(selectedCompanyId, setFinancialLists);
      const unsubFinCards = subscribeToFinancialCards(selectedCompanyId, setFinancialCards);
      const unsubOperationLists = subscribeToOperationLists(selectedCompanyId, setOperationLists);
      const unsubOperationCards = subscribeToOperationCards(selectedCompanyId, setOperationCards);
      const unsubInternalLists = subscribeToInternalTaskLists(selectedCompanyId, setInternalTaskLists);
      const unsubInternalCards = subscribeToInternalTaskCards(selectedCompanyId, setInternalTaskCards);
      const unsubClients = subscribeToClients(selectedCompanyId, setClients);
      const unsubTags = subscribeToTags(selectedCompanyId, setTags);
      
      const unsubSectors = subscribeToSectors(selectedCompanyId, (sectors) => {
        setAllSectors(sectors);
      });
      
      return () => {
        unsubUsers();
        unsubCommLists();
        unsubCommCards();
        unsubFinLists();
        unsubFinCards();
        unsubOperationLists();
        unsubOperationCards();
        unsubInternalLists();
        unsubInternalCards();
        unsubClients();
        unsubTags();
        unsubSectors();
      };
    }
  }, [user, selectedCompanyId]);

  useEffect(() => {
    if (user && allSectors.length > 0) {
      const currentUnsubs: Record<string, () => void> = {};
      
      allSectors.forEach(sector => {
        const unsubL = subscribeToDynamicLists(sector.id, (lists) => {
          setDynamicLists(prev => ({ ...prev, [sector.id]: lists }));
        });
        const unsubC = subscribeToDynamicCards(sector.id, (cards) => {
          setDynamicCards(prev => ({ ...prev, [sector.id]: cards }));
        });
        currentUnsubs[`${sector.id}_lists`] = unsubL;
        currentUnsubs[`${sector.id}_cards`] = unsubC;
      });
      
      return () => {
        Object.values(currentUnsubs).forEach(unsub => unsub());
      };
    }
  }, [user, allSectors]);

  // Recurrence logic: Check every hour if any cards need to trigger a notification
  useEffect(() => {
    if (!user || loading) return;

    const checkRecurrence = async () => {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Only process at or after 6:00 AM
      if (currentHour < 6) return;
      
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayOfWeek = now.getDay(); // 0-6

      const allActiveCards = [
        ...commercialCards.filter(c => !c.deleted && !c.completed).map(c => ({...c, sector: 'comercial' as const, updateFn: updateCommercialCard})),
        ...financialCards.filter(c => !c.deleted && !c.completed).map(c => ({...c, sector: 'integracao' as const, updateFn: updateFinancialCard})),
        ...operationCards.filter(c => !c.deleted && !c.completed).map(c => ({...c, sector: 'operacao' as const, updateFn: updateOperationCard})),
        ...internalTaskCards.filter(c => !c.deleted && !c.completed).map(c => ({...c, sector: 'internal_tasks' as const, updateFn: updateInternalTaskCard}))
      ];

      for (const card of allActiveCards) {
        if (!card.recurrence?.enabled) continue;
        if (card.recurrence.lastTriggeredDate === todayStr) continue;

        let shouldTrigger = false;

        if (card.recurrence.period === 'daily') {
          shouldTrigger = true;
        } else if (card.recurrence.period === 'weekly') {
          if (card.recurrence.daysOfWeek?.includes(dayOfWeek)) {
            shouldTrigger = true;
          }
        } else if (card.recurrence.period === 'monthly' || card.recurrence.period === 'yearly') {
          // Simplification for now: trigger on the same day as created, or same day/month
          const createdDate = card.createdAt instanceof Timestamp ? card.createdAt.toDate() : new Date(card.createdAt);
          if (card.recurrence.period === 'monthly' && createdDate.getDate() === now.getDate()) {
            shouldTrigger = true;
          } else if (card.recurrence.period === 'yearly' && createdDate.getDate() === now.getDate() && createdDate.getMonth() === now.getMonth()) {
            shouldTrigger = true;
          }
        }

        if (shouldTrigger) {
          // Trigger notification for all assignees
          if (card.assignees && card.assignees.length > 0) {
            const cardTitle = card.title || card.clientName || 'Card sem título';
            
            for (const assigneeId of card.assignees) {
              await createNotification({
                userId: assigneeId,
                title: cardTitle,
                message: `Tarefa recorrente ${card.recurrence.period}.`,
                read: false,
                cardId: card.id,
                sector: card.sector,
                type: 'recurrence'
              });
            }

            // Update lastTriggeredDate to avoid double trigger
            await (card as any).updateFn(card.id, {
              recurrence: {
                ...card.recurrence,
                lastTriggeredDate: todayStr
              }
            });
          }
        }
      }
    };

    const interval = setInterval(checkRecurrence, 1000 * 60 * 60); // Check every hour
    checkRecurrence(); // Initial check

    return () => clearInterval(interval);
  }, [user, loading, commercialCards, financialCards, operationCards, internalTaskCards]);
  const handleTestNotification = async () => {
    if (!user) return;
    const firstCard = commercialCards[0] || financialCards[0] || operationCards[0] || internalTaskCards[0];
    await createNotification({
      userId: user.uid,
      title: '📢 Notificação de Teste',
      message: 'Este é um teste para visualizar o novo design e o link direto do card.',
      read: false,
      cardId: firstCard?.id,
      sector: firstCard ? (commercialCards.find(c => c.id === firstCard.id) ? 'comercial' : financialCards.find(c => c.id === firstCard.id) ? 'integracao' : 'operacao') : undefined,
      type: 'recurrence'
    });
  };

  const moveCardBetweenSectors = async (card: any, sourceSector: string, targetSector: string) => {
    if (!selectedCompanyId) return;

    // Determine target list (first list of the target sector)
    let targetListId = '';
    let targetLists: any[] = [];
    let addFn: any;
    let deleteFn: any;

    if (targetSector === 'comercial') {
      targetLists = commercialLists;
      addFn = addCommercialCard;
    } else if (targetSector === 'integracao') {
      targetLists = financialLists;
      addFn = addFinancialCard;
    } else if (targetSector === 'operacao') {
      targetLists = operationLists;
      addFn = addOperationCard;
    } else if (targetSector === 'internal_tasks') {
      targetLists = internalTaskLists;
      addFn = addInternalTaskCard;
    } else {
      // Setores dinâmicos
      const dynamicS = allSectors.find(s => s.id === targetSector);
      if (dynamicS) {
        targetLists = dynamicLists[dynamicS.id] || [];
        addFn = (data: any) => addDynamicCard({ ...data, sectorId: dynamicS.id });
      }
    }

    if (sourceSector === 'comercial') deleteFn = deleteCommercialCard;
    else if (sourceSector === 'integracao') deleteFn = deleteFinancialCard;
    else if (sourceSector === 'operacao') deleteFn = deleteOperationCard;
    else if (sourceSector === 'internal_tasks') deleteFn = deleteInternalTaskCard;
    else {
      // Deletar de setor dinâmico
      const dynamicS = allSectors.find(s => s.id === sourceSector);
      if (dynamicS) {
        deleteFn = deleteDynamicCard;
      }
    }

    if (targetLists.length === 0) {
      alert(`O setor de destino (${targetSector}) não possui listas criadas.`);
      return;
    }

    targetListId = targetLists[0].id;
    const targetList = targetLists[0];

    try {
      // Prepare checklist merge if it's a client
      let finalChecklist = [...(card.checklist || [])];
      const client = clients.find(c => c.id === card.clientId);
      if (client) {
        finalChecklist = [...(client.checklist || [])];
      }

      if (targetList.defaultChecklist) {
        targetList.defaultChecklist.forEach((itemText: string) => {
          if (!finalChecklist.some((item: any) => item.text === itemText)) {
            finalChecklist.push({
              id: Date.now().toString() + Math.random().toString(36).substring(7),
              text: itemText,
              completed: false
            });
          }
        });
      }

      // 1. Create in new sector
      const { id: oldCardId, ...cardWithoutId } = card;
      await addFn({
        ...cardWithoutId,
        listId: targetListId,
        checklist: card.type === 'client' ? [] : finalChecklist, // Clients use central checklist
        order: 0,
        updatedAt: new Date()
      });

      // 2. Update client checklist if applicable
      if (client) {
        await updateClient(client.id, { checklist: finalChecklist });
      }

      // 3. Delete from source sector
      await deleteFn(card.id);

      alert(`Card movido para o setor ${targetSector} com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao mover card entre setores.');
    }
  };

  const activeCommercialCards = commercialCards.filter(c => !c.deleted && !c.completed);
  const activeFinancialCards = financialCards.filter(c => !c.deleted && !c.completed);
  const activeOperationCards = operationCards.filter(c => !c.deleted && !c.completed);
  const activeInternalTaskCards = internalTaskCards.filter(c => !c.deleted && !c.completed);

  const totalActiveCards = activeCommercialCards.length + 
    activeFinancialCards.length + 
    activeOperationCards.length + 
    activeInternalTaskCards.length;

  const handleRestoreCard = async (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal') => {
    switch (type) {
      case 'commercial': await restoreCommercialCard(cardId); break;
      case 'financial': await restoreFinancialCard(cardId); break;
      case 'operation': await restoreOperationCard(cardId); break;
      case 'internal': await restoreInternalTaskCard(cardId); break;
    }
  };

  const handlePermanentDelete = async (cardId: string, type: 'commercial' | 'financial' | 'operation' | 'internal', skipConfirm: boolean = false) => {
    const allCards = [
      ...commercialCards.map(c => ({...c, metaType: 'commercial' as const})),
      ...financialCards.map(c => ({...c, metaType: 'financial' as const})),
      ...operationCards.map(c => ({...c, metaType: 'operation' as const})),
      ...internalTaskCards.map(c => ({...c, metaType: 'internal' as const}))
    ];
    const card = allCards.find(c => c.id === cardId);
    
    if (card?.deleted) {
      playDeleteSound();
      if (!skipConfirm && !window.confirm('Tem certeza que deseja excluir PERMANENTEMENTE? Esta ação não pode ser desfeita.')) return;
      switch (type) {
        case 'commercial': await permanentDeleteCommercialCard(cardId); break;
        case 'financial': await permanentDeleteFinancialCard(cardId); break;
        case 'operation': await permanentDeleteOperationCard(cardId); break;
        case 'internal': await permanentDeleteInternalTaskCard(cardId); break;
      }
    } else {
      playDeleteSound();
      if (!window.confirm('Deseja mover este card para a lixeira?')) return;
      switch (type) {
        case 'commercial': await deleteCommercialCard(cardId); break;
        case 'financial': await deleteFinancialCard(cardId); break;
        case 'operation': await deleteOperationCard(cardId); break;
        case 'internal': await deleteInternalTaskCard(cardId); break;
      }
    }
  };

  const handleGoogleLogin = async () => {
    setIsAuthLoading(true);
    setAuthError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const additionalInfo = getAdditionalUserInfo(result);
      
      const allowedEmails = ['tali.agenciadigital@gmail.com', 'diogotorres2907@gmail.com'];
      
      if (additionalInfo?.isNewUser && !allowedEmails.includes(result.user.email || '')) {
        await result.user.delete();
        await signOut(auth);
        setAuthError('Você não possui autorização. Por favor, solicite o acesso ao administrador.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError('Erro ao entrar com o Google.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Auth error", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError('Email ou senha incorretos.');
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este email já está em uso.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setAuthError('Erro ao autenticar. Verifique seus dados.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center font-nunito">
        <div className="animate-pulse text-stone-400">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6 font-nunito">
          <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-stone-200 text-center">
          <div className="mb-8 flex justify-center">
            <img src={logoLogin} alt="Talí Digital" className="h-20 w-auto" />
          </div>
          <p className="text-stone-500 mb-8">Faça login para gerenciar seus projetos.</p>
          
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6 text-left">
            {authError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center">
                {authError}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-900 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-800/20 placeholder:text-stone-400 group-hover:border-stone-800 transition-colors"
                  placeholder="seu@email.com"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-900 ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-3 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-800/20 placeholder:text-stone-400 group-hover:border-stone-800 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isAuthLoading}
              className="w-full bg-stone-900 text-white py-3.5 rounded-xl hover:bg-stone-800 transition-all font-bold disabled:opacity-50"
            >
              {isAuthLoading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>

          <div className="flex justify-between items-center mb-2 py-1 px-2">
            <div className="flex-grow border-t border-stone-200"></div>
            <span className="flex-shrink-0 mx-4 text-stone-400 text-xs uppercase tracking-widest font-bold">Ou</span>
            <div className="flex-grow border-t border-stone-200"></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            type="button"
            className="w-full flex items-center justify-center space-x-3 bg-white border border-stone-200 text-stone-700 py-3.5 rounded-xl hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all font-bold mb-4 group"
          >
            <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Entrar com Google</span>
          </button>


        </div>
      </div>
    );
  }

  const handleUpdateCard = async (cardId: string, sector: string, data: any) => {
    if (sector === 'comercial') await updateCommercialCard(cardId, data);
    else if (sector === 'integracao') await updateFinancialCard(cardId, data);
    else if (sector === 'operacao') await updateOperationCard(cardId, data);
    else if (sector === 'internal_tasks') await updateInternalTaskCard(cardId, data);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (userProfile?.role === 'equipe') {
          return (
            <MemberDashboard 
              userProfile={userProfile}
              commercialCards={commercialCards}
              financialCards={financialCards}
              operationCards={operationCards}
              internalTaskCards={internalTaskCards}
              tags={tags}
              clients={clients}
              users={users}
              onUpdateCard={handleUpdateCard}
            />
          );
        }
        const assignedCommercialLists = commercialLists.filter(l => l.assignees?.includes(user?.uid || ''));
        const assignedFinancialLists = financialLists.filter(l => l.assignees?.includes(user?.uid || ''));
        const assignedOperationLists = operationLists.filter(l => l.assignees?.includes(user?.uid || ''));
        const hasAssignedSectors = dashboardView === 'minhas' && (assignedCommercialLists.length > 0 || assignedFinancialLists.length > 0 || assignedOperationLists.length > 0);

        return (
            <div className="flex-1 overflow-y-auto custom-scrollbar h-full pr-2">
              <div className="flex flex-col gap-6">
              {hasAssignedSectors && (
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm shrink-0">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-4">Setores Atribuídos</h3>
                  <div className="flex flex-wrap gap-4">
                    {assignedCommercialLists.map(list => (
                      <button 
                        key={list.id} 
                        onClick={() => setActiveTab('comercial')}
                        className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[200px] text-left hover:bg-stone-100 transition-colors"
                      >
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Comercial</span>
                        <span className="text-sm font-bold text-stone-900">{list.name}</span>
                      </button>
                    ))}
                    {assignedFinancialLists.map(list => (
                      <button 
                        key={list.id} 
                        onClick={() => setActiveTab('integracao')}
                        className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[200px] text-left hover:bg-stone-100 transition-colors"
                      >
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Integração</span>
                        <span className="text-sm font-bold text-stone-900">{list.name}</span>
                      </button>
                    ))}
                    {assignedOperationLists.map(list => (
                      <button 
                        key={list.id} 
                        onClick={() => setActiveTab('operacao')}
                        className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[200px] text-left hover:bg-stone-100 transition-colors"
                      >
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Operação</span>
                        <span className="text-sm font-bold text-stone-900">{list.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0">
                <UnifiedDashboardBoard 
                  commercialLists={commercialLists}
                  commercialCards={commercialCards.filter(c => !c.deleted && !c.completed)}
                  financialLists={financialLists}
                  financialCards={financialCards.filter(c => !c.deleted && !c.completed)}
                  operationLists={operationLists}
                  operationCards={operationCards.filter(c => !c.deleted && !c.completed)}
                  internalTaskLists={internalTaskLists}
                  internalTaskCards={internalTaskCards.filter(c => !c.deleted && !c.completed)}
                  clients={clients}
                  tags={tags}
                  users={users}
                  dashboardView={dashboardView}
                  currentUserUid={user?.uid || ''}
                  onNavigate={setActiveTab}
                  onUpdateCommercialCard={updateCommercialCard}
                  onUpdateFinancialCard={updateFinancialCard}
                  onUpdateOperationCard={updateOperationCard}
                  onUpdateInternalTaskCard={updateInternalTaskCard}
                  setDashboardView={setDashboardView}
                  userRole={userProfile?.role || 'user'}
                  viewMode={dashboardViewMode}
                  setViewMode={setDashboardViewMode}
                  onJumpToCard={(cardId, sector, mode = 'view') => {
                    setActiveTab(sector as any);
                    setJumpToCard({ id: cardId, sector, mode });
                  }}
                  allSectors={allSectors}
                  onMoveToSector={moveCardBetweenSectors}
                />
              </div>
            </div>
          </div>
        );
      case 'clientes':
        if (userProfile?.role === 'equipe') return null;
        return (
          <ClientsView 
            key={`clients-${commercialCards.length}-${financialCards.length}-${operationCards.length}`}
            companyId={selectedCompanyId} 
            clients={clients} 
            tags={tags} 
            commercialLists={commercialLists}
            commercialCards={commercialCards}
            financialLists={financialLists}
            financialCards={financialCards}
            operationLists={operationLists}
            operationCards={operationCards}
            internalTaskLists={internalTaskLists}
            internalTaskCards={internalTaskCards}
            users={users}
            jumpToCard={jumpToCard}
            onClearJump={() => setJumpToCard(null)}
            onJumpToCard={(cardId, sector, mode = 'view') => {
              setActiveTab(sector as any);
              setJumpToCard({ id: cardId, sector, mode });
            }}
          />
        );
      case 'comercial':
        return (
          <CommercialView 
            viewMode={sectorViewMode} 
            cardFilter={sectorCardFilter} 
            companyId={selectedCompanyId} 
            lists={commercialLists} 
            cards={commercialCards.filter(c => !c.deleted && !c.completed)} 
            clients={clients} 
            tags={tags} 
            users={users} 
            onMoveToSector={(card, target) => moveCardBetweenSectors(card, 'comercial', target)} 
            allCommercialCards={commercialCards}
            allFinancialCards={financialCards}
            allOperationCards={operationCards}
            allInternalTaskCards={internalTaskCards}
            jumpToCard={jumpToCard}
            onClearJump={() => setJumpToCard(null)}
            onJumpToCard={(cardId, sector, mode = 'view') => {
              setActiveTab(sector as any);
              setJumpToCard({ id: cardId, sector, mode });
            }}
            allSectors={allSectors}
            activeId={activeId}
            activeCard={activeCard}
          />
        );
      case 'integracao':
        return (
          <FinancialView 
            viewMode={sectorViewMode} 
            cardFilter={sectorCardFilter} 
            companyId={selectedCompanyId} 
            lists={financialLists} 
            cards={financialCards.filter(c => !c.deleted && !c.completed)} 
            clients={clients} 
            tags={tags} 
            users={users} 
            onMoveToSector={(card, target) => moveCardBetweenSectors(card, 'integracao', target)} 
            allCommercialCards={commercialCards}
            allFinancialCards={financialCards}
            allOperationCards={operationCards}
            allInternalTaskCards={internalTaskCards}
            jumpToCard={jumpToCard}
            onClearJump={() => setJumpToCard(null)}
            onJumpToCard={(cardId, sector, mode = 'view') => {
              setActiveTab(sector as any);
              setJumpToCard({ id: cardId, sector, mode });
            }}
            allSectors={allSectors}
            activeId={activeId}
            activeCard={activeCard}
          />
        );
      case 'operacao':
        return (
          <OperationView 
            viewMode={sectorViewMode} 
            cardFilter={sectorCardFilter} 
            companyId={selectedCompanyId} 
            lists={operationLists} 
            cards={operationCards.filter(c => !c.deleted && !c.completed)} 
            clients={clients} 
            tags={tags} 
            users={users} 
            onMoveToSector={(card, target) => moveCardBetweenSectors(card, 'operacao', target)} 
            allCommercialCards={commercialCards}
            allFinancialCards={financialCards}
            allOperationCards={operationCards}
            allInternalTaskCards={internalTaskCards}
            jumpToCard={jumpToCard}
            onClearJump={() => setJumpToCard(null)}
            onJumpToCard={(cardId, sector, mode = 'view') => {
              setActiveTab(sector as any);
              setJumpToCard({ id: cardId, sector, mode });
            }}
            allSectors={allSectors}
            activeId={activeId}
            activeCard={activeCard}
          />
        );
      case 'internal_tasks':
        return (
          <InternalTasksView 
            viewMode={sectorViewMode} 
            cardFilter={sectorCardFilter} 
            companyId={selectedCompanyId} 
            lists={internalTaskLists} 
            cards={internalTaskCards.filter(c => !c.deleted && !c.completed)} 
            clients={clients} 
            tags={tags} 
            users={users} 
            onMoveToSector={(card, target) => moveCardBetweenSectors(card, 'internal_tasks', target)} 
            allCommercialCards={commercialCards}
            allFinancialCards={financialCards}
            allOperationCards={operationCards}
            allInternalTaskCards={internalTaskCards}
            jumpToCard={jumpToCard}
            onClearJump={() => setJumpToCard(null)}
            onJumpToCard={(cardId, sector, mode = 'view') => {
              setActiveTab(sector as any);
              setJumpToCard({ id: cardId, sector, mode });
            }}
            allSectors={allSectors}
            activeId={activeId}
            activeCard={activeCard}
          />
        );
      case 'gestao':
        return (
          <UnifiedCardManagerView 
            commercialCards={commercialCards}
            financialCards={financialCards}
            operationCards={operationCards}
            internalTaskCards={internalTaskCards}
            dynamicCards={dynamicCards}
            clients={clients}
            users={users}
            tags={tags}
            onRestoreCard={handleRestoreCard}
            onPermanentDelete={handlePermanentDelete}
            sectors={allSectors}
            onRestoreSector={handleRestoreSector}
          />
        );
      case 'equipe':
        return (
          <TeamView 
            users={users} 
            allTags={tags} 
            allCommercialCards={commercialCards}
            allFinancialCards={financialCards}
            allOperationCards={operationCards}
            allInternalTaskCards={internalTaskCards}
            internalTaskLists={internalTaskLists}
            selectedCompanyId={selectedCompanyId}
            currentUser={userProfile}
            onJumpToCard={(cardId, sector, mode = 'view') => {
              setActiveTab(sector as any);
              setJumpToCard({ id: cardId, sector, mode });
            }}
          />
        );
      default:
        const dynamicSector = allSectors.find(s => s.id === activeTab);
        if (dynamicSector) {
           return (
            <UnifiedSectorView 
              sector={dynamicSector.id as any}
              viewMode={sectorViewMode} 
              cardFilter={sectorCardFilter} 
              companyId={selectedCompanyId} 
              lists={dynamicLists[dynamicSector.id] || []} 
              cards={(dynamicCards[dynamicSector.id] || []).filter(c => !c.deleted && !c.completed)} 
              clients={clients} 
              tags={tags} 
              users={users} 
              onJumpToCard={(cardId, sector) => {
                setActiveTab(sector as any);
                setJumpToCard({ id: cardId, sector });
              }}
              allSectors={allSectors}
              onMoveToSector={(card, target) => moveCardBetweenSectors(card, activeTab, target)}
              allCommercialCards={commercialCards}
              allFinancialCards={financialCards}
              allOperationCards={operationCards}
              allInternalTaskCards={internalTaskCards}
              jumpToCard={jumpToCard}
              onClearJump={() => setJumpToCard(null)}
              userRole={userProfile?.role}
              activeId={activeId}
              activeCard={activeCard}
            />
          );
        }
        return null;
    }
  };

  const activeCardsCount = commercialCards.filter(c => !c.deleted && !c.completed).length +
    financialCards.filter(c => !c.deleted && !c.completed).length +
    operationCards.filter(c => !c.deleted && !c.completed).length +
    internalTaskCards.filter(c => !c.deleted && !c.completed).length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <>
        <div className="min-h-screen bg-stone-50 flex">
        <Sidebar 
          onLogout={handleLogout} 
          activeTab={activeTab}
          onTabChange={(tab: any) => {
            setActiveTab(tab);
            setIsMobileMenuOpen(false);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          userRole={userProfile?.role}
          sectors={allSectors.filter(s => !s.deleted)}
          onAddSector={(group) => {
            setAddSectorGroup(group);
            setIsAddSectorOpen(true);
          }}
          onEditSector={(sector) => {
            setEditingSector(sector);
            setEditSectorName(sector.name);
            setIsEditSectorOpen(true);
          }}
          currentUserId={user?.uid}
        />
        
        <main className={`flex-1 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} transition-all duration-300 font-nunito flex flex-col bg-stone-50 h-screen overflow-hidden`}>
          <header className="flex items-center justify-between px-4 md:px-6 py-2 shrink-0 bg-white border-b border-stone-100 relative z-20">
            <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 mr-4">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 rounded-xl text-stone-600 hover:bg-stone-100 md:hidden"
              >
                <Menu size={24} />
              </button>
              <div className="shrink-0 flex flex-col pt-1">
                <h1 className="text-base md:text-lg font-black text-stone-900 tracking-tight leading-none">
                  Talí<span className="hidden sm:inline"> Agência Digital</span>
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.4)]" />
                  <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest leading-none">
                    Olá, {userProfile?.name?.toUpperCase() || 'USUÁRIO'}
                  </span>
                </div>
              </div>
              
              {/* Filtros de Dashboard */}
              {activeTab === 'dashboard' && (
                <div className="hidden md:flex items-center gap-4 ml-4">
                  <div className="h-8 w-px bg-stone-100" />
                  
                  {/* Dashboard View Mode Toggle */}
                  <div className="flex bg-stone-50 p-1 rounded-2xl border border-stone-200/40 shadow-inner">
                    <button 
                      onClick={() => setDashboardView('minhas')}
                      className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dashboardView === 'minhas' ? 'bg-white shadow-md text-stone-900 border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      Meus Cards
                    </button>
                    <button 
                      onClick={() => setDashboardView('global')}
                      className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dashboardView === 'global' ? 'bg-white shadow-md text-stone-900 border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      Visão Global
                    </button>
                  </div>

                  {/* Dashboard Layout Toggle */}
                  <div className="flex bg-stone-50 p-1 rounded-2xl border border-stone-200/40 shadow-inner">
                    <button 
                      onClick={() => setSectorViewMode('kanban')}
                      className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${sectorViewMode === 'kanban' ? 'bg-white shadow-md text-stone-900 border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      <LayoutGrid size={14} />
                      Blocos
                    </button>
                    <button 
                      onClick={() => setSectorViewMode('calendar')}
                      className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${sectorViewMode === 'calendar' ? 'bg-white shadow-md text-stone-900 border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      <CalendarIcon size={14} />
                      Calendário
                    </button>
                  </div>
                </div>
              )}

              {/* Filtros de Visualização de Setor */}
              {activeTab !== 'dashboard' && activeTab !== 'clientes' && activeTab !== 'gestao' && activeTab !== 'equipe' && (
                <div className="hidden lg:flex items-center gap-4 ml-4">
                  <div className="h-8 w-px bg-stone-100" />
                  
                  {/* View Mode Toggle */}
                  <div className="flex bg-stone-50 p-1 rounded-2xl border border-stone-200/40 shadow-inner">
                    <button 
                      onClick={() => setSectorViewMode('kanban')}
                      className={`p-2 rounded-xl transition-all ${sectorViewMode === 'kanban' ? 'bg-white shadow-md text-stone-900' : 'text-stone-300 hover:text-stone-500'}`}
                      title="Kanban"
                    >
                      <LayoutGrid size={18} />
                    </button>
                    <button 
                      onClick={() => setSectorViewMode('vertical')}
                      className={`p-2 rounded-xl transition-all ${sectorViewMode === 'vertical' ? 'bg-white shadow-md text-stone-900' : 'text-stone-300 hover:text-stone-500'}`}
                      title="Vertical"
                    >
                      <Layers size={18} />
                    </button>
                    <button 
                      onClick={() => setSectorViewMode('list')}
                      className={`p-2 rounded-xl transition-all ${sectorViewMode === 'list' ? 'bg-white shadow-md text-stone-900' : 'text-stone-300 hover:text-stone-500'}`}
                      title="Lista"
                    >
                      <AlignLeft size={18} />
                    </button>
                    <button 
                      onClick={() => setSectorViewMode('calendar')}
                      className={`p-2 rounded-xl transition-all ${sectorViewMode === 'calendar' ? 'bg-white shadow-md text-stone-900' : 'text-stone-300 hover:text-stone-500'}`}
                      title="Calendário"
                    >
                      <CalendarIcon size={18} />
                    </button>
                  </div>

                  {/* Card Filter Toggle */}
                  <div className="flex bg-stone-50 p-1 rounded-2xl border border-stone-200/40 shadow-inner">
                    <button 
                      onClick={() => setSectorCardFilter('activities')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sectorCardFilter === 'activities' ? 'bg-white shadow-md text-stone-900 border border-stone-100/50' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      Atividades
                    </button>
                    <button 
                      onClick={() => setSectorCardFilter('clients')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sectorCardFilter === 'clients' ? 'bg-white shadow-md text-stone-900 border border-stone-100/50' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      Clientes
                    </button>
                    <button 
                      onClick={() => setSectorCardFilter('both')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sectorCardFilter === 'both' ? 'bg-white shadow-md text-stone-900 border border-stone-100/50' : 'text-stone-400 hover:text-stone-600'}`}
                    >
                      Duo
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <button
                onClick={() => {
                  const newState = !isAudioEnabled;
                  setIsAudioEnabled(newState);
                  setAudioMuted(!newState);
                  if (newState) initAudio();
                }}
                className={`hidden md:flex items-center gap-2.5 px-4 py-2.5 rounded-2xl transition-all border font-nunito ${isAudioEnabled ? 'bg-green-50/50 text-green-600 border-green-200/50 hover:bg-green-50 shadow-sm' : 'bg-stone-50 text-stone-400 border-stone-200/60 hover:bg-stone-100'}`}
                title={isAudioEnabled ? "Mutar sons" : "Ativar sons"}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isAudioEnabled ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-stone-300'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isAudioEnabled ? 'Sons Ativos' : 'Sons Mudos'}
                </span>
              </button>
              
              <button 
                onClick={() => {
                  const newState = !isAudioEnabled;
                  setIsAudioEnabled(newState);
                  setAudioMuted(!newState);
                  if (newState) initAudio();
                }}
                className={`p-2.5 rounded-2xl md:hidden bg-stone-50 text-stone-600 border border-stone-100 ${isAudioEnabled ? 'bg-green-50 text-green-600 border-green-200' : ''}`}
              >
                {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <NotificationCenter 
                userId={user.uid} 
                onJumpToCard={(cardId, sector, mode = 'view') => {
                  setActiveTab(sector as any);
                  setJumpToCard({ id: cardId, sector, mode });
                }}
                onTestNotification={handleTestNotification}
              />
              <div className="w-px h-6 bg-stone-200 mx-1 md:mx-2 hidden md:block"></div>
              <UserMenu 
                user={user}
                userProfile={userProfile} 
                onOpenProfile={() => setIsProfileOpen(true)}
                onOpenManagement={() => setIsManagementOpen(true)}
                onOpenCardManager={() => setActiveTab('gestao')}
                deferredPrompt={deferredPrompt}
              />
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative">
            {renderContent()}
          </div>
        </main>
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: { active: { opacity: '0.5' } },
        }),
      }}>
        {activeId ? (
          <div className="w-[380px] scale-105 pointer-events-none opacity-80">
            <div className="bg-white p-4 rounded-3xl shadow-2xl border border-stone-200">
              <p className="text-sm font-black text-stone-900 uppercase tracking-widest truncate">
                {activeCard?.title || activeCard?.clientName || 'Arrastando Card...'}
              </p>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Modais fixos da App */}
      {userProfile?.role === 'admin' && (
        <UserManagementModal 
          isOpen={isManagementOpen} 
          onClose={() => setIsManagementOpen(false)} 
        />
      )}

      <UserProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        user={user}
        userProfile={userProfile}
      />

      <Modal isOpen={isAddSectorOpen} onClose={() => setIsAddSectorOpen(false)} title={`Nova View (${addSectorGroup})`} maxWidth="max-w-md">
        <form onSubmit={handleAddSector} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Nome da View</label>
            <input 
              autoFocus
              type="text"
              value={newSectorName}
              onChange={(e) => setNewSectorName(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all font-medium text-stone-900"
              placeholder="Ex: Mídia Paga, Social Media..."
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
          >
            Criar View
          </button>
        </form>
      </Modal>

      <Modal isOpen={isEditSectorOpen} onClose={() => setIsEditSectorOpen(false)} title="Gerenciar Setor" maxWidth="max-w-md">
        <div className="space-y-6">
          <form onSubmit={handleUpdateSector} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-stone-900 uppercase tracking-widest mb-1.5 text-stone-400">Nome do Setor</label>
              <input
                type="text"
                value={editSectorName}
                onChange={(e) => setEditSectorName(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all font-medium text-stone-900"
                placeholder="Nome do setor"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-stone-900 uppercase tracking-widest text-stone-400">Visibilidade por Usuário</label>
              <p className="text-[10px] text-stone-500 mb-2">Se nenhum for selecionado, todos verão a aba. Se selecionar algum, apenas os selecionados verão.</p>
              <div className="max-h-48 overflow-y-auto custom-scrollbar border border-stone-100 rounded-xl p-2 space-y-1">
                {users.sort((a,b) => a.name.localeCompare(b.name)).map(u => (
                  <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg cursor-pointer transition-colors">
                    <input 
                      type="checkbox"
                      checked={editingSector?.visibility?.includes(u.id) || false}
                      onChange={(e) => {
                        const current = editingSector?.visibility || [];
                        const next = e.target.checked 
                          ? [...current, u.id]
                          : current.filter((id: string) => id !== u.id);
                        setEditingSector({ ...editingSector, visibility: next });
                      }}
                      className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                    />
                    <div className="flex items-center gap-2">
                      {u.photoURL && <img src={u.photoURL} alt="" className="w-5 h-5 rounded-full object-cover" />}
                      <span className="text-xs font-bold text-stone-700">{u.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
            >
              Salvar Alterações
            </button>
          </form>

          {!['comercial', 'integracao', 'operacao', 'internal_tasks'].includes(editingSector?.id) && (
            <div className="pt-6 border-t border-stone-100">
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-3">Zona de Perigo</p>
              <button
                onClick={handleDeleteSector}
                className="w-full bg-rose-50 text-rose-600 rounded-2xl py-4 text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-colors border border-rose-100"
              >
                Excluir Setor
              </button>
            </div>
          )}
        </div>
      </Modal>
    </>
    </DndContext>
  );
}

export default function AppWithHistory() {
  return (
    <HistoryProvider>
      <App />
    </HistoryProvider>
  );
}
