import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';

export type Role = 'admin' | 'corretor' | 'parceiro' | 'cliente' | 'financeiro' | 'Sócio CFO' | 'CEO';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  photoUrl?: string;
  favorites?: string[]; // IDs dos imóveis favoritados
}

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (email: string, password?: string) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
  register: (user: Omit<User, 'id'>, password?: string) => Promise<User>;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  toggleFavorite: (propertyId: string) => void;
  resetPassword: (email: string) => Promise<void>;
  originalUser: User | null;
  impersonateUser: (userId: string) => void;
  stopImpersonating: () => void;
}

const defaultUsers: User[] = [
  { id: 'u0', name: 'Desenvolvedor H5', email: 'criativoh5@gmail.com', role: 'admin' },
  { id: 'u1', name: 'Ruth Dias', email: 'ruth.dias@gmail.com', role: 'admin' },
  { id: 'u2', name: 'Corretor João', email: 'joao@imob.com', role: 'corretor' },
  { id: 'u3', name: 'Parceiro Assessoria', email: 'parceiro@caixa.com', role: 'parceiro' },
  { id: 'u4', name: 'Cliente Maria', email: 'maria@email.com', role: 'cliente', favorites: [] },
];

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [originalUser, setOriginalUser] = useState<User | null>(null);

  const loadUsersFromDB = async () => {
    try {
      const res = await fetch('/api.php?key=ruth_dias_users');
      const text = await res.text();
      if (!text || text.trim().startsWith('<')) throw new Error('API não está rodando PHP');
      let parsed = JSON.parse(text);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);

      let loadedUsers = defaultUsers;
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        loadedUsers = parsed;
        if (!loadedUsers.find((u: User) => u.email === 'criativoh5@gmail.com')) {
          loadedUsers.push({ id: 'u0', name: 'H5 Criativo', email: 'criativoh5@gmail.com', role: 'Sócio CFO' });
        }
        if (!loadedUsers.find((u: User) => u.email === 'ruth.dias@gmail.com')) {
          loadedUsers.push({ id: 'u1', name: 'Ruth Dias', email: 'ruth.dias@gmail.com', role: 'CEO' });
        }
        // FORÇAR PAPEIS ESPECIAIS
        loadedUsers.forEach(u => {
          if (u.email === 'criativoh5@gmail.com') u.role = 'Sócio CFO';
          if (u.email === 'ruth.dias@gmail.com') u.role = 'CEO';
        });
        saveUsers(loadedUsers);
      }
      setUsers(loadedUsers);
      return loadedUsers;
    } catch (e) {
      const storedUsers = localStorage.getItem('ruth_dias_users');
      let loadedUsers: User[] = [];
      if (storedUsers) {
        loadedUsers = JSON.parse(storedUsers);
        if (!loadedUsers.find((u: User) => u.email === 'criativoh5@gmail.com')) {
          loadedUsers.push({ id: 'u0', name: 'H5 Criativo', email: 'criativoh5@gmail.com', role: 'Sócio CFO' });
        }
        if (!loadedUsers.find((u: User) => u.email === 'ruth.dias@gmail.com')) {
          loadedUsers.push({ id: 'u1', name: 'Ruth Dias', email: 'ruth.dias@gmail.com', role: 'CEO' });
        }
        // FORÇAR PAPEIS ESPECIAIS PARA O H5 E RUTH
        loadedUsers.forEach(u => {
          if (u.email === 'criativoh5@gmail.com') u.role = 'Sócio CFO';
          if (u.email === 'ruth.dias@gmail.com') u.role = 'CEO';
        });
        localStorage.setItem('ruth_dias_users', JSON.stringify(loadedUsers));
      } else {
        loadedUsers = defaultUsers;
        localStorage.setItem('ruth_dias_users', JSON.stringify(defaultUsers));
      }
      setUsers(loadedUsers);
      return loadedUsers;
    }
  };

  useEffect(() => {
    loadUsersFromDB();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        // Find user in DB
        const currentUsers = await loadUsersFromDB();
        let dbUser = currentUsers.find(u => u.email.toLowerCase() === firebaseUser.email!.toLowerCase());
        
        // If logged in with Google but not in DB, auto-register as client
        if (!dbUser) {
           const newUser: User = {
             id: firebaseUser.uid,
             name: firebaseUser.displayName || 'Novo Usuário',
             email: firebaseUser.email,
             role: 'cliente',
             favorites: []
           };
           const updatedUsers = [...currentUsers, newUser];
           saveUsers(updatedUsers);
           dbUser = newUser;
        }
        setUser(dbUser);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const saveUsers = (newUsers: User[]) => {
    setUsers(newUsers);
    fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ruth_dias_users', value: JSON.stringify(newUsers) })
    }).catch(() => {});
    localStorage.setItem('ruth_dias_users', JSON.stringify(newUsers));
  };

  const login = async (email: string, password?: string): Promise<User> => {
    if (!password) throw new Error("Senha obrigatória");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const dbUser = users.find(u => u.email.toLowerCase() === userCredential.user.email?.toLowerCase());
      if (dbUser) {
        setUser(dbUser);
        return dbUser;
      }
      throw new Error("Usuário autenticado, mas não encontrado no banco de dados local.");
    } catch (e: any) {
      throw new Error("Falha no login: " + e.message);
    }
  };

  const loginWithGoogle = async (): Promise<User> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email;
      let dbUser = users.find(u => u.email.toLowerCase() === email?.toLowerCase());
      
      if (!dbUser && email) {
        dbUser = {
           id: result.user.uid,
           name: result.user.displayName || 'Novo Cliente',
           email: email,
           role: 'cliente',
           favorites: []
        };
        saveUsers([...users, dbUser]);
      }
      
      if (dbUser) {
         setUser(dbUser);
         return dbUser;
      }
      throw new Error("Erro ao vincular conta do Google.");
    } catch (e: any) {
      throw new Error("Login com Google falhou: " + e.message);
    }
  };

  const logout = async (): Promise<void> => {
    await signOut(auth);
    setUser(null);
    setOriginalUser(null);
  };

  const impersonateUser = (userId: string) => {
    if (!user) return;
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      setOriginalUser(user);
      setUser(targetUser);
    }
  };

  const stopImpersonating = () => {
    if (originalUser) {
      setUser(originalUser);
      setOriginalUser(null);
    }
  };

  const register = async (newUser: Omit<User, 'id'>, password?: string): Promise<User> => {
    if (users.find(u => u.email.toLowerCase() === newUser.email.toLowerCase())) {
      throw new Error('Este e-mail já está em uso no banco de dados.');
    }
    if (!password) throw new Error("Senha obrigatória");
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, newUser.email, password);
      const userWithId = { ...newUser, id: userCredential.user.uid };
      const updatedUsers = [...users, userWithId];
      saveUsers(updatedUsers);
      setUser(userWithId);
      return userWithId;
    } catch (e: any) {
      throw new Error("Falha no cadastro: " + e.message);
    }
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    const updatedUsers = users.map(u => (u.id === id ? { ...u, ...updates } : u));
    saveUsers(updatedUsers);
    if (user?.id === id) {
      setUser({ ...user, ...updates });
    }
  };

  const deleteUser = (id: string) => {
    saveUsers(users.filter(u => u.id !== id));
  };

  const toggleFavorite = (propertyId: string) => {
    if (!user) return;
    const currentFavs = user.favorites || [];
    const isFav = currentFavs.includes(propertyId);
    const newFavs = isFav ? currentFavs.filter(id => id !== propertyId) : [...currentFavs, propertyId];
    updateUser(user.id, { favorites: newFavs });

    if (!isFav && user.role === 'cliente') {
      fetch('/api.php?key=ruth_dias_kanban')
        .then(res => res.text())
        .then(text => {
          if (!text || text.trim().startsWith('<')) throw new Error('API não rodando PHP');
          let parsed = JSON.parse(text);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          return parsed;
        })
        .catch(() => {
          const local = localStorage.getItem('kanbanData') || localStorage.getItem('ruth_dias_kanban');
          if (local) {
             let parsed = JSON.parse(local);
             if (typeof parsed === 'string') parsed = JSON.parse(parsed);
             return parsed;
          }
          return null;
        })
        .then(kanbanData => {
          if (kanbanData && kanbanData.clients && kanbanData.columns) {
            const newClientId = `kanban_${user.id}`;
            if (!kanbanData.clients[newClientId]) {
               kanbanData.clients[newClientId] = {
                 id: newClientId,
                 name: user.name,
                 email: user.email,
                 budget: 'A definir',
                 interest: `Interesse no imóvel ID: ${propertyId}`,
                 tag: 'Site',
                 isRegisteredUser: true,
                 documents: []
               };
               const firstColId = kanbanData.columnOrder[0];
               if (firstColId && kanbanData.columns[firstColId]) {
                 kanbanData.columns[firstColId].clientIds.push(newClientId);
               }
            } else {
               if (!kanbanData.clients[newClientId].interest.includes(propertyId)) {
                 kanbanData.clients[newClientId].interest += `, ${propertyId}`;
               }
            }
            fetch('/api.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: 'ruth_dias_kanban', value: JSON.stringify(kanbanData) })
            }).catch(() => {});
            localStorage.setItem('ruth_dias_kanban', JSON.stringify(kanbanData));
            localStorage.setItem('kanbanData', JSON.stringify(kanbanData));
          }
        })
        .catch(e => console.error("Erro ao integrar favoritos com Kanban", e));
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e: any) {
      throw new Error("Falha ao enviar e-mail de recuperação: " + e.message);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      users, 
      login, 
      loginWithGoogle, 
      logout, 
      register, 
      updateUser, 
      deleteUser, 
      toggleFavorite, 
      resetPassword,
      originalUser,
      impersonateUser,
      stopImpersonating
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
