import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  getDocs,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';

import { CompanyType, UserProfile, CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard, InternalTaskList, InternalTaskCard, Client, Tag, Notification } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function sanitizeData(data: any): any {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // Se for Date ou Timestamp, retornar como está (o SDK do Firebase cuidará da conversão)
  if (data instanceof Date || (data && typeof data.toDate === 'function')) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const result: any = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value !== undefined) {
      result[key] = sanitizeData(value);
    }
  });
  return result;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const subscribeToTags = (companyId: CompanyType, callback: (tags: Tag[]) => void) => {
  const q = query(collection(db, 'tags'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const tags = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
    callback(tags);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'tags');
  });
};

export const addTag = async (tag: Omit<Tag, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'tags'), tag);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'tags');
  }
};

export const updateTag = async (tagId: string, data: Partial<Tag>) => {
  try {
    const tagRef = doc(db, 'tags', tagId);
    await updateDoc(tagRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tags/${tagId}`);
  }
};

export const deleteTag = async (tagId: string) => {
  try {
    await deleteDoc(doc(db, 'tags', tagId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tags/${tagId}`);
  }
};

export const subscribeToClients = (companyId: CompanyType, callback: (clients: Client[]) => void) => {
  const q = query(collection(db, 'clients'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
    callback(clients);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'clients');
  });
};

export const addClient = async (client: Omit<Client, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'clients'), {
      ...client,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'clients');
  }
};

export const updateClient = async (clientId: string, data: Partial<Client>) => {
  try {
    const clientRef = doc(db, 'clients', clientId);
    await updateDoc(clientRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `clients/${clientId}`);
  }
};

export const deleteClient = async (clientId: string) => {
  try {
    // 1. Delete the client document
    await deleteDoc(doc(db, 'clients', clientId));

    // 2. Find and delete all associated cards in all funnels
    const collections = ['commercial_cards', 'financial_cards', 'operation_cards', 'internal_tasks_cards'];
    
    for (const collName of collections) {
      const q = query(collection(db, collName), where('clientId', '==', clientId));
      const snapshot = await getDocs(q);
      
      const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `clients/${clientId}`);
  }
};

export const saveUser = async (user: any, overrides?: { name?: string, photoURL?: string, teamCategory?: 'terceirizado' | 'internalizado' | 'intermediados' }) => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().role === 'deleted') {
      try { await user.delete(); } catch(e) {} // try to delete auth account
      await auth.signOut();
      throw new Error('Conta desativada.');
    }
    
    let role = 'client';
    if (userSnap.exists() && userSnap.data().role) {
      role = userSnap.data().role;
    }
    
    if (user.email === 'tali.agenciadigital@gmail.com' || user.email === 'diogotorres2907@gmail.com') {
      role = 'admin';
    }

    const existingData = userSnap.exists() ? userSnap.data() : {};
    
    await setDoc(userRef, {
      name: overrides?.name || existingData?.name || user.displayName || user.email?.split('@')[0] || 'Usuário',
      email: user.email,
      photoURL: overrides?.photoURL || existingData?.photoURL || user.photoURL || '',
      role: role,
      teamCategory: overrides?.teamCategory || existingData?.teamCategory || null
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
};

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const adminCreateUser = async (email: string, name: string, role: 'admin' | 'client' | 'equipe', teamCategory?: 'terceirizado' | 'internalizado' | 'intermediados') => {
  try {
    const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
    const secondaryAuth = getAuth(secondaryApp);
    
    // Create user with a random password
    const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, randomPassword);
    
    // Save user document
    const userRef = doc(db, 'users', userCredential.user.uid);
    await setDoc(userRef, {
      name: name,
      email: email,
      photoURL: '',
      role: role,
      teamCategory: role === 'equipe' ? (teamCategory || null) : null
    });

    // Sign out the secondary app
    await secondaryAuth.signOut();
    
    return { success: true, password: randomPassword };
  } catch (error: any) {
    console.error("Error creating user:", error);
    return { success: false, error: error.message };
  }
};

export const updateUserRole = async (userId: string, role: 'admin' | 'client' | 'equipe', teamCategory?: 'terceirizado' | 'internalizado' | 'intermediados') => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { 
      role, 
      teamCategory: role === 'equipe' ? (teamCategory || null) : null 
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
};

export const updateUserTags = async (userId: string, tags: string[]) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { serviceTags: tags });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/tags`);
  }
};

export const updateUserHourlyRate = async (userId: string, rate: number) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { hourlyRate: rate });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/hourlyRate`);
  }
};

export const deleteUserDoc = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { role: 'deleted' });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
  }
};

