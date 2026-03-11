const fs = require('fs');

const file = 'src/components/CommercialView.tsx';
const outFile = 'src/components/InternalTasksView.tsx';

let data = fs.readFileSync(file, 'utf8');

data = data
  .replace(/CommercialList/g, 'InternalTaskList')
  .replace(/CommercialCard/g, 'InternalTaskCard')
  .replace(/addCommercialList/g, 'addInternalTaskList')
  .replace(/addCommercialCard/g, 'addInternalTaskCard')
  .replace(/updateCommercialCard/g, 'updateInternalTaskCard')
  .replace(/updateCommercialList/g, 'updateInternalTaskList')
  .replace(/deleteCommercialList/g, 'deleteInternalTaskList')
  .replace(/EditCommercialCardModal/g, 'EditInternalTaskCardModal')
  .replace(/CommercialView/g, 'InternalTasksView')
  .replace(/Comercial/g, 'Tarefas Internas')
  .replace(/Gerencie o funil de vendas e processos operacionais./g, 'Gerencie as suas tarefas internas e da sua equipe.')
  .replace(/Novo Setor/g, 'Nova Lista')
  .replace(/Nenhum setor criado no funil\./g, 'Nenhuma lista de tarefas criada.')
  .replace(/Criar Primeiro Setor/g, 'Criar Primeira Lista');

fs.writeFileSync(outFile, data, 'utf8');
console.log('Success creation InternalTasksView');
