import React from 'react';
import { UnifiedSectorView } from './UnifiedSectorView';
import { OperationList, OperationCard, CommercialCard, FinancialCard, InternalTaskCard, CompanyType, Client, Tag, UserProfile, SectorCardFilter } from '../types';

interface OperationViewProps {
  viewMode: 'kanban' | 'list' | 'vertical' | 'calendar';
  cardFilter: SectorCardFilter;
  companyId: CompanyType;
  lists: OperationList[];
  cards: OperationCard[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  onMoveToSector: (card: OperationCard, targetSector: string) => void;
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
  userRole?: string;
}

export const OperationView: React.FC<OperationViewProps> = (props) => {
  return <UnifiedSectorView {...props} sector="operation" />;
};
