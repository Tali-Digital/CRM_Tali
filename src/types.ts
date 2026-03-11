export type CompanyType = 'odonto' | 'digital';

export interface Service {
  id: string;
  name: string;
  price: number;
  isPartOfMethod: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  companyId: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  photoURL: string;
  role: 'admin' | 'client' | 'outsourced';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  link?: string;
}

export interface Client {
  id: string;
  name: string;
  themeColor: 'blue' | 'yellow';
  serviceTags: string[]; // Array of Tag IDs
  checklist: ChecklistItem[];
  notes: string;
  companyId: string;
  createdAt?: any;
}

export interface CommercialList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  createdAt?: any;
}

export interface CommercialCard {
  id: string;
  clientId?: string;
  listId: string;
  companyId: string;
  order: number;
  createdAt?: any;
  updatedAt?: any;
  type?: 'client' | 'custom';
  title?: string;
  checklist?: ChecklistItem[];
  notes?: string;
  assignees?: string[]; // Array of UserProfile ids
  startDate?: any;
  deliveryDate?: any;
  // Legacy fields for backward compatibility
  clientName?: string;
}

export interface FinancialList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  createdAt?: any;
}

export interface FinancialCard {
  id: string;
  clientId?: string;
  listId: string;
  companyId: string;
  order: number;
  createdAt?: any;
  updatedAt?: any;
  type?: 'client' | 'custom';
  title?: string;
  checklist?: ChecklistItem[];
  notes?: string;
  assignees?: string[]; // Array of UserProfile ids
  startDate?: any;
  deliveryDate?: any;
}

export interface OperationList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  createdAt?: any;
}

export interface OperationCard {
  id: string;
  clientId?: string;
  listId: string;
  companyId: string;
  order: number;
  createdAt?: any;
  updatedAt?: any;
  type?: 'client' | 'custom';
  title?: string;
  checklist?: ChecklistItem[];
  notes?: string;
  assignees?: string[]; // Array of UserProfile ids
  startDate?: any;
  deliveryDate?: any;
}

export interface InternalTaskList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  createdAt?: any;
}

export interface InternalTaskCard {
  id: string;
  listId: string;
  companyId: string;
  order: number;
  createdAt?: any;
  updatedAt?: any;
  title: string;
  checklist?: ChecklistItem[];
  notes?: string;
  assignees?: string[]; // Array of UserProfile ids
  startDate?: any;
  deliveryDate?: any;
}

export interface Company {
  id: CompanyType;
  name: string;
  description: string;
}
