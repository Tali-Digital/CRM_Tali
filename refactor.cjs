const fs = require('fs');
const path = require('path');

const gestaoPath = path.join(__dirname, 'src', 'components', 'GestaoProspeccaoEditor.tsx');
let gestaoCode = fs.readFileSync(gestaoPath, 'utf8');

// Replace imports
gestaoCode = gestaoCode.replace(/import GeradorContrato from '\.\.\/components\/GeradorContrato';/g, "import GeradorProspeccao from './GeradorProspeccao';");
gestaoCode = gestaoCode.replace(/import GerenciadorModelosModal from '\.\.\/components\/GerenciadorModelosModal';/g, "import GerenciadorModelosModal from './GerenciadorModelosModal';");
gestaoCode = gestaoCode.replace(/export default function GestaoContratos/g, "import { subscribeToProspeccaoDocs, deleteProspeccaoDoc } from '../services/firestoreService';\nimport { EditorProspeccaoDoc } from '../types';\n\nexport default function GestaoProspeccaoEditor");

// Replace types
gestaoCode = gestaoCode.replace(/interface Contrato {[\s\S]*?}/, "");
gestaoCode = gestaoCode.replace(/Contrato/g, "EditorProspeccaoDoc");
gestaoCode = gestaoCode.replace(/contratos/g, "prospeccoes");
gestaoCode = gestaoCode.replace(/setContratos/g, "setProspeccoes");
gestaoCode = gestaoCode.replace(/contrato/g, "prospeccao");

// Replace GestaoContratos -> GestaoProspeccaoEditor
gestaoCode = gestaoCode.replace(/GestaoContratos/g, "GestaoProspeccaoEditor");
gestaoCode = gestaoCode.replace(/Gestão de Contratos/g, "Gestão de Prospecção");
gestaoCode = gestaoCode.replace(/GeradorContrato/g, "GeradorProspeccao");

// Replace the loadData api call for contratos with firebase subscribe
const loadDataRegex = /\/\/\s*Carregar Contratos[\s\S]*?(?=\/\/ Carregar Clientes)/;
gestaoCode = gestaoCode.replace(loadDataRegex, "");

