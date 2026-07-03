import React, { useState, useRef, useEffect } from 'react';
import { X, Printer, FileText, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo, Redo, Eraser, Indent, Outdent, Wand2, Code, Sparkles } from 'lucide-react';
import Swal from 'sweetalert2';
import timbradoTopo from '../assets/timbrado_topo.png';
import timbradoBase from '../assets/timbrado_base.png';

interface GeradorContratoProps {
  onClose: () => void;
  clientes: { id: string; name: string; documents?: any[] }[];
  imoveis: { id: string; title: string; source: string }[];
  onSaveContrato?: (contrato: any) => Promise<void>;
  contratoParaEditar?: any;
}

interface ModeloContrato {
  id: string;
  nome: string;
  conteudo: string;
}

export default function GeradorContrato({ onClose, clientes, imoveis, onSaveContrato, contratoParaEditar }: GeradorContratoProps) {
  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedImovel, setSelectedImovel] = useState('');
  
  // Novos campos para salvar o contrato
  const [tituloContrato, setTituloContrato] = useState('');
  const [tipoContrato, setTipoContrato] = useState<'Venda' | 'Locação'>('Venda');
  const [statusContrato, setStatusContrato] = useState<'Ativo' | 'Pendente' | 'Encerrado'>('Ativo');
  const [dataAssinatura, setDataAssinatura] = useState(new Date().toISOString().split('T')[0]);
  const [valorContrato, setValorContrato] = useState('');
  const [anexarDocs, setAnexarDocs] = useState(false);

  // Preencher os dados caso esteja editando um contrato existente
  useEffect(() => {
    if (contratoParaEditar) {
      if (contratoParaEditar.clienteNome || contratoParaEditar.clienteId) {
        setSelectedCliente(contratoParaEditar.clienteNome || contratoParaEditar.clienteId);
      }
      if (contratoParaEditar.imovelId) {
        setSelectedImovel(contratoParaEditar.imovelId);
      }
      if (contratoParaEditar.tipo) setTipoContrato(contratoParaEditar.tipo);
      if (contratoParaEditar.titulo) setTituloContrato(contratoParaEditar.titulo);
      if (contratoParaEditar.status) setStatusContrato(contratoParaEditar.status);
      if (contratoParaEditar.dataAssinatura) setDataAssinatura(contratoParaEditar.dataAssinatura);
      if (contratoParaEditar.valor) {
        const v = (parseFloat(contratoParaEditar.valor)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        setValorContrato('R$ ' + v);
      }
      if (contratoParaEditar.conteudoHtml && editorRef.current) {
        editorRef.current.innerHTML = contratoParaEditar.conteudoHtml;
        setPreviewHtml(contratoParaEditar.conteudoHtml);
      }
    }
  }, [contratoParaEditar]);

  const [selectedModeloId, setSelectedModeloId] = useState('');
  const [modelos, setModelos] = useState<ModeloContrato[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [viewHtml, setViewHtml] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [estilos, setEstilos] = useState({
    h1: { size: 16, bold: true, uppercase: true, indent: 0 },
    h2: { size: 14, bold: true, uppercase: true, indent: 0 },
    h3: { size: 12, bold: true, uppercase: false, indent: 0 },
    p: { size: 11, indent: 0, firstLine: 0 },
    list: { indent: 40, spacing: 5 }
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // Conteúdo inicial genérico
  const conteudoInicial = `CONTRATO EM BRANCO

(Escreva ou cole o texto do seu contrato aqui)
`;

  useEffect(() => {
    // Carregar modelos salvos
    const loadModelos = async () => {
      try {
        const res = await fetch('/api.php?key=ruth_dias_modelos_contratos');
        const txt = await res.text();
        if (txt && !txt.startsWith('<')) {
          let parsed = JSON.parse(txt);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) {
            setModelos(parsed);
          }
        }
      } catch (e) {
        console.error('Erro ao carregar modelos', e);
      }
    };
    loadModelos();

    // Carregar configurações de estilo globais
    const savedEstilos = localStorage.getItem('ruth_dias_estilos_v1');
    if (savedEstilos) {
      try {
        const parsed = JSON.parse(savedEstilos);
        setEstilos({
          h1: { indent: 0, ...parsed.h1 },
          h2: { indent: 0, ...parsed.h2 },
          h3: { indent: 0, ...parsed.h3 },
          p: { indent: 0, firstLine: 0, ...parsed.p },
          list: parsed.list || { indent: 40, spacing: 5 }
        });
      } catch (e) { }
    }

    if (editorRef.current && editorRef.current.innerHTML === '') {
      const initial = conteudoInicial.replace(/\n/g, '<br>');
      editorRef.current.innerHTML = initial;
      setPreviewHtml(initial);
    }
  }, []);

  useEffect(() => {
    if (measureRef.current) {
      const height = measureRef.current.scrollHeight;
      // 843px é a altura da área de texto em A4 (1123px - 160px topo - 120px rodapé)
      const pages = Math.max(1, Math.ceil(height / 843));
      setTotalPages(pages);
    }
  }, [previewHtml]);

  const handleEditorInput = () => {
    if (editorRef.current) {
      setPreviewHtml(editorRef.current.innerHTML);
    }
  };

  const handleSaveModelo = async () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;

    const currentModel = modelos.find(m => m.id === selectedModeloId);

    const { value: nome } = await Swal.fire({
      title: 'Salvar Modelo',
      text: 'Digite o nome deste modelo (ex: Contrato de Locação Padrão):',
      input: 'text',
      inputValue: currentModel ? currentModel.nome : '',
      showCancelButton: true,
      confirmButtonText: 'Salvar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => {
        if (!value) {
          return 'Você precisa digitar um nome!';
        }
      }
    });

    if (!nome) return;

    const existingModelIndex = modelos.findIndex(m => m.nome.trim().toLowerCase() === nome.trim().toLowerCase());

    let novosModelos = [...modelos];
    let newSelectedId = '';

    if (existingModelIndex >= 0) {
      const { isConfirmed } = await Swal.fire({
        title: 'Modelo já existe',
        text: `Já existe um modelo chamado "${nome}". Deseja sobrescrevê-lo?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sim, sobrescrever',
        cancelButtonText: 'Cancelar'
      });

      if (!isConfirmed) return;

      novosModelos[existingModelIndex] = {
        ...novosModelos[existingModelIndex],
        conteudo: html
      };
      newSelectedId = novosModelos[existingModelIndex].id;
    } else {
      const novoModelo: ModeloContrato = {
        id: 'mod-' + Date.now(),
        nome,
        conteudo: html
      };
      novosModelos.push(novoModelo);
      newSelectedId = novoModelo.id;
    }

    setModelos(novosModelos);

    await fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ruth_dias_modelos_contratos', value: JSON.stringify(novosModelos) })
    }).catch(() => { });

    Swal.fire({
      title: 'Sucesso!',
      text: 'Modelo salvo com sucesso!',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });
    setSelectedModeloId(newSelectedId);
  };

  const handleLoadModelo = (modeloId: string) => {
    setSelectedModeloId(modeloId);
    if (!modeloId) {
      if (editorRef.current) {
        const initial = conteudoInicial.replace(/\n/g, '<br>');
        editorRef.current.innerHTML = initial;
        setPreviewHtml(initial);
      }
      return;
    }
    const modelo = modelos.find(m => m.id === modeloId);
    if (modelo && editorRef.current) {
      editorRef.current.innerHTML = modelo.conteudo;
      setPreviewHtml(modelo.conteudo);
    }
  };


  const clearFormatting = () => {
    document.execCommand('removeFormat', false, undefined);

    // Desliga qualquer lista ativa (ul ou ol) que a seleção esteja dentro
    if (document.queryCommandState('insertOrderedList')) {
      document.execCommand('insertOrderedList', false, undefined);
    }
    if (document.queryCommandState('insertUnorderedList')) {
      document.execCommand('insertUnorderedList', false, undefined);
    }

    // Força transformar em Parágrafo Padrão
    document.execCommand('formatBlock', false, 'P');

    // Varredura nuclear para remover inline styles, classes e alinhamentos de tags coladas
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const parentElement = container.nodeType === 3 ? container.parentElement : container as HTMLElement;

      if (parentElement) {
        if (parentElement !== editorRef.current) {
          parentElement.removeAttribute('style');
          parentElement.removeAttribute('class');
          parentElement.removeAttribute('align');
          parentElement.removeAttribute('type'); // para <ol type="a">
        }

        const elements = parentElement.querySelectorAll('*');
        elements.forEach(el => {
          // Checa se o elemento está pelo menos parcialmente contido na seleção
          if (selection.containsNode(el, true)) {
            el.removeAttribute('style');
            el.removeAttribute('class');
            el.removeAttribute('align');
            el.removeAttribute('type');
          }
        });
      }
    }

    handleEditorInput();
  };

  const handleFormat = (command: string, value?: string) => {
    if (command === 'removeFormat') {
      clearFormatting();
    } else {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
      handleEditorInput();
    }
  };

  const handleListStyle = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return;

    const parts = value.split('|');
    const listTag = parts[0];
    const listStyle = parts[1];

    document.execCommand(listTag === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');

    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node = selection.anchorNode as Node | null;
        while (node && node.nodeName !== 'OL' && node.nodeName !== 'UL' && node !== editorRef.current) {
          node = node.parentNode;
        }
        if (node && (node.nodeName === 'OL' || node.nodeName === 'UL')) {
          (node as HTMLElement).style.listStyleType = listStyle;
        }
      }
      editorRef.current?.focus();
      handleEditorInput();
    }, 10);

    e.target.value = ''; // Reset select
  };

  const handleFixWordBreaks = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(range.cloneContents());

      // Limpeza AGRESSIVA: arranca todos os estilos e classes do Word,
      // preservando apenas o básico visual (negrito, itálico, sublinhado).
      tempDiv.querySelectorAll('*').forEach(el => {
        if (el instanceof HTMLElement) {
          const isBold = el.style.fontWeight === 'bold' || el.tagName === 'B' || el.tagName === 'STRONG' || parseInt(el.style.fontWeight) > 600;
          const isItalic = el.style.fontStyle === 'italic' || el.tagName === 'I' || el.tagName === 'EM';
          const isUnderline = el.style.textDecoration.includes('underline') || el.tagName === 'U';
          const isCenter = el.style.textAlign === 'center';
          const isRight = el.style.textAlign === 'right';
          const isJustify = el.style.textAlign === 'justify';

          // Arranca TODOS os atributos lixo do Word
          el.removeAttribute('class');
          el.removeAttribute('id');
          el.removeAttribute('style');
          el.removeAttribute('dir');
          el.removeAttribute('lang');

          // Devolve só a formatação de texto se existir
          if (isBold) el.style.fontWeight = 'bold';
          if (isItalic) el.style.fontStyle = 'italic';
          if (isUnderline) el.style.textDecoration = 'underline';
          if (isCenter) el.style.textAlign = 'center';
          if (isRight) el.style.textAlign = 'right';
          if (isJustify) el.style.textAlign = 'justify';
        }
      });

      let cleanedHTML = tempDiv.innerHTML;
      // Remove espaços inquebráveis que o Word insere
      cleanedHTML = cleanedHTML.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');

      document.execCommand('insertHTML', false, cleanedHTML);

      editorRef.current?.focus();
      handleEditorInput();

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Quebras de linha do Word corrigidas!',
        showConfirmButton: false,
        timer: 2000
      });
    } else {
      Swal.fire({
        icon: 'info',
        title: 'Selecione o texto',
        text: 'Por favor, selecione o texto com problemas de quebra de linha do Word.',
        confirmButtonColor: '#3085d6'
      });
    }
  };

  // Tratamento automático ao colar do Word
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    let pasteHtml = clipboardData.getData('text/html');
    const pasteText = clipboardData.getData('text/plain');

    if (!pasteHtml) {
      document.execCommand('insertText', false, pasteText);
      return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pasteHtml;

    // Remove tags inúteis do Word
    tempDiv.querySelectorAll('meta, link, style, script').forEach(tag => tag.remove());

    tempDiv.querySelectorAll('*').forEach(el => {
      if (el instanceof HTMLElement) {
        const isBold = el.style.fontWeight === 'bold' || el.tagName === 'B' || el.tagName === 'STRONG' || parseInt(el.style.fontWeight) > 600;
        const isItalic = el.style.fontStyle === 'italic' || el.tagName === 'I' || el.tagName === 'EM';
        const isUnderline = el.style.textDecoration.includes('underline') || el.tagName === 'U';
        const isCenter = el.style.textAlign === 'center';
        const isRight = el.style.textAlign === 'right';
        const isJustify = el.style.textAlign === 'justify';

        el.removeAttribute('class');
        el.removeAttribute('id');
        el.removeAttribute('style');
        el.removeAttribute('dir');
        el.removeAttribute('lang');

        if (isBold) el.style.fontWeight = 'bold';
        if (isItalic) el.style.fontStyle = 'italic';
        if (isUnderline) el.style.textDecoration = 'underline';
        if (isCenter) el.style.textAlign = 'center';
        if (isRight) el.style.textAlign = 'right';
        if (isJustify) el.style.textAlign = 'justify';
      }
    });

    let cleanHtml = tempDiv.innerHTML.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');

    // Remove parágrafos vazios criados pelo Word
    cleanHtml = cleanHtml.replace(/<p><\/p>/g, '').replace(/<p>\s*<\/p>/g, '');

    document.execCommand('insertHTML', false, cleanHtml);
    handleEditorInput();
  };

  const handleConfigurarEstilos = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Configurar Estilos Prontos',
      width: 650,
      html: `
        <div style="text-align: left; font-size: 14px; display: grid; gap: 0.8rem; margin-top: 10px; max-height: 65vh; overflow-y: auto; padding-right: 10px;">
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Título do Documento (H1)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Tamanho: <input id="h1-size" type="number" value="${estilos.h1.size}" style="width: 50px; padding: 4px;"> pt</span>
              <span>Recuo Esq.: <input id="h1-indent" type="number" value="${estilos.h1.indent}" style="width: 50px; padding: 4px;"> px</span>
              <label><input id="h1-bold" type="checkbox" ${estilos.h1.bold ? 'checked' : ''}> Negrito</label>
              <label><input id="h1-upper" type="checkbox" ${estilos.h1.uppercase ? 'checked' : ''}> Maiúsculo</label>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Cláusula Principal (H2)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Tamanho: <input id="h2-size" type="number" value="${estilos.h2.size}" style="width: 50px; padding: 4px;"> pt</span>
              <span>Recuo Esq.: <input id="h2-indent" type="number" value="${estilos.h2.indent}" style="width: 50px; padding: 4px;"> px</span>
              <label><input id="h2-bold" type="checkbox" ${estilos.h2.bold ? 'checked' : ''}> Negrito</label>
              <label><input id="h2-upper" type="checkbox" ${estilos.h2.uppercase ? 'checked' : ''}> Maiúsculo</label>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Sub-cláusula (H3)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Tamanho: <input id="h3-size" type="number" value="${estilos.h3.size}" style="width: 50px; padding: 4px;"> pt</span>
              <span>Recuo Esq.: <input id="h3-indent" type="number" value="${estilos.h3.indent}" style="width: 50px; padding: 4px;"> px</span>
              <label><input id="h3-bold" type="checkbox" ${estilos.h3.bold ? 'checked' : ''}> Negrito</label>
              <label><input id="h3-upper" type="checkbox" ${estilos.h3.uppercase ? 'checked' : ''}> Maiúsculo</label>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Texto Normal (P)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Tamanho: <input id="p-size" type="number" value="${estilos.p.size}" style="width: 50px; padding: 4px;"> pt</span>
              <span>Recuo Esq.: <input id="p-indent" type="number" value="${estilos.p.indent}" style="width: 50px; padding: 4px;"> px</span>
              <span>Recuo 1ª Linha (Parágrafo): <input id="p-firstline" type="number" value="${estilos.p.firstLine}" style="width: 50px; padding: 4px;"> px</span>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Listas e Tópicos (Bullets)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Recuo Esquerdo Geral: <input id="list-indent" type="number" value="${estilos.list.indent}" style="width: 50px; padding: 4px;"> px</span>
              <span>Espaço entre itens: <input id="list-spacing" type="number" value="${estilos.list.spacing}" style="width: 50px; padding: 4px;"> px</span>
            </div>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Salvar Estilos',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        return {
          h1: {
            size: Number((document.getElementById('h1-size') as HTMLInputElement).value),
            indent: Number((document.getElementById('h1-indent') as HTMLInputElement).value),
            bold: (document.getElementById('h1-bold') as HTMLInputElement).checked,
            uppercase: (document.getElementById('h1-upper') as HTMLInputElement).checked,
          },
          h2: {
            size: Number((document.getElementById('h2-size') as HTMLInputElement).value),
            indent: Number((document.getElementById('h2-indent') as HTMLInputElement).value),
            bold: (document.getElementById('h2-bold') as HTMLInputElement).checked,
            uppercase: (document.getElementById('h2-upper') as HTMLInputElement).checked,
          },
          h3: {
            size: Number((document.getElementById('h3-size') as HTMLInputElement).value),
            indent: Number((document.getElementById('h3-indent') as HTMLInputElement).value),
            bold: (document.getElementById('h3-bold') as HTMLInputElement).checked,
            uppercase: (document.getElementById('h3-upper') as HTMLInputElement).checked,
          },
          p: {
            size: Number((document.getElementById('p-size') as HTMLInputElement).value),
            indent: Number((document.getElementById('p-indent') as HTMLInputElement).value),
            firstLine: Number((document.getElementById('p-firstline') as HTMLInputElement).value),
          },
          list: {
            indent: Number((document.getElementById('list-indent') as HTMLInputElement).value),
            spacing: Number((document.getElementById('list-spacing') as HTMLInputElement).value),
          }
        }
      }
    });

    if (formValues) {
      setEstilos(formValues);
      localStorage.setItem('ruth_dias_estilos_v1', JSON.stringify(formValues));
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Estilos atualizados em todo o documento!', showConfirmButton: false, timer: 3000 });
    }
  };

  const handleApplyData = () => {
    if (!editorRef.current) return;

    let html = editorRef.current.innerHTML;
    const cliente = clientes.find(c => c.id === selectedCliente);
    const imovel = imoveis.find(i => i.id === selectedImovel);

    if (cliente) {
      html = html.replace(/{NOME_CLIENTE}/g, `<strong>${cliente.name}</strong>`);
    }
    if (imovel) {
      html = html.replace(/{NOME_IMOVEL}/g, `<strong>${imovel.title}</strong>`);
    }

    editorRef.current.innerHTML = html;
    setPreviewHtml(html);

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Dados aplicados ao contrato!',
      showConfirmButton: false,
      timer: 2000
    });
  };

  // Aplica dados automaticamente
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedCliente || selectedImovel) {
        handleApplyData();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedCliente, selectedImovel]);


  const handleNovoContrato = async () => {
    if (!tituloContrato || !tituloContrato.trim()) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, informe o Título do Contrato antes de prosseguir.', confirmButtonColor: 'var(--primary-color)' });
      return;
    }
    
    let clienteFinal = selectedCliente;
    let clienteNomeFinal = selectedCliente;
    
    const clienteObj = clientes.find(c => c.id === selectedCliente || c.name === selectedCliente);
    if (clienteObj) {
      clienteFinal = clienteObj.id;
      clienteNomeFinal = clienteObj.name;
    }

    const valorNumerico = valorContrato ? parseFloat(valorContrato.replace(/[^0-9,-]+/g, "").replace(",", ".")) : 0;

    const imovelObj = imoveis.find(i => i.id === selectedImovel);

    // Salvar no sistema primeiro
    if (onSaveContrato) {
      await onSaveContrato({
        clienteId: clienteFinal,
        clienteNome: clienteNomeFinal,
        imovelId: selectedImovel,
        imovel: imovelObj?.title || '',
        valor: valorNumerico,
        titulo: tituloContrato,
        dataAssinatura,
        status: statusContrato,
        tipo: tipoContrato,
        conteudoHtml: editorRef.current ? editorRef.current.innerHTML : ''
      });
      Swal.fire({ icon: 'success', title: 'Contrato Salvo', text: 'Registrado no sistema com sucesso!', timer: 1500, showConfirmButton: false });
    }

    // Preparar documentos anexos
    let htmlAnexos = '';
    if (anexarDocs && clienteObj && clienteObj.documents && clienteObj.documents.length > 0) {
      htmlAnexos += '<div style="page-break-before: always; font-family: Arial; padding: 40px;">';
      htmlAnexos += '<h2 style="text-align: center; margin-bottom: 30px;">ANEXOS - DOCUMENTOS DO CLIENTE</h2>';
      clienteObj.documents.forEach(doc => {
        if (doc.type && doc.type.startsWith('image/')) {
          htmlAnexos += `<div style="margin-bottom: 40px; text-align: center;">
            <p style="font-weight: bold; margin-bottom: 10px;">${doc.name}</p>
            <img src="${doc.content}" style="max-width: 100%; max-height: 800px; border: 1px solid #ccc;" />
          </div>`;
        } else {
          // PDFs não podem ser anexados num window.print(), avisa no html
          htmlAnexos += `<p style="margin-bottom: 10px;">[ ${doc.name} (Arquivo PDF/DOC) - Acesse o sistema para baixar ]</p>`;
        }
      });
      htmlAnexos += '</div>';
    }

    // Agora imprimir (com os anexos incluídos dinamicamente)
    if (editorRef.current) {
      let content = editorRef.current.innerHTML;
      if (viewHtml) {
        content = previewHtml;
      }

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.write(`
          <html>
            <head>
              <title>Contrato - ${clienteObj?.name}</title>
              <style>
                @page {
                  size: A4;
                  margin: 0;
                }
                body {
                  margin: 0;
                  font-family: Arial, sans-serif;
                  background: white;
                }
                .header {
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100%;
                  z-index: 100;
                }
                .footer {
                  position: fixed;
                  bottom: 0;
                  left: 0;
                  width: 100%;
                  z-index: 100;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                }
                /* Espaçadores invisíveis para proteger a área do topo e base em todas as páginas */
                thead td {
                  height: 160px;
                }
                tfoot td {
                  height: 120px;
                }
                .content-cell {
                  padding: 0 20mm;
                  font-size: 11pt;
                  line-height: 1.5;
                  text-align: justify;
                  vertical-align: top;
                }
                .content-cell h1 { font-size: ${estilos.h1.size}pt !important; margin-left: ${estilos.h1.indent}px !important; font-weight: ${estilos.h1.bold ? 'bold' : 'normal'} !important; text-align: center; margin-top: 15px; margin-bottom: 15px; text-transform: ${estilos.h1.uppercase ? 'uppercase' : 'none'} !important; }
                .content-cell h2 { font-size: ${estilos.h2.size}pt !important; margin-left: ${estilos.h2.indent}px !important; font-weight: ${estilos.h2.bold ? 'bold' : 'normal'} !important; margin-top: 15px; margin-bottom: 10px; text-transform: ${estilos.h2.uppercase ? 'uppercase' : 'none'} !important; }
                .content-cell h3 { font-size: ${estilos.h3.size}pt !important; margin-left: ${estilos.h3.indent}px !important; font-weight: ${estilos.h3.bold ? 'bold' : 'normal'} !important; margin-top: 12px; margin-bottom: 8px; text-transform: ${estilos.h3.uppercase ? 'uppercase' : 'none'} !important; }
                .content-cell h4 { font-size: 11pt; font-weight: bold; text-decoration: underline; margin: 10px 0 5px 0; }
                .content-cell p { font-size: ${estilos.p.size}pt !important; margin-left: ${estilos.p.indent}px !important; text-indent: ${estilos.p.firstLine}px !important; margin-top: 0; margin-bottom: 10px; text-align: justify; text-wrap: wrap !important; }
                .content-cell ul { padding-left: ${estilos.list.indent}px !important; list-style-type: disc !important; list-style-position: outside !important; }
                .content-cell ol { padding-left: ${estilos.list.indent}px !important; list-style-type: decimal !important; list-style-position: outside !important; }
                .content-cell li { margin-bottom: ${estilos.list.spacing}px !important; text-align: justify; }
              </style>
            </head>
            <body>
              <img class="header" src="${timbradoTopo}" />
              
              <table>
                <thead>
                  <tr><td></td></tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="content-cell">
                      ${content}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr><td></td></tr>
                </tfoot>
              </table>

              <img class="footer" src="${timbradoBase}" />
              
              ${htmlAnexos}
              
              <script>
                setTimeout(() => {
                  window.print();
                }, 800);
              </script>
            </body>
          </html>
        `);
        doc.close();
        
        // Remove the iframe after printing (giving it ample time to stay alive during the print dialog)
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 10000);
      }
    }
  };

  const handleFormatWithAI = async () => {
    let apiKey = localStorage.getItem('openai_api_key_ruthdias');
    
    if (!apiKey) {
      try {
        const res = await fetch('/api.php?key=ruth_dias_openai_key');
        const txt = await res.text();
        if (txt && txt.trim().length > 10 && !txt.startsWith('<')) {
          apiKey = txt.trim();
          localStorage.setItem('openai_api_key_ruthdias', apiKey);
        }
      } catch(e) {}
    }

    if (!apiKey) {
      Swal.fire({
        icon: 'warning',
        title: 'Chave de IA não encontrada',
        text: 'Por favor, configure sua chave da OpenAI no menu de configurações.'
      });
      return;
    }

    const { value: rawText, isConfirmed: textConfirmed } = await Swal.fire({
      title: 'Formatar com IA ✨',
      text: 'Cole abaixo o texto bruto do seu contrato. A IA irá formata-lo perfeitamente.',
      input: 'textarea',
      inputPlaceholder: 'Cole o texto do contrato aqui...',
      width: '80%',
      showCancelButton: true,
      confirmButtonText: 'Gerar Formatação',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      customClass: {
        input: 'swal-ia-textarea'
      }
    });

    if (!textConfirmed || !rawText || !rawText.trim()) return;

    Swal.fire({
      title: 'Processando com IA... ✨',
      text: 'Aguarde alguns segundos enquanto a inteligência artificial formata o documento...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const systemPrompt = `Você é um formatador profissional de contratos imobiliários em HTML.

Sua função é receber um contrato bruto sem formatação e devolver APENAS o HTML final, pronto para ser inserido em um editor rich text que aceita HTML.

O documento pertence ao escritório Ruth Dias Imóveis.

PADRÃO INSTITUCIONAL:
Quando Ruth Dias aparecer como corretora, intermediadora ou administradora, padronize como:
Ruth Dias, Corretora de Imóveis, inscrita no CRECI/DF nº 30.812.

REGRAS ABSOLUTAS DE SAÍDA:
- Responda somente com HTML.
- Não use markdown.
- Não use \\\`\\\`\\\`html.
- Não explique nada.
- Não adicione comentários.
- Não use <html>, <head>, <body>, <meta> ou <title>.
- O conteúdo deve começar diretamente com <h1>.
- Todo texto deve estar dentro de tags HTML.
- Nunca deixe texto solto fora de tags.
- Não use class, id, align ou dir.
- Use style somente para alinhamento da data e das assinaturas, conforme especificado abaixo.

ESTRUTURA PRINCIPAL:
- O título do documento deve ficar em uma única tag <h1>.
- O título dentro do <h1> deve ficar em caixa alta.
- Cláusulas principais devem ficar em <h2>.
- Toda cláusula deve ser unificada em uma única linha.
- Nunca separe “CLÁUSULA PRIMEIRA” de “DO OBJETO”.
- Exemplo correto:
<h2>CLÁUSULA PRIMEIRA – DO OBJETO</h2>
- Exemplo errado:
<h2>CLÁUSULA PRIMEIRA</h2>
<h3>DO OBJETO</h3>

QUALIFICAÇÃO DAS PARTES:
- Não transforme VENDEDOR, COMPRADOR, LOCADOR, LOCATÁRIO, PROPRIETÁRIO ou ADMINISTRADORA em <h2>.
- A qualificação das partes deve ficar sempre em parágrafos <p>.
- Use este padrão:

<p><strong>VENDEDOR:</strong> Nome completo, qualificação completa, doravante denominado simplesmente <strong>VENDEDOR</strong>.</p>

<p><strong>COMPRADOR:</strong> Nome completo, qualificação completa, doravante denominado simplesmente <strong>COMPRADOR</strong>.</p>

- Não crie títulos separados como:
<h2>VENDEDOR</h2>
<h2>COMPRADOR</h2>

Isso é proibido.

CLÁUSULAS:
- Toda cláusula deve estar em <h2>.
- Una o número/nome da cláusula com o tema.
- Exemplos:
<h2>CLÁUSULA PRIMEIRA – DO OBJETO</h2>
<h2>CLÁUSULA SEGUNDA – DO PREÇO</h2>
<h2>CLÁUSULA TERCEIRA – DA POSSE</h2>
<h2>CLÁUSULA QUARTA – DOS TRIBUTOS E ENCARGOS</h2>
<h2>CLÁUSULA QUINTA – DA COMISSÃO DE CORRETAGEM</h2>
<h2>CLÁUSULA SEXTA – DAS DECLARAÇÕES DO VENDEDOR</h2>
<h2>CLÁUSULA SÉTIMA – DA IRREVOGABILIDADE</h2>
<h2>CLÁUSULA OITAVA – DA MULTA</h2>
<h2>CLÁUSULA NONA – DAS DESPESAS DE TRANSFERÊNCIA</h2>
<h2>CLÁUSULA DÉCIMA – DO FORO</h2>

PARÁGRAFOS:
- Todo texto corrido deve ficar dentro de <p>.
- Não use <br> solto.
- Para espaçamento entre blocos, use:
<p><br></p>

NEGRITOS:
Use <strong> para destacar:
- VENDEDOR
- COMPRADOR
- LOCADOR
- LOCATÁRIO
- PROPRIETÁRIO
- ADMINISTRADORA
- INTERMEDIADORA
- CORRETORA
- valores
- percentuais
- prazos
- nomes das partes na qualificação inicial
- CPF, RG, CRECI e dados importantes quando necessário

Não transforme parágrafos inteiros em negrito.

LISTAS:
- Quando houver itens como I, II, III ou a), b), c), converta para lista HTML.
- Use <ol> para listas numeradas, romanas ou alfabéticas.
- Use <ul> para listas com marcadores.
- Cada item deve ficar dentro de <li>.
- Não use type, value ou atributos.
- Finalize os itens com ponto e vírgula, exceto o último, que termina com ponto.

Exemplo:
<ol>
  <li>As 04 (quatro) parcelas do IPTU/TLP referentes ao exercício de 2026, atualmente em aberto;</li>
  <li>A próxima taxa condominial vincenda, bem como todas as demais despesas condominiais que vencerem após a entrega da posse.</li>
</ol>

CORREÇÕES PERMITIDAS:
- Corrigir erros de digitação.
- Corrigir acentuação.
- Corrigir pontuação.
- Corrigir espaçamentos.
- Melhorar fluidez jurídica sem alterar o sentido.
- Padronizar CRECI.
- Padronizar Brasília/DF, Santa Maria/DF e demais cidades quando claramente identificadas.
- Corrigir “Paragrafo Unico” para “Parágrafo único”.
- Corrigir “multuo” para “mútuo”.
- Corrigir “dano as partes” para “dando as partes”, se o contexto indicar quitação.

DADOS SENSÍVEIS:
- Não altere nomes.
- Não altere CPFs.
- Não altere RGs.
- Não altere endereços.
- Não altere valores.
- Não altere datas.
- Não altere percentuais.
- Não invente dados.
- Quando faltar informação, use colchetes: [NOME], [CPF], [DATA], [VALOR].

ESPAÇAMENTO PADRÃO:
- Após a qualificação inicial das partes e antes da primeira cláusula, inserir:
<p><br></p>

- Após o conteúdo de cada cláusula, antes da próxima, inserir:
<p><br></p>

- Antes da data final, inserir:
<p><br></p>

ASSINATURAS:
A área final deve seguir exatamente este padrão visual:

<p style="text-align: right;">[CIDADE/UF], [DATA].</p><p style="text-align: right;"><br></p><p style="text-align: right;"><br></p>

<p style="text-align: center;"><strong>_____________________________________________________________________________</strong></p><p style="text-align: center;"><strong>VENDEDOR</strong></p>

<p style="text-align: center;">Nome do Vendedor - <span style="font-size: 11pt;">CPF: [CPF]</span></p>

<p style="text-align: center;"><br></p><p style="text-align: center;"><br></p><p style="text-align: center;"><strong>_____________________________________________________________________________</strong></p><p style="text-align: center;"><strong>COMPRADOR</strong></p>

<p style="text-align: center;">Nome do Comprador - <span style="font-size: 11pt;">CPF: [CPF]</span></p>

- Não use “Assinatura: ______”.
- Substitua “Assinatura: ______” por linha centralizada com underline.
- Cada pessoa deve ter sua própria linha de assinatura.
- Quando houver corretoras, criar assinaturas separadas.
- Para Ruth Dias, usar:
<p style="text-align: center;">Ruth Dias - <span style="font-size: 11pt;">CRECI/DF 30.812</span></p>

- Se houver outra corretora, preservar nome e CRECI informado.

TESTEMUNHAS:
- Se o texto disser que o contrato será assinado por duas testemunhas, mas não trouxer os dados delas, adicionar ao final:

<p style="text-align: center;"><br></p><p style="text-align: center;"><br></p><p style="text-align: center;"><strong>_____________________________________________________________________________</strong></p><p style="text-align: center;"><strong>TESTEMUNHA 1</strong></p>

<p style="text-align: center;">Nome: [NOME] - <span style="font-size: 11pt;">CPF: [CPF]</span></p>

<p style="text-align: center;"><br></p><p style="text-align: center;"><br></p><p style="text-align: center;"><strong>_____________________________________________________________________________</strong></p><p style="text-align: center;"><strong>TESTEMUNHA 2</strong></p>

<p style="text-align: center;">Nome: [NOME] - <span style="font-size: 11pt;">CPF: [CPF]</span></p>

MODELO OBRIGATÓRIO DE RESULTADO:
O HTML final deve seguir esta estrutura:

<h1>TÍTULO DO CONTRATO</h1>

<p>Pelo presente instrumento particular...</p>

<p><strong>VENDEDOR:</strong> Nome completo, qualificação completa, doravante denominado simplesmente <strong>VENDEDOR</strong>.</p>

<p><strong>COMPRADOR:</strong> Nome completo, qualificação completa, doravante denominado simplesmente <strong>COMPRADOR</strong>.</p>

<p>As partes resolvem celebrar o presente contrato, que será regido pelas cláusulas e condições seguintes.</p><p><br></p>

<h2>CLÁUSULA PRIMEIRA – DO OBJETO</h2>

<p>Texto da cláusula...</p><p><br></p>

<h2>CLÁUSULA SEGUNDA – DO PREÇO</h2>

<p>Texto da cláusula...</p><p><br></p>

<p>E por estarem assim justos e contratados, assinam o presente instrumento.</p><p><br></p>

<p style="text-align: right;">[CIDADE/UF], [DATA].</p><p style="text-align: right;"><br></p><p style="text-align: right;"><br></p>

<p style="text-align: center;"><strong>_____________________________________________________________________________</strong></p><p style="text-align: center;"><strong>VENDEDOR</strong></p>

<p style="text-align: center;">Nome - <span style="font-size: 11pt;">CPF: [CPF]</span></p>

INSTRUÇÃO FINAL:
Converta o contrato bruto recebido para HTML seguindo rigorosamente todas as regras acima. Retorne somente o HTML final.`;

      const userPrompt = `CONTRATO BRUTO:\n${rawText}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const err = await response.json();
        if (response.status === 401) {
          localStorage.removeItem('openai_api_key_ruthdias');
          throw new Error('Chave de API inválida ou revogada. Tente novamente.');
        }
        throw new Error(err.error?.message || 'Erro ao processar com a IA.');
      }

      const data = await response.json();
      let htmlOutput = data.choices[0].message.content
        .replace(/```html/g, '')
        .replace(/```/g, '')
        .trim();

      if (editorRef.current) {
        editorRef.current.innerHTML = htmlOutput;
        setPreviewHtml(htmlOutput);
      }

      Swal.fire({
        icon: 'success',
        title: 'Sucesso!',
        text: 'Contrato formatado com a IA.',
        timer: 2000,
        showConfirmButton: false
      });
      
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Ops!',
        text: error.message || 'Houve um erro de comunicação com a OpenAI.'
      });
    }
  };

  const handleSalvarNoSistema = async () => {
    if (!tituloContrato || !tituloContrato.trim()) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, informe o Título do Contrato antes de prosseguir.', confirmButtonColor: 'var(--primary-color)' });
      return;
    }

    let clienteFinal = selectedCliente;
    let clienteNomeFinal = selectedCliente;
    
    const clienteObj = clientes.find(c => c.id === selectedCliente || c.name === selectedCliente);
    if (clienteObj) {
      clienteFinal = clienteObj.id;
      clienteNomeFinal = clienteObj.name;
    }

    const valorNumerico = valorContrato ? parseFloat(valorContrato.replace(/[^0-9,-]+/g, "").replace(",", ".")) : 0;

    const imovelObj = imoveis.find(i => i.id === selectedImovel);

    if (onSaveContrato) {
      await onSaveContrato({
        clienteId: clienteFinal,
        clienteNome: clienteNomeFinal,
        imovelId: selectedImovel,
        imovel: imovelObj?.title || '',
        valor: valorNumerico,
        titulo: tituloContrato,
        dataAssinatura,
        status: statusContrato,
        tipo: tipoContrato,
        conteudoHtml: editorRef.current ? editorRef.current.innerHTML : ''
      });
      Swal.fire({ icon: 'success', title: 'Contrato Salvo', text: 'Registrado no sistema com sucesso!', timer: 1500, showConfirmButton: false });
    } else {
      Swal.fire({ icon: 'error', title: 'Erro', text: 'Função de salvar não está disponível.' });
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="gerador-modal-container" style={{ backgroundColor: '#f8fafc', width: showPreview ? '100vw' : '95%', maxWidth: showPreview ? '100vw' : '1400px', height: showPreview ? '100vh' : '90vh', borderRadius: showPreview ? '0' : '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', transition: 'all 0.3s' }}>

        {/* Header Modal */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={24} color="var(--primary-color)" />
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-color)' }}>Gerador de Contratos (Timbrado)</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <label className="gerador-header-preview-toggle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={showPreview} onChange={e => setShowPreview(e.target.checked)} style={{ width: '18px', height: '18px' }} />
              Ver Prévia Dividida
            </label>
            <div className="gerador-header-preview-toggle" style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-secondary)" /></button>
          </div>
        </div>

        <div className="gerador-main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Div oculto para medir a altura do conteúdo e calcular páginas */}
          <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
            <div
              ref={measureRef}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
              style={{
                width: 'calc(794px - 40mm)', // Largura exata da área de texto na folha A4
                padding: '10px',
                fontSize: '11pt',
                lineHeight: '1.5',
                textAlign: 'justify',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Sidebar / Controles */}
          <div className="gerador-sidebar" style={{ width: '320px', backgroundColor: '#f8fafc', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="gerador-sidebar-inner" style={{ flex: 1, padding: '1.25rem 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto' }}>
              <div style={{ backgroundColor: '#e2e8f0', padding: '0.75rem', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'var(--primary-color)' }}>Seus Modelos</h3>
                <select className="input" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }} value={selectedModeloId} onChange={e => handleLoadModelo(e.target.value)}>
                  <option value="">-- Contrato em Branco --</option>
                  {modelos.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={handleSaveModelo} style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}>
                  Salvar Atual como Modelo
                </button>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.2rem 0' }} />

            <div style={{ backgroundColor: '#f1f5f9', padding: '0.6rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)' }}>Vincular Cliente</label>
                <input 
                  type="text" 
                  className="input" 
                  autoComplete="off"
                  style={{ padding: '0.3rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} 
                  placeholder="Selecione ou digite um novo cliente..." 
                  value={selectedCliente} 
                  onChange={e => {
                    setSelectedCliente(e.target.value);
                    setShowClienteDropdown(true);
                  }}
                  onFocus={() => setShowClienteDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                />
                {showClienteDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '180px', overflowY: 'auto',
                    backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    {clientes.filter(c => c.name.toLowerCase().includes(selectedCliente.toLowerCase())).map((c, idx) => (
                      <div 
                        key={c.id + '-' + idx} 
                        style={{ padding: '0.5rem 0.8rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedCliente(c.name);
                          setShowClienteDropdown(false);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {c.name}
                      </div>
                    ))}
                    {selectedCliente.trim() !== '' && clientes.filter(c => c.name.toLowerCase().includes(selectedCliente.toLowerCase())).length === 0 && (
                      <div style={{ padding: '0.5rem 0.8rem', color: '#0284c7', fontSize: '0.85rem', backgroundColor: '#e0f2fe' }}>
                        <span style={{ fontWeight: 'bold' }}>+ Adicionar</span> "{selectedCliente}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)' }}>Vincular Imóvel</label>
                <select className="input" style={{ padding: '0.3rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} value={selectedImovel} onChange={e => setSelectedImovel(e.target.value)}>
                  <option value="">Selecione um imóvel...</option>
                  {imoveis.filter(i => i.source === 'particular').map(i => (
                    <option key={i.id} value={i.id}>{i.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
                  Título do Contrato <span style={{ color: 'red' }}>*</span>
                </label>
                <input type="text" className="input" style={{ padding: '0.3rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} placeholder="Ex: Termo de Entrega de Chaves" value={tituloContrato} onChange={e => setTituloContrato(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.2rem', fontWeight: '500', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tipo</label>
                    <select className="input" style={{ fontSize: '0.85rem', padding: '0.3rem', width: '100%', boxSizing: 'border-box' }} value={tipoContrato} onChange={e => setTipoContrato(e.target.value as any)}>
                      <option value="Venda">Venda</option>
                      <option value="Locação">Locação</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.2rem', fontWeight: '500', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status</label>
                    <select className="input" style={{ fontSize: '0.85rem', padding: '0.3rem', width: '100%', boxSizing: 'border-box' }} value={statusContrato} onChange={e => setStatusContrato(e.target.value as any)}>
                      <option value="Ativo">Ativo</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Encerrado">Encerrado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.2rem', fontWeight: '500', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Data da Assinatura</label>
                  <input type="date" className="input" style={{ fontSize: '0.85rem', padding: '0.3rem', width: '100%', boxSizing: 'border-box' }} value={dataAssinatura} onChange={e => setDataAssinatura(e.target.value)} />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.2rem', fontWeight: '500', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Valor do Contrato (R$)</label>
                  <input type="text" className="input" style={{ fontSize: '0.85rem', padding: '0.3rem', width: '100%', boxSizing: 'border-box' }} value={valorContrato} onChange={e => {
                    let v = e.target.value.replace(/\D/g, '');
                    if (v) {
                      v = (parseFloat(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                      setValorContrato('R$ ' + v);
                    } else {
                      setValorContrato('');
                    }
                  }} placeholder="Ex: R$ 350.000,00" />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  <input type="checkbox" checked={anexarDocs} onChange={e => setAnexarDocs(e.target.checked)} style={{ cursor: 'pointer', width: '14px', height: '14px', margin: 0 }} />
                  Anexar documentos do cliente no PDF
                </label>
              </div>

              <div style={{ flex: 1 }}></div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handleSalvarNoSistema} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold', backgroundColor: '#d4af37', borderColor: '#d4af37', color: 'white' }}>
                  <FileText size={18} /> Salvar no Sistema
                </button>

                <button className="btn btn-primary" onClick={handleNovoContrato} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold' }}>
                  <Printer size={18} /> Imprimir / Salvar PDF
                </button>
              </div>
            </div>
          </div>

          {/* Área do Editor */}
          <div className="gerador-editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#e2e8f0' }}>

            {/* Toolbar do Editor */}
            <div className="gerador-toolbar" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'white', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => handleFormat('undo')} className="editor-btn" title="Desfazer"><Undo size={18} /></button>
              <button onClick={() => handleFormat('redo')} className="editor-btn" title="Refazer"><Redo size={18} /></button>
              <button onClick={() => handleFormat('removeFormat')} className="editor-btn" title="Limpar Formatação Padrão"><Eraser size={18} /></button>
              <button onClick={handleFixWordBreaks} className="editor-btn" title="Corrigir Quebras do Word (Preserva Estilos)" style={{ color: 'var(--primary-color)' }}><Wand2 size={18} /></button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <button onClick={handleFormatWithAI} className="editor-btn" title="Formatar Contrato com IA (ChatGPT)" style={{ color: '#10b981', fontWeight: 'bold', gap: '0.3rem', padding: '0.4rem 0.8rem', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}>
                <Sparkles size={18} /> IA
              </button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <select onChange={async (e) => {
                const val = e.target.value;
                if (!val) return;

                if (val === 'CONFIG') {
                  handleConfigurarEstilos();
                  e.target.value = '';
                  return;
                }

                if (val === 'P') {
                  clearFormatting();
                } else {
                  document.execCommand('formatBlock', false, val);
                }

                e.target.value = '';
                editorRef.current?.focus();
                handleEditorInput();
              }} className="editor-select" title="Estilos de Texto" style={{ fontWeight: 'bold' }}>
                <option value="">Estilos Prontos...</option>
                <option value="P">Texto Normal</option>
                <option value="H1">Título do Documento</option>
                <option value="H2">Cláusula Principal</option>
                <option value="H3">Sub-cláusula</option>
                <option disabled>──────────</option>
                <option value="CONFIG">⚙️ Personalizar Estilos...</option>
              </select>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <select onChange={(e) => handleFormat('fontSize', e.target.value)} className="editor-select" title="Tamanho da Fonte" defaultValue="3">
                <option value="1">Tamanho 1 (Mínimo)</option>
                <option value="2">Tamanho 2 (Pequeno)</option>
                <option value="3">Tamanho 3 (Normal)</option>
                <option value="4">Tamanho 4 (Médio)</option>
                <option value="5">Tamanho 5 (Grande)</option>
                <option value="6">Tamanho 6 (Muito Grande)</option>
                <option value="7">Tamanho 7 (Gigante)</option>
              </select>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <button onClick={() => handleFormat('bold')} className="editor-btn" title="Negrito"><Bold size={18} /></button>
              <button onClick={() => handleFormat('italic')} className="editor-btn" title="Itálico"><Italic size={18} /></button>
              <button onClick={() => handleFormat('underline')} className="editor-btn" title="Sublinhado"><Underline size={18} /></button>
              <button onClick={() => handleFormat('strikethrough')} className="editor-btn" title="Tachado"><Strikethrough size={18} /></button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <button onClick={() => handleFormat('justifyLeft')} className="editor-btn" title="Alinhar à Esquerda"><AlignLeft size={18} /></button>
              <button onClick={() => handleFormat('justifyCenter')} className="editor-btn" title="Centralizar"><AlignCenter size={18} /></button>
              <button onClick={() => handleFormat('justifyRight')} className="editor-btn" title="Alinhar à Direita"><AlignRight size={18} /></button>
              <button onClick={() => handleFormat('justifyFull')} className="editor-btn" title="Justificar"><AlignJustify size={18} /></button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <button onClick={() => handleFormat('outdent')} className="editor-btn" title="Diminuir Recuo"><Outdent size={18} /></button>
              <button onClick={() => handleFormat('indent')} className="editor-btn" title="Aumentar Recuo"><Indent size={18} /></button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>
              <button onClick={() => setViewHtml(!viewHtml)} className="editor-btn" title="Editar Código HTML Nativo" style={{ color: viewHtml ? 'var(--primary-color)' : 'var(--text-secondary)', backgroundColor: viewHtml ? '#e0f2fe' : 'transparent' }}><Code size={18} /></button>

              <select onChange={handleListStyle} className="editor-select" title="Estilo de Lista (Bullets)">
                <option value="">Marcadores e Listas...</option>
                <option value="ul|disc">Bolinhas (Padrão)</option>
                <option value="ul|circle">Círculos Vazados</option>
                <option value="ul|square">Quadrados</option>
                <option value="ul|disclosure-open">Setas (▼)</option>
                <option value="ol|decimal">Números (1, 2, 3)</option>
                <option value="ol|lower-alpha">Letras Minusc. (a, b, c)</option>
                <option value="ol|upper-alpha">Letras Maiusc. (A, B, C)</option>
                <option value="ol|lower-roman">Romanos Minusc. (i, ii, iii)</option>
                <option value="ol|upper-roman">Romanos Maiusc. (I, II, III)</option>
              </select>
            </div>

            {/* Editor Central */}
            <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: 'white' }}>

              <div className="editor-page-wrapper" style={{
                width: '100%',
                maxWidth: '210mm',
                minHeight: '297mm',
                margin: '0 auto',
                backgroundColor: 'white',
                boxShadow: 'none',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Mostra as imagens no modo lado-a-lado para ficar igual à impressão */}
                <img src={timbradoTopo} alt="Topo" style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />

                {viewHtml && (
                  <textarea
                    ref={(el) => {
                      if (el) {
                        setTimeout(() => {
                          el.style.height = '1px';
                          el.style.height = `${el.scrollHeight + 20}px`;
                        }, 0);
                      }
                    }}
                    value={previewHtml}
                    onChange={(e) => {
                      setPreviewHtml(e.target.value);
                      e.target.style.height = '1px';
                      e.target.style.height = `${e.target.scrollHeight + 20}px`;
                      if (editorRef.current) {
                        editorRef.current.innerHTML = e.target.value;
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '20px 20mm', // Voltou ao normal
                      outline: 'none',
                      fontSize: '10pt',
                      fontFamily: 'monospace',
                      lineHeight: '1.5',
                      minHeight: '400px',
                      color: '#334155',
                      backgroundColor: '#f8fafc',
                      border: 'none',
                      resize: 'none',
                      overflow: 'hidden',
                      boxSizing: 'border-box'
                    }}
                    spellCheck={false}
                  />
                )}

                <div
                  ref={editorRef}
                  className="editor-content"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  onPaste={handlePaste}
                  style={{
                    display: viewHtml ? 'none' : 'block',
                    padding: '20px 20mm', // Voltou ao normal
                    flex: 1,
                    outline: 'none',
                    fontSize: '11pt',
                    lineHeight: '1.5',
                    textAlign: 'justify',
                    minHeight: '200px',
                    color: '#000000',
                    wordWrap: 'break-word'
                  }}
                />

                <img src={timbradoBase} alt="Base" style={{ width: '100%', display: 'block', pointerEvents: 'none', marginTop: 'auto' }} />
              </div>

            </div>
          </div>

          {/* Painel Direito: Prévia Dividida */}
          {showPreview && (
            <div className="gerador-preview" style={{ width: '450px', backgroundColor: '#e2e8f0', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontWeight: '500', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Printer size={18} /> Prévia da Impressão
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{totalPages} página{totalPages > 1 ? 's' : ''}</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Container com largura fixa escalada para economizar espaço */}
                <div style={{ width: '476px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '794px', transform: 'scale(0.6)', transformOrigin: 'top center', display: 'flex', flexDirection: 'column', gap: '40px', marginBottom: `calc(-40% * ${totalPages * 1123}px)` }}>

                    {Array.from({ length: totalPages }).map((_, i) => (
                      <div key={i} style={{
                        width: '794px',
                        height: '1123px',
                        backgroundColor: 'white',
                        boxShadow: '0 15px 35px rgba(0,0,0,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      }}>
                        {/* Topo fixo de 160px para cada página */}
                        <img src={timbradoTopo} alt="Topo" style={{ height: '160px', width: '100%', objectFit: 'contain', pointerEvents: 'none' }} />

                        {/* Área central com altura exata de 843px e overflow hidden cortando o conteúdo perfeitamente */}
                        <div style={{ height: '843px', overflow: 'hidden', margin: '0 20mm' }}>
                          <div
                            className="editor-content"
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                            style={{
                              marginTop: `-${i * 843}px`, /* O pulo do gato: puxa o conteúdo pra cima baseado na página atual! */
                              padding: '10px',
                              fontSize: '11pt',
                              lineHeight: '1.5',
                              textAlign: 'justify',
                              color: 'black'
                            }}
                          />
                        </div>

                        {/* Rodapé fixo de 120px para cada página */}
                        <img src={timbradoBase} alt="Base" style={{ height: '120px', width: '100%', objectFit: 'contain', pointerEvents: 'none', marginTop: 'auto' }} />
                      </div>
                    ))}

                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      <style>{`
        .editor-btn {
          background: white;
          border: 1px solid transparent;
          border-radius: 4px;
          padding: 0.4rem;
          cursor: pointer;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .editor-btn:hover {
          background: #f1f5f9;
          color: var(--primary-color);
          border-color: #cbd5e1;
        }
        .editor-select {
          padding: 0.4rem;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          outline: none;
          color: var(--text-secondary);
          background: white;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .editor-select:hover {
          border-color: #cbd5e1;
        }

        .swal-ia-textarea {
          min-height: 300px !important;
          font-family: monospace;
          font-size: 14px;
        }
        
        /* Estilos Dinâmicos dos blocos de texto no editor e prévia baseados na configuração */
        .editor-content h1 { font-size: ${estilos.h1.size}pt !important; margin-left: ${estilos.h1.indent}px !important; font-weight: ${estilos.h1.bold ? 'bold' : 'normal'} !important; text-align: center; margin-top: 15px; margin-bottom: 15px; text-transform: ${estilos.h1.uppercase ? 'uppercase' : 'none'} !important; }
        .editor-content h2 { font-size: ${estilos.h2.size}pt !important; margin-left: ${estilos.h2.indent}px !important; font-weight: ${estilos.h2.bold ? 'bold' : 'normal'} !important; margin-top: 15px; margin-bottom: 10px; text-transform: ${estilos.h2.uppercase ? 'uppercase' : 'none'} !important; }
        .editor-content h3 { font-size: ${estilos.h3.size}pt !important; margin-left: ${estilos.h3.indent}px !important; font-weight: ${estilos.h3.bold ? 'bold' : 'normal'} !important; margin-top: 12px; margin-bottom: 8px; text-transform: ${estilos.h3.uppercase ? 'uppercase' : 'none'} !important; }
        .editor-content h4 { font-size: 11pt; font-weight: bold; text-decoration: underline; margin: 10px 0 5px 0; }
        .editor-content p { font-size: ${estilos.p.size}pt !important; margin-left: ${estilos.p.indent}px !important; text-indent: ${estilos.p.firstLine}px !important; margin-top: 0; margin-bottom: 10px; text-align: justify; text-wrap: wrap !important; }
        .editor-content ul { padding-left: ${estilos.list.indent}px !important; list-style-type: disc !important; list-style-position: outside !important; }
        .editor-content ol { padding-left: ${estilos.list.indent}px !important; list-style-type: decimal !important; list-style-position: outside !important; }
        .editor-content li { margin-bottom: ${estilos.list.spacing}px !important; text-align: justify; display: list-item !important; }

        @media (max-width: 768px) {
          .gerador-modal-container {
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            border-radius: 0 !important;
          }
          .gerador-main-content {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .gerador-sidebar {
            width: 100% !important;
            border-left: none !important;
            border-bottom: 1px solid var(--border-color) !important;
          }
          .gerador-sidebar-inner {
            overflow-y: visible !important;
          }
          .gerador-editor {
            width: 100% !important;
            overflow-y: visible !important;
          }
          .gerador-toolbar {
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            -webkit-overflow-scrolling: touch;
          }
          .editor-page-wrapper {
            min-height: auto !important;
            padding: 10px !important;
          }
          .editor-content {
            padding: 10px !important;
          }
          .gerador-header-preview-toggle {
            display: none !important;
          }
          .gerador-preview {
            display: none !important;
          }
          .gerador-pdf-desktop-btn {
            display: none !important;
          }
          .gerador-pdf-mobile-btn {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
