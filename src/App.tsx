/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { UnifiedDashboardBoard } from './components/UnifiedDashboardBoard';
import { CommercialView } from './components/CommercialView';
import { FinancialView } from './components/FinancialView';
import { OperationView } from './components/OperationView';
import { ClientsView } from './components/ClientsView';
import { UserMenu } from './components/UserMenu';
import { NotificationCenter } from './components/NotificationCenter';
import { CompanyType, UserProfile, CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard, Client, Tag } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Bell, User, Filter, LayoutGrid, List, LogIn, Briefcase, LogOut, Mail, Lock } from 'lucide-react';
import { auth } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
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
  subscribeToClients, 
  subscribeToTags 
} from './services/firestoreService';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const selectedCompanyId: CompanyType = 'digital';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'comercial' | 'integracao' | 'operacao' | 'clientes'>('dashboard');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [dashboardView, setDashboardView] = useState<'minhas' | 'global'>('minhas');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [commercialLists, setCommercialLists] = useState<CommercialList[]>([]);
  const [commercialCards, setCommercialCards] = useState<CommercialCard[]>([]);
  const [financialLists, setFinancialLists] = useState<FinancialList[]>([]);
  const [financialCards, setFinancialCards] = useState<FinancialCard[]>([]);
  const [operationLists, setOperationLists] = useState<OperationList[]>([]);
  const [operationCards, setOperationCards] = useState<OperationCard[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const userProfile = users.find(u => u.id === user?.uid);

  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Modal states
  
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
    if (user) {
      const unsubUsers = subscribeToUsers(setUsers);
      const unsubCommLists = subscribeToCommercialLists(selectedCompanyId, setCommercialLists);
      const unsubCommCards = subscribeToCommercialCards(selectedCompanyId, setCommercialCards);
      const unsubFinLists = subscribeToFinancialLists(selectedCompanyId, setFinancialLists);
      const unsubFinCards = subscribeToFinancialCards(selectedCompanyId, setFinancialCards);
      const unsubOpLists = subscribeToOperationLists(selectedCompanyId, setOperationLists);
      const unsubOpCards = subscribeToOperationCards(selectedCompanyId, setOperationCards);
      const unsubClients = subscribeToClients(selectedCompanyId, setClients);
      const unsubTags = subscribeToTags(selectedCompanyId, setTags);
      return () => {
        unsubUsers();
        unsubCommLists();
        unsubCommCards();
        unsubFinLists();
        unsubFinCards();
        unsubOpLists();
        unsubOpCards();
        unsubClients();
        unsubTags();
      };
    }
  }, [user]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
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
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-stone-200 text-center">
          <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Briefcase size={32} className="text-stone-800" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">CRM Talí</h1>
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

          <div className="relative flex items-center py-2 mb-6">
            <div className="flex-grow border-t border-stone-200"></div>
            <span className="flex-shrink-0 mx-4 text-stone-400 text-xs uppercase tracking-widest font-bold">Ou</span>
            <div className="flex-grow border-t border-stone-200"></div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            type="button"
            className="w-full flex items-center justify-center space-x-3 bg-white border border-stone-200 text-stone-700 py-3.5 rounded-xl hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all font-bold mb-6 group"
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

  const selectedCompanyName = 'Tali Digital';

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        const assignedCommercialLists = commercialLists.filter(l => l.assignees?.includes(user?.uid || ''));
        const assignedFinancialLists = financialLists.filter(l => l.assignees?.includes(user?.uid || ''));
        const assignedOperationLists = operationLists.filter(l => l.assignees?.includes(user?.uid || ''));
        const hasAssignedSectors = dashboardView === 'minhas' && (assignedCommercialLists.length > 0 || assignedFinancialLists.length > 0 || assignedOperationLists.length > 0);

        const totalCards = commercialCards.length + financialCards.length + operationCards.length;

        return (
          <div className="h-full flex flex-col">
            <section className="mb-8 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {userProfile?.role === 'admin' && (
                  <div className="flex bg-stone-200 p-1 rounded-lg">
                    <button 
                      onClick={() => setDashboardView('minhas')}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${dashboardView === 'minhas' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      Meus Cards
                    </button>
                    <button 
                      onClick={() => setDashboardView('global')}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${dashboardView === 'global' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
                    >
                      Visão Global
                    </button>
                  </div>
                )}
                <button className="flex items-center space-x-2 bg-white border border-stone-200 px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
                  <Filter size={16} />
                  <span>Filtrar</span>
                </button>
                <div className="h-6 w-px bg-stone-200"></div>
                <div className="flex bg-stone-200 p-1 rounded-lg">
                  <button 
                    onClick={() => setViewMode('kanban')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Cards:</span>
                <span className="text-sm font-bold text-stone-900">{totalCards}</span>
              </div>
            </section>

            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col gap-6"
              >
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

                {viewMode === 'kanban' ? (
                  <div className="flex-1 min-h-0">
                    <UnifiedDashboardBoard 
                      commercialLists={commercialLists}
                      commercialCards={commercialCards}
                      financialLists={financialLists}
                      financialCards={financialCards}
                      operationLists={operationLists}
                      operationCards={operationCards}
                      clients={clients}
                      tags={tags}
                      users={users}
                      dashboardView={dashboardView}
                      currentUserUid={user.uid}
                    />
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400 flex-1">
                    <p>Visualização em lista em desenvolvimento...</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        );
      case 'clientes':
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
          />
        );
      case 'comercial':
        return <CommercialView companyId={selectedCompanyId} lists={commercialLists} cards={commercialCards} clients={clients} tags={tags} users={users} />;
      case 'integracao':
        return <FinancialView companyId={selectedCompanyId} lists={financialLists} cards={financialCards} clients={clients} tags={tags} users={users} />;
      case 'operacao':
        return <OperationView companyId={selectedCompanyId} lists={operationLists} cards={operationCards} clients={clients} tags={tags} users={users} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex">
      <Sidebar 
        onLogout={handleLogout} 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <main className="flex-1 ml-64 p-8 font-nunito h-screen flex flex-col">
        <header className="flex items-center justify-between mb-10 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">{selectedCompanyName}</h1>
            <p className="text-stone-500 text-sm mt-1">Bem-vindo de volta, {user.displayName?.split(' ')[0] || 'Usuário'}.</p>
          </div>

          <div className="flex items-center space-x-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="bg-white border border-stone-200 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 w-64 transition-all"
              />
            </div>
            <NotificationCenter userId={user.uid} />
            <UserMenu user={user} userProfile={userProfile} />
          </div>
        </header>

        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>

      </main>
    </div>
  );
}

