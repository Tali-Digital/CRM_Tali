import React from 'react';
import { UnifiedSectorView } from './UnifiedSectorView';
import { CommercialList, CommercialCard, FinancialCard, OperationCard, InternalTaskCard, CompanyType, Client, Tag, UserProfile, SectorCardFilter } from '../types';

interface CommercialViewProps {
  viewMode: 'kanban' | 'list' | 'vertical' | 'calendar';
  cardFilter: SectorCardFilter;
  companyId: CompanyType;
  lists: CommercialList[];
  cards: CommercialCard[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  onMoveToSector: (card: CommercialCard, targetSector: string) => void;
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

export const CommercialView: React.FC<CommercialViewProps> = (props) => {
  return <UnifiedSectorView {...props} sector="commercial" />;
};
