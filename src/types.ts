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
  role: 'admin' | 'client' | 'equipe';
  teamCategory?: 'terceirizado' | 'internalizado' | 'intermediados';
  serviceTags?: string[]; // Array of Tag IDs
  hourlyRate?: number;
  pixKey?: string;
  phone?: string;
  isGhost?: boolean;
  workDescription?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  link?: string;
  cardId?: string;
  sector?: string;
  type?: 'recurrence' | 'system';
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
  isRestricted?: boolean;
  visibleTo?: string[];
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
  color?: string;
  timeSpent?: number; // Total seconds spent
  timerStartedAt?: any; // Timestamp of last start
  timerStatus?: 'running' | 'paused' | 'idle';
  workerFinished?: boolean;
  price?: number;
}

export interface FinancialList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  color?: string;
  isRestricted?: boolean;
  visibleTo?: string[];
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
  color?: string;
  timeSpent?: number;
  timerStartedAt?: any;
  timerStatus?: 'running' | 'paused' | 'idle';
  workerFinished?: boolean;
  price?: number;
}

export interface OperationList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  color?: string;
  isRestricted?: boolean;
  visibleTo?: string[];
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
  color?: string;
  timeSpent?: number;
  timerStartedAt?: any;
  timerStatus?: 'running' | 'paused' | 'idle';
  workerFinished?: boolean;
  price?: number;
}

export interface InternalTaskList {
  id: string;
  name: string;
  companyId: string;
  order: number;
  defaultChecklist: string[];
  assignees?: string[]; // Array of UserProfile ids
  color?: string;
  isRestricted?: boolean;
  visibleTo?: string[];
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
  color?: string;
  timeSpent?: number;
  timerStartedAt?: any;
  timerStatus?: 'running' | 'paused' | 'idle';
  workerFinished?: boolean;
  price?: number;
}

export interface Company {
  id: CompanyType;
  name: string;
  description: string;
}

export interface Sector {
  id: string;
  name: string;
  group: 'cliente' | 'interno';
  order: number;
  companyId: string;
  icon?: string;
  createdAt: any;
}

export interface QuickLink {
  id: string;
  name: string;
  url: string;
  companyId: string;
  order: number;
  category?: string;
  createdAt: any;
}

export interface FollowUp {
  date: string;
  message: string;
}

export interface CalculatorData {
  yearsOpen: number;
  patientsPerDay: number;
  workDaysPerWeek: number;
  ticketMedio: number;
  yearsWithData: number;
  conversionRate: number;
  showResults: boolean;
}

export interface Prospect {
  id: string;
  order: number;
  responsible: string;
  location: string;
  clinicName: string;
  clinicInstagram: string;
  gmn: string;
  site: string;
  ownerName: string;
  ownerInstagram: string;
  followedOwner: 'Sim' | 'Solicitado' | 'Não' | '';
  size: string;
  age: string;
  status: 'Mandar Mensagem' | 'Mensagem Enviada' | '1º Follow Up' | '2º Follow Up' | '3º+ Follow Up' | 'Cliente Respondeu' | 'Reunião Agendada' | 'Cliente Fechado' | 'Contrato Encerrado' | 'Base de Recomeço' | '';
  hasAnswered: boolean;
  lastFollowUp: string;
  observations: string;
  firstContactDate: string;
  week: string;
  companyId: CompanyType;
  createdAt?: any;
  updatedAt?: any;
  currentStep: number; // 1 to 4
  step1Done?: boolean;
  step2Done?: boolean;
  step3Done?: boolean;
  step4Done?: boolean;
  
  // Novos campos adicionados
  collaborators?: string;
  gmnRating?: string;
  gmnReviewsCount?: string;
  approachUsed?: string;
  lastContactDate?: string;
  aiReport?: string;
  instagramMessage?: string;
  isRestartBase?: boolean;
  followUps?: FollowUp[];
  aiFilledFields?: string[];
  calculatorData?: CalculatorData;
  fullAddress?: string;
}