export const subscribeToNotifications = (userId: string, callback: (notifications: Notification[]) => void) => {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
    callback(notifications.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'notifications');
  });
};

export const createNotification = async (notification: Omit<Notification, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notification,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'notifications');
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
};

export const clearAllNotifications = async (userId: string) => {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/clear/${userId}`);
  }
};

export const subscribeToUsers = (callback: (users: UserProfile[]) => void) => {
  const q = query(collection(db, 'users'));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
      .filter((u: any) => u.role !== 'deleted');
    callback(users);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'users');
  });
};

export const subscribeToCommercialLists = (companyId: CompanyType, callback: (lists: CommercialList[]) => void) => {
  const q = query(collection(db, 'commercial_lists'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommercialList));
    callback(lists.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'commercial_lists');
  });
};

export const subscribeToCommercialCards = (companyId: CompanyType, callback: (cards: CommercialCard[]) => void) => {
  const q = query(collection(db, 'commercial_cards'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommercialCard));
    callback(cards.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'commercial_cards');
  });
};

export const subscribeToFinancialLists = (companyId: CompanyType, callback: (lists: FinancialList[]) => void) => {
  const q = query(collection(db, 'financial_lists'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialList));
    callback(lists.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'financial_lists');
  });
};

export const subscribeToFinancialCards = (companyId: CompanyType, callback: (cards: FinancialCard[]) => void) => {
  const q = query(collection(db, 'financial_cards'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialCard));
    callback(cards.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'financial_cards');
  });
};

export const subscribeToOperationLists = (companyId: CompanyType, callback: (lists: OperationList[]) => void) => {
  const q = query(collection(db, 'operation_lists'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OperationList));
    callback(lists.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'operation_lists');
  });
};

export const subscribeToOperationCards = (companyId: CompanyType, callback: (cards: OperationCard[]) => void) => {
  const q = query(collection(db, 'operation_cards'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OperationCard));
    callback(cards.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'operation_cards');
  });
};

export const addCommercialList = async (list: Omit<CommercialList, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'commercial_lists'), sanitizeData({
      ...list,
      createdAt: Timestamp.now()
    }));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'commercial_lists');
  }
};

export const updateCommercialList = async (listId: string, data: Partial<CommercialList>) => {
  try {
    const listRef = doc(db, 'commercial_lists', listId);
    await updateDoc(listRef, sanitizeData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commercial_lists/${listId}`);
  }
};

export const deleteCommercialList = async (listId: string) => {
  try {
    // 1. Delete the list
    await deleteDoc(doc(db, 'commercial_lists', listId));

    // 2. Delete all cards in this list
    const q = query(collection(db, 'commercial_cards'), where('listId', '==', listId));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `commercial_lists/${listId}`);
  }
};

export const addCommercialCard = async (card: Omit<CommercialCard, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'commercial_cards'), sanitizeData({
      ...card,
      createdAt: Timestamp.now()
    }));
    
    const cardWithId = { ...card, id: docRef.id } as CommercialCard;
    return docRef.id;
    
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'commercial_cards');
  }
};

export const updateCommercialCard = async (cardId: string, data: Partial<CommercialCard>) => {
  try {
    const cardRef = doc(db, 'commercial_cards', cardId);
    await updateDoc(cardRef, sanitizeData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commercial_cards/${cardId}`);
  }
};

export const deleteCommercialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'commercial_cards', cardId);
    await updateDoc(cardRef, { 
      deleted: true,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `commercial_cards/${cardId}`);
  }
};

export const completeCommercialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'commercial_cards', cardId);
    await updateDoc(cardRef, { 
      completed: true,
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commercial_cards/${cardId}`);
  }
};

export const restoreCommercialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'commercial_cards', cardId);
    await updateDoc(cardRef, { 
      deleted: false,
      completed: false,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `commercial_cards/${cardId}`);
  }
};

export const permanentDeleteCommercialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'commercial_cards', cardId);
    await deleteDoc(cardRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `commercial_cards/${cardId}`);
  }
};

export const addFinancialList = async (list: Omit<FinancialList, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'financial_lists'), sanitizeData({
      ...list,
      createdAt: Timestamp.now()
    }));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'financial_lists');
  }
};

export const updateFinancialList = async (listId: string, data: Partial<FinancialList>) => {
  try {
    const listRef = doc(db, 'financial_lists', listId);
    await updateDoc(listRef, sanitizeData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `financial_lists/${listId}`);
  }
};