// Add useEffect for subscribing
gestaoCode = gestaoCode.replace(/useEffect\(\(\) => {/, "useEffect(() => {\n    const unsubscribe = subscribeToProspeccaoDocs(docs => setProspeccoes(docs));\n    return () => unsubscribe();\n  }, []);\n\n  useEffect(() => {");

// Replace save endpoint
const saveRegex = /const res = await fetch\('\/api\.php\?key=ruth_dias_contratos'[\s\S]*?if \(!res\.ok\)/;
gestaoCode = gestaoCode.replace(saveRegex, `
        /* Save handled inside GeradorProspeccao directly to Firebase */
        setIsGeradorOpen(false);
        setEditingProspeccao(null);
        Swal.fire('Sucesso!', 'Salvo com sucesso!', 'success');
        if (false) `);

// Replace delete endpoint
const delRegex = /const res = await fetch\('\/api\.php\?key=ruth_dias_contratos'[\s\S]*?if \(!res\.ok\) throw new Error\('Erro'\);/;
gestaoCode = gestaoCode.replace(delRegex, `await deleteProspeccaoDoc(prospeccaoToDelete.id);`);

fs.writeFileSync(gestaoPath, gestaoCode);
console.log('GestaoProspeccaoEditor updated.');

const geradorPath = path.join(__dirname, 'src', 'components', 'GeradorProspeccao.tsx');
let geradorCode = fs.readFileSync(geradorPath, 'utf8');

geradorCode = geradorCode.replace(/import React, { useState, useRef, useEffect } from 'react';/, "import React, { useState, useRef, useEffect } from 'react';\nimport { addProspeccaoDoc, updateProspeccaoDoc, subscribeToModelosProspeccao, addModeloProspeccao, updateModeloProspeccao, deleteModeloProspeccao } from '../services/firestoreService';\nimport { EditorProspeccaoDoc, ModeloProspeccao } from '../types';");

geradorCode = geradorCode.replace(/GeradorContratoProps/g, "GeradorProspeccaoProps");
geradorCode = geradorCode.replace(/GeradorContrato/g, "GeradorProspeccao");
geradorCode = geradorCode.replace(/contrato/g, "prospeccao");
geradorCode = geradorCode.replace(/Contrato/g, "Prospeccao");
geradorCode = geradorCode.replace(/CONTRATO/g, "PROSPECÇÃO");
geradorCode = geradorCode.replace(/contratos/g, "prospeccoes");
geradorCode = geradorCode.replace(/ModeloProspeccao \{[\s\S]*?\}/, ""); // Remove the duplicate interface

// Fix models loading
const loadModelosRegex = /const loadModelos = async \(\) => {[\s\S]*?};\n\s*loadModelos\(\);/;
geradorCode = geradorCode.replace(loadModelosRegex, "const unsubscribe = subscribeToModelosProspeccao(setModelos);\n    return () => unsubscribe();");

// Fix handleSave
const handleSaveRegex = /const handleSave = async \(\) => {[\s\S]*?onSaveProspeccao\(novoProspeccao\);/;
geradorCode = geradorCode.replace(handleSaveRegex, `const handleSave = async () => {
    if (!tituloProspeccao) {
      Swal.fire('Atenção', 'Informe um título para a prospecção', 'warning');
      return;
    }

    const html = editorRef.current?.innerHTML || '';
    
    const novoProspeccao = {
      titulo: tituloProspeccao,
      clienteId: selectedCliente,
      clienteNome: clientes.find(c => c.id === selectedCliente)?.name || selectedCliente,
      imovelId: selectedImovel,
      imovel: imoveis.find(i => i.id === selectedImovel)?.title || selectedImovel,
      valor: parseFloat(valorProspeccao.replace(/[^0-9,-]+/g,"").replace(",", ".")) || 0,
      dataAssinatura: dataAssinatura,
      status: statusProspeccao,
      tipo: tipoProspeccao,
      conteudoHtml: html
    };

    try {
      if (prospeccaoParaEditar?.id) {
        await updateProspeccaoDoc(prospeccaoParaEditar.id, novoProspeccao);
      } else {
        await addProspeccaoDoc(novoProspeccao);
      }
      onSaveProspeccao(novoProspeccao);
`);

// Fix salvar modelo
const handleSalvarModeloRegex = /const res = await fetch\('\/api\.php\?key=ruth_dias_modelos_prospeccoes'[\s\S]*?if \(!res\.ok\) throw new Error\('Erro'\);/;
geradorCode = geradorCode.replace(handleSalvarModeloRegex, `
      if (selectedModeloId && selectedModeloId !== 'new') {
        await updateModeloProspeccao(selectedModeloId, { nome: nomeModelo, conteudo: html });
      } else {
        await addModeloProspeccao({ nome: nomeModelo, conteudo: html });
      }
`);

fs.writeFileSync(geradorPath, geradorCode);
console.log('GeradorProspeccao updated.');

const gerenciadorPath = path.join(__dirname, 'src', 'components', 'GerenciadorModelosModal.tsx');
let gerenciadorCode = fs.readFileSync(gerenciadorPath, 'utf8');
gerenciadorCode = gerenciadorCode.replace(/Contrato/g, "Prospeccao");
gerenciadorCode = gerenciadorCode.replace(/contrato/g, "prospeccao");
gerenciadorCode = gerenciadorCode.replace(/import \{ X, Plus, Edit2, Trash2, Check, XCircle \} from 'lucide-react';/, "import { X, Plus, Edit2, Trash2, Check, XCircle } from 'lucide-react';\nimport { subscribeToModelosProspeccao, deleteModeloProspeccao, updateModeloProspeccao } from '../services/firestoreService';");
gerenciadorCode = gerenciadorCode.replace(/const loadModelos = async \(\) => {[\s\S]*?};\n\s*loadModelos\(\);/, "const unsubscribe = subscribeToModelosProspeccao(setModelos);\n    return () => unsubscribe();");
gerenciadorCode = gerenciadorCode.replace(/const res = await fetch\('\/api\.php\?key=ruth_dias_modelos_prospeccoes'[\s\S]*?if \(!res\.ok\) throw new Error\('Erro'\);/g, `
        await deleteModeloProspeccao(id);
`);
gerenciadorCode = gerenciadorCode.replace(/const saveModelos = async \(novosModelos: ModeloProspeccao\[\]\) => {[\s\S]*?};/, `const saveModelos = async (novosModelos: any[]) => {
    // This is handled by deleteModeloProspeccao now, only keeping for compatibility if used elsewhere
  };`);
fs.writeFileSync(gerenciadorPath, gerenciadorCode);
console.log('GerenciadorModelosModal updated.');
