import React from 'react';
import { UnifiedSectorView } from './UnifiedSectorView';
import { FinancialList, FinancialCard, CommercialCard, OperationCard, InternalTaskCard, CompanyType, Client, Tag, UserProfile, SectorCardFilter } from '../types';

interface FinancialViewProps {
  viewMode: 'kanban' | 'list' | 'vertical' | 'calendar';
  cardFilter: SectorCardFilter;
  companyId: CompanyType;
  lists: FinancialList[];
  cards: FinancialCard[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  onMoveToSector: (card: FinancialCard, targetSector: string) => void;
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

export const FinancialView: React.FC<FinancialViewProps> = (props) => {
  return <UnifiedSectorView {...props} sector="financial" />;
};