export const deleteFinancialList = async (listId: string) => {
  try {
    // 1. Delete the list
    await deleteDoc(doc(db, 'financial_lists', listId));

    // 2. Delete all cards in this list
    const q = query(collection(db, 'financial_cards'), where('listId', '==', listId));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `financial_lists/${listId}`);
  }
};

export const addFinancialCard = async (card: Omit<FinancialCard, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'financial_cards'), sanitizeData({
      ...card,
      createdAt: Timestamp.now()
    }));

    const cardWithId = { ...card, id: docRef.id } as FinancialCard;
    return docRef.id;

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'financial_cards');
  }
};

export const updateFinancialCard = async (cardId: string, data: Partial<FinancialCard>) => {
  try {
    const cardRef = doc(db, 'financial_cards', cardId);
    await updateDoc(cardRef, sanitizeData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `financial_cards/${cardId}`);
  }
};

export const deleteFinancialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'financial_cards', cardId);
    await updateDoc(cardRef, { 
      deleted: true,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `financial_cards/${cardId}`);
  }
};

export const completeFinancialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'financial_cards', cardId);
    await updateDoc(cardRef, { 
      completed: true,
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `financial_cards/${cardId}`);
  }
};

export const restoreFinancialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'financial_cards', cardId);
    await updateDoc(cardRef, { 
      deleted: false,
      completed: false,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `financial_cards/${cardId}`);
  }
};

export const permanentDeleteFinancialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'financial_cards', cardId);
    await deleteDoc(cardRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `financial_cards/${cardId}`);
  }
};

export const addOperationList = async (list: Omit<OperationList, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'operation_lists'), sanitizeData({
      ...list,
      createdAt: Timestamp.now()
    }));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'operation_lists');
  }
};

export const updateOperationList = async (listId: string, data: Partial<OperationList>) => {
  try {
    const listRef = doc(db, 'operation_lists', listId);
    await updateDoc(listRef, sanitizeData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `operation_lists/${listId}`);
  }
};

export const deleteOperationList = async (listId: string) => {
  try {
    // 1. Delete the list
    await deleteDoc(doc(db, 'operation_lists', listId));

    // 2. Delete all cards in this list
    const q = query(collection(db, 'operation_cards'), where('listId', '==', listId));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `operation_lists/${listId}`);
  }
};

export const addOperationCard = async (card: Omit<OperationCard, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'operation_cards'), sanitizeData({
      ...card,
      createdAt: Timestamp.now()
    }));

    const cardWithId = { ...card, id: docRef.id } as OperationCard;
    return docRef.id;

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'operation_cards');
  }
};

export const updateOperationCard = async (cardId: string, data: Partial<OperationCard>) => {
  try {
    const cardRef = doc(db, 'operation_cards', cardId);
    await updateDoc(cardRef, sanitizeData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `operation_cards/${cardId}`);
  }
};

export const deleteOperationCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'operation_cards', cardId);
    await updateDoc(cardRef, { 
      deleted: true,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `operation_cards/${cardId}`);
  }
};

export const completeOperationCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'operation_cards', cardId);
    await updateDoc(cardRef, { 
      completed: true,
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `operation_cards/${cardId}`);
  }
};

export const restoreOperationCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'operation_cards', cardId);
    await updateDoc(cardRef, { 
      deleted: false,
      completed: false,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `operation_cards/${cardId}`);
  }
};

export const permanentDeleteOperationCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'operation_cards', cardId);
    await deleteDoc(cardRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `operation_cards/${cardId}`);
  }
};


export const subscribeToInternalTaskLists = (companyId: CompanyType, callback: (lists: InternalTaskList[]) => void) => {
  const q = query(collection(db, 'internal_tasks_lists'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InternalTaskList));
    callback(lists.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'internal_tasks_lists');
  });
};

export const subscribeToInternalTaskCards = (companyId: CompanyType, callback: (cards: InternalTaskCard[]) => void) => {
  const q = query(collection(db, 'internal_tasks_cards'), where('companyId', '==', companyId));
  return onSnapshot(q, (snapshot) => {
    const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InternalTaskCard));
    callback(cards.sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'internal_tasks_cards');
  });
};


export const addInternalTaskList = async (list: Omit<InternalTaskList, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'internal_tasks_lists'), sanitizeData({
      ...list,
      createdAt: Timestamp.now()
    }));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'internal_tasks_lists');
  }
};

export const updateInternalTaskList = async (listId: string, data: Partial<InternalTaskList>) => {
  try {
    const listRef = doc(db, 'internal_tasks_lists', listId);
    await updateDoc(listRef, sanitizeData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `internal_tasks_lists/${listId}`);
  }
};

