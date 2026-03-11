const fs = require('fs');

const file = 'src/components/EditCommercialCardModal.tsx';
const outFile = 'src/components/EditInternalTaskCardModal.tsx';

let data = fs.readFileSync(file, 'utf8');

data = data
  .replace(/CommercialCard/g, 'InternalTaskCard')
  .replace(/updateCommercialCard/g, 'updateInternalTaskCard')
  .replace(/deleteCommercialCard/g, 'deleteInternalTaskCard')
  .replace(/EditCommercialCardModal/g, 'EditInternalTaskCardModal');

fs.writeFileSync(outFile, data, 'utf8');
console.log('Success creation EditInternalTaskCardModal');
