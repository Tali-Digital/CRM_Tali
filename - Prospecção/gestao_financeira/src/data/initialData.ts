export const initialPortfolioProperties: any[] = [];

export const initialKanbanData = {
  clients: {},
  columns: {
    'col-0': {
      id: 'col-0',
      title: 'Cadastros do Site',
      clientIds: [],
    },
    'col-1': {
      id: 'col-1',
      title: 'Novos Contatos',
      clientIds: [],
    },
    'col-2': {
      id: 'col-2',
      title: 'Em Atendimento',
      clientIds: [],
    },
    'col-3': {
      id: 'col-3',
      title: 'Análise de Crédito / Viabilidade',
      clientIds: [],
    },
    'col-4': {
      id: 'col-4',
      title: 'Proposta / Arrematação',
      clientIds: [],
    },
  },
  columnOrder: ['col-0', 'col-1', 'col-2', 'col-3', 'col-4'],
};

export const initialCaixaData = {
  db: {
    'DF': [],
    'GO': []
  },
  states: ['DF', 'GO']
};

export const initialPopupsData: any[] = [];

export const initialTeamData: any[] = [];

export const fixedCompanyCosts: any[] = [];