export const deleteInternalTaskList = async (listId: string) => {
  try {
    // 1. Delete the list
    await deleteDoc(doc(db, 'internal_tasks_lists', listId));

    // 2. Delete all cards in this list
    const q = query(collection(db, 'internal_tasks_cards'), where('listId', '==', listId));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `internal_tasks_lists/${listId}`);
  }
};

export const addInternalTaskCard = async (card: Omit<InternalTaskCard, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'internal_tasks_cards'), sanitizeData({
      ...card,
      createdAt: Timestamp.now()
    }));

    const cardWithId = { ...card, id: docRef.id } as InternalTaskCard;
    return docRef.id;

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'internal_tasks_cards');
  }
};

export const updateInternalTaskCard = async (cardId: string, data: Partial<InternalTaskCard>) => {
  try {
    const cardRef = doc(db, 'internal_tasks_cards', cardId);
    await updateDoc(cardRef, sanitizeData(data));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `internal_tasks_cards/${cardId}`);
  }
};

export const deleteInternalTaskCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'internal_tasks_cards', cardId);
    await updateDoc(cardRef, { 
      deleted: true,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `internal_tasks_cards/${cardId}`);
  }
};

export const completeInternalTaskCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'internal_tasks_cards', cardId);
    await updateDoc(cardRef, { 
      completed: true,
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `internal_tasks_cards/${cardId}`);
  }
};

export const restoreInternalTaskCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'internal_tasks_cards', cardId);
    await updateDoc(cardRef, { 
      deleted: false,
      completed: false,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `internal_tasks_cards/${cardId}`);
  }
};

export const permanentDeleteInternalTaskCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'internal_tasks_cards', cardId);
    await deleteDoc(cardRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `internal_tasks_cards/${cardId}`);
  }
};
export const duplicateCommercialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'commercial_cards', cardId);
    const cardSnap = await getDoc(cardRef);
    if (!cardSnap.exists()) throw new Error('Card não encontrado');
    
    const { id, createdAt, updatedAt, ...data } = cardSnap.data() as CommercialCard & { id: string };
    return await addCommercialCard({
      ...data,
      title: `${data.title || 'Novo Card'} (Cópia)`,
      order: (data.order || 0) + 1
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `commercial_cards/${cardId}/duplicate`);
  }
};

export const duplicateFinancialCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'financial_cards', cardId);
    const cardSnap = await getDoc(cardRef);
    if (!cardSnap.exists()) throw new Error('Card não encontrado');
    
    const { id, createdAt, updatedAt, ...data } = cardSnap.data() as FinancialCard & { id: string };
    return await addFinancialCard({
      ...data,
      title: `${data.title || 'Novo Card'} (Cópia)`,
      order: (data.order || 0) + 1
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `financial_cards/${cardId}/duplicate`);
  }
};

export const duplicateOperationCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'operation_cards', cardId);
    const cardSnap = await getDoc(cardRef);
    if (!cardSnap.exists()) throw new Error('Card não encontrado');
    
    const { id, createdAt, updatedAt, ...data } = cardSnap.data() as OperationCard & { id: string };
    return await addOperationCard({
      ...data,
      title: `${data.title || 'Novo Card'} (Cópia)`,
      order: (data.order || 0) + 1
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `operation_cards/${cardId}/duplicate`);
  }
};

export const duplicateInternalTaskCard = async (cardId: string) => {
  try {
    const cardRef = doc(db, 'internal_tasks_cards', cardId);
    const cardSnap = await getDoc(cardRef);
    if (!cardSnap.exists()) throw new Error('Card não encontrado');
    
    const { id, createdAt, updatedAt, ...data } = cardSnap.data() as InternalTaskCard & { id: string };
    return await addInternalTaskCard({
      ...data,
      title: `${data.title || 'Novo Card'} (Cópia)`,
      order: (data.order || 0) + 1
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `internal_tasks_cards/${cardId}/duplicate`);
  }
};
export const updateCardTimer = async (
  cardId: string, 
  sector: string, 
  data: { 
    timeSpent: number; 
    timerStartedAt: any | null; 
    timerStatus: 'running' | 'paused' | 'idle';
  }
) => {
  try {
    const colName = sector === 'comercial' ? 'commercial_cards' : 
                   sector === 'financeiro' ? 'financial_cards' : 
                   sector === 'operacional' ? 'operation_cards' : 
                   'internal_tasks_cards';
    
    const cardRef = doc(db, colName, cardId);
    await updateDoc(cardRef, sanitizeData({
      ...data,
      updatedAt: Timestamp.now()
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `timer/${sector}/${cardId}`);
  }
};
