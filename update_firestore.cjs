const fs = require('fs');

const file = 'src/services/firestoreService.ts';
let data = fs.readFileSync(file, 'utf8');

// Update imports
data = data.replace(
  'OperationCard, Client, Tag, Notification',
  'OperationCard, InternalTaskList, InternalTaskCard, Client, Tag, Notification'
);

const marker = 'export const subscribeToOperationLists = ';
const index = data.indexOf(marker);

if (index !== -1) {
  const opBlock = data.substring(index);
  
  const internalBlock = opBlock
    .replace(/OperationList/g, 'InternalTaskList')
    .replace(/OperationCard/g, 'InternalTaskCard')
    .replace(/operation_lists/g, 'internal_tasks_lists')
    .replace(/operation_cards/g, 'internal_tasks_cards')
    .replace(/subscribeToOperationLists/g, 'subscribeToInternalTaskLists')
    .replace(/subscribeToOperationCards/g, 'subscribeToInternalTaskCards')
    .replace(/addOperationList/g, 'addInternalTaskList')
    .replace(/updateOperationList/g, 'updateInternalTaskList')
    .replace(/deleteOperationList/g, 'deleteInternalTaskList')
    .replace(/addOperationCard/g, 'addInternalTaskCard')
    .replace(/updateOperationCard/g, 'updateInternalTaskCard')
    .replace(/deleteOperationCard/g, 'deleteInternalTaskCard');

  data = data + '\n\n' + internalBlock;
  fs.writeFileSync(file, data, 'utf8');
  console.log('Success');
} else {
  console.error('Marker not found');
}
