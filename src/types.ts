export type CompanyType = 'odonto' | 'digital';
export type SectorCardFilter = 'activities' | 'clients' | 'both';
export type RecurrencePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceSettings {
  enabled: boolean;
  period: RecurrencePeriod;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  lastTriggeredDate?: string;
}

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
  driveLink?: string;
  createdAt?: any;
}

export interface CommercialList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  color?: string;
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
  deleted?: boolean;
  completed?: boolean;
  completedAt?: any;
  // Legacy fields for backward compatibility
  clientName?: string;
  recurrence?: RecurrenceSettings;
  googleEventId?: string;
}

export interface FinancialList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  color?: string;
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
  deleted?: boolean;
  completed?: boolean;
  completedAt?: any;
  recurrence?: RecurrenceSettings;
  googleEventId?: string;
}

export interface OperationList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  color?: string;
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
  deleted?: boolean;
  completed?: boolean;
  completedAt?: any;
  recurrence?: RecurrenceSettings;
  googleEventId?: string;
}

export interface InternalTaskList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  color?: string;
  createdAt?: any;
}

export interface InternalTaskCard {
  id: string;
  clientId?: string;
  listId: string;
  companyId: string;
  order: number;
  createdAt?: any;
  updatedAt?: any;
  type?: 'client' | 'custom';
  title?: string;
  clientName?: string;
  checklist?: ChecklistItem[];
  notes?: string;
  assignees?: string[]; // Array of UserProfile ids
  startDate?: any;
  deliveryDate?: any;
  deleted?: boolean;
  completed?: boolean;
  completedAt?: any;
  recurrence?: RecurrenceSettings;
  googleEventId?: string;
}

export interface Company {
  id: CompanyType;
  name: string;
  description: string;
}
