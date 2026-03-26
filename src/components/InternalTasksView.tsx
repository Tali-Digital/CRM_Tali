import React from 'react';
import { UnifiedSectorView } from './UnifiedSectorView';
import { InternalTaskList, InternalTaskCard, CommercialCard, FinancialCard, OperationCard, CompanyType, Client, Tag, UserProfile, SectorCardFilter } from '../types';

interface InternalTasksViewProps {
  viewMode: 'kanban' | 'list' | 'vertical' | 'calendar';
  cardFilter: SectorCardFilter;
  companyId: CompanyType;
  lists: InternalTaskList[];
  cards: InternalTaskCard[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  onMoveToSector: (card: InternalTaskCard, targetSector: string) => void;
  allCommercialCards?: CommercialCard[];
  allFinancialCards?: FinancialCard[];
  allOperationCards?: OperationCard[];
  allInternalTaskCards?: InternalTaskCard[];
  jumpToCard?: { id: string, sector: string } | null;
  onClearJump?: () => void;
  onJumpToCard?: (cardId: string, sector: string) => void;
  allSectors?: any[];
  activeId?: string | null;
  activeCard?: any | null;
}

export const InternalTasksView: React.FC<InternalTasksViewProps> = (props) => {
  return <UnifiedSectorView {...props} sector="internal_tasks" />;
};
