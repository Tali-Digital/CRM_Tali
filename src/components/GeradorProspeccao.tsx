import React, { useState, useRef, useEffect } from 'react';
import { addProspeccaoDoc, updateProspeccaoDoc, subscribeToModelosProspeccao, addModeloProspeccao, updateModeloProspeccao, deleteModeloProspeccao, getGlobalSettings } from '../services/firestoreService';
import { EditorProspeccaoDoc, ModeloProspeccao } from '../types';
import { X, Printer, FileText, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo, Redo, Eraser, Indent, Outdent, Wand2, Code, Sparkles, Image as ImageIcon, Scissors } from 'lucide-react';
import Swal from 'sweetalert2';

interface GeradorProspeccaoProps {
  onClose: () => void;
  clientes: { id: string; name: string; documents?: any[] }[];
  imoveis: { id: string; title: string; source: string }[];
  onSaveProspeccao?: (prospeccao: any) => Promise<void>;
  prospeccaoParaEditar?: any;
}

export default function GeradorProspeccao({ onClose, clientes, imoveis, onSaveProspeccao, prospeccaoParaEditar }: GeradorProspeccaoProps) {
  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedImovel, setSelectedImovel] = useState('');
  
  // Novos campos para salvar o prospeccao
  const [tituloProspeccao, setTituloProspeccao] = useState('');
  const [tipoProspeccao, setTipoProspeccao] = useState<'Venda' | 'Locação'>('Venda');
  const [statusProspeccao, setStatusProspeccao] = useState<'Ativo' | 'Pendente' | 'Encerrado'>('Ativo');
  const [dataAssinatura, setDataAssinatura] = useState(new Date().toISOString().split('T')[0]);
  const [valorProspeccao, setValorProspeccao] = useState('');
  const [anexarDocs, setAnexarDocs] = useState(false);

  const handleInsertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Url = event.target?.result;
          if (base64Url) {
            document.execCommand('insertHTML', false, `<img src="${base64Url}" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />`);
            editorRef.current?.focus();
            handleEditorInput();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  // Preencher os dados caso esteja editando um prospeccao existente
  useEffect(() => {
    if (prospeccaoParaEditar) {
      if (prospeccaoParaEditar.clienteNome || prospeccaoParaEditar.clienteId) {
        setSelectedCliente(prospeccaoParaEditar.clienteNome || prospeccaoParaEditar.clienteId);
      }
      if (prospeccaoParaEditar.imovelId) {
        setSelectedImovel(prospeccaoParaEditar.imovelId);
      }
      if (prospeccaoParaEditar.tipo) setTipoProspeccao(prospeccaoParaEditar.tipo);
      if (prospeccaoParaEditar.titulo) setTituloProspeccao(prospeccaoParaEditar.titulo);
      if (prospeccaoParaEditar.status) setStatusProspeccao(prospeccaoParaEditar.status);
      if (prospeccaoParaEditar.dataAssinatura) setDataAssinatura(prospeccaoParaEditar.dataAssinatura);
      if (prospeccaoParaEditar.valor) {
        const v = (parseFloat(prospeccaoParaEditar.valor)).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        setValorProspeccao('R$ ' + v);
      }
      if (prospeccaoParaEditar.conteudoHtml && editorRef.current) {
        editorRef.current.innerHTML = prospeccaoParaEditar.conteudoHtml;
        setPreviewHtml(prospeccaoParaEditar.conteudoHtml);
      }
    }
  }, [prospeccaoParaEditar]);

  const [selectedModeloId, setSelectedModeloId] = useState('');
  const [modelos, setModelos] = useState<ModeloProspeccao[]>([]);
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
    list: { indent: 40, spacing: 5 },
    page: { top: 20, right: 20, bottom: 20, left: 20 }
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // Conteúdo inicial genérico
  const conteudoInicial = `PROSPECÇÃO EM BRANCO

(Escreva ou cole o texto do seu prospeccao aqui)
`;

  useEffect(() => {
    // Carregar modelos salvos
    const unsubscribe = subscribeToModelosProspeccao(setModelos);
    return () => unsubscribe();

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
          list: parsed.list || { indent: 40, spacing: 5 },
          page: parsed.page || { top: 20, right: 20, bottom: 20, left: 20 }
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
      text: 'Digite o nome deste modelo (ex: Prospeccao de Locação Padrão):',
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

      const modelId = modelos[existingModelIndex].id;
      await updateModeloProspeccao(modelId, { conteudo: html });
      newSelectedId = modelId;
    } else {
      newSelectedId = await addModeloProspeccao({
        nome,
        conteudo: html
      });
    }

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
    } else if (command === 'pageBreak') {
      const html = '<hr class="page-break" style="page-break-after: always; border: none; border-top: 2px dashed #ef4444; margin: 40px 0; opacity: 0.5;" title="Quebra de Página" />';
      document.execCommand('insertHTML', false, html);
      editorRef.current?.focus();
      handleEditorInput();
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

  const handleEditorClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLImageElement) {
      const img = e.target;
      Swal.fire({
        title: 'Ajustar Imagem',
        html: `
          <div style="text-align: left; font-size: 0.95rem; display: flex; flex-direction: column; gap: 1.5rem; padding: 0.5rem;">
            
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label style="font-weight: 700; color: #475569; display: flex; align-items: center; justify-content: space-between;">
                Largura da Imagem
                <span style="font-size: 0.75rem; font-weight: 400; color: #94a3b8;">Ex: 150 (para px) ou 50%</span>
              </label>
              <input id="swal-img-width" 
                class="swal2-input" 
                style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 0.75rem; border: 2px solid #e2e8f0; padding: 0.75rem 1rem; font-size: 1rem; color: #334155;"
                value="${img.style.width || img.width}" 
                placeholder="Ex: 300, 100%, 50vw"
                onkeydown="if(event.key === 'Enter') Swal.clickConfirm()"
              >
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label style="font-weight: 700; color: #475569;">Alinhamento na Página</label>
              <select id="swal-img-align" 
                class="swal2-select" 
                style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 0.75rem; border: 2px solid #e2e8f0; padding: 0.75rem 1rem; font-size: 0.95rem; color: #334155;"
                onkeydown="if(event.key === 'Enter') Swal.clickConfirm()"
              >
                <option value="none">Padrão (Na linha do texto)</option>
                <option value="left" ${img.style.float === 'left' ? 'selected' : ''}>Flutuar à Esquerda</option>
                <option value="right" ${img.style.float === 'right' ? 'selected' : ''}>Flutuar à Direita</option>
                <option value="center" ${img.style.display === 'block' && (img.style.margin === '0px auto' || img.style.margin === '0 auto') ? 'selected' : ''}>Centralizado (Quebra linha)</option>
                <option value="absolute_bottom" ${img.style.position === 'absolute' && img.style.bottom === '0px' ? 'selected' : ''}>Fixo no Rodapé (Ultrapassa Margem)</option>
              </select>
            </div>

          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Aplicar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--primary-color)',
        cancelButtonColor: '#94a3b8',
        customClass: {
          container: 'sweet-image-modal',
          title: 'text-2xl font-black text-stone-800'
        },
        preConfirm: () => {
          let width = (document.getElementById('swal-img-width') as HTMLInputElement).value.trim();
          
          if (/^\d+$/.test(width)) {
            width = width + 'px';
          }

          return {
            width: width,
            align: (document.getElementById('swal-img-align') as HTMLSelectElement).value
          }
        }
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          const { width, align } = result.value;
          if (width) {
            img.style.width = width;
            img.style.height = 'auto';
          }
          
          if (align === 'absolute_bottom') {
            img.style.display = 'block';
            img.style.position = 'absolute';
            img.style.bottom = '0px';
            img.style.left = '0px';
            img.style.width = '100%';
            img.style.margin = '0';
            img.style.float = 'none';
          } else if (align === 'center') {
            img.style.position = 'static';
            img.style.display = 'block';
            img.style.margin = '0 auto';
            img.style.float = 'none';
          } else if (align === 'left') {
            img.style.position = 'static';
            img.style.display = 'inline-block';
            img.style.margin = '0 15px 15px 0';
            img.style.float = 'left';
          } else if (align === 'right') {
            img.style.position = 'static';
            img.style.display = 'inline-block';
            img.style.margin = '0 0 15px 15px';
            img.style.float = 'right';
          } else {
            img.style.position = 'static';
            img.style.display = 'inline-block';
            img.style.margin = '0';
            img.style.float = 'none';
          }
          handleEditorInput();
        }
      });
    }
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

  // Tratamento automático ao colar do Word e Imagens
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;

    // Suporte para colar imagens diretamente
    const items = clipboardData.items;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Url = event.target?.result;
            if (base64Url) {
              document.execCommand('insertHTML', false, `<img src="${base64Url}" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />`);
            }
          };
          reader.readAsDataURL(blob);
          hasImage = true;
        }
      }
    }
    if (hasImage) return;

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
    
    // Garante que imagens do HTML não quebrem
    const finalDiv = document.createElement('div');
    finalDiv.innerHTML = cleanHtml;
    finalDiv.querySelectorAll('img').forEach(img => {
      img.style.maxWidth = '100%';
      img.style.borderRadius = '8px';
      img.style.margin = '10px 0';
    });

    document.execCommand('insertHTML', false, finalDiv.innerHTML);
    handleEditorInput();
  };

  // Suporte a arrastar e soltar imagens
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      for (let i = 0; i < dt.files.length; i++) {
        const file = dt.files[i];
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Url = event.target?.result;
            if (base64Url) {
              document.execCommand('insertHTML', false, `<img src="${base64Url}" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />`);
              handleEditorInput();
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
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
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Margens do Documento (em mm)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Topo: <input id="page-top" type="number" value="${estilos.page.top}" style="width: 50px; padding: 4px;"></span>
              <span>Direita: <input id="page-right" type="number" value="${estilos.page.right}" style="width: 50px; padding: 4px;"></span>
              <span>Baixo: <input id="page-bottom" type="number" value="${estilos.page.bottom}" style="width: 50px; padding: 4px;"></span>
              <span>Esquerda: <input id="page-left" type="number" value="${estilos.page.left}" style="width: 50px; padding: 4px;"></span>
            </div>
            <p style="font-size: 0.8rem; color: #64748b; margin-top: 8px;">Para uma imagem ultrapassar as margens ou colar no rodapé da página, zere a margem correspondente.</p>
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
          },
          page: {
            top: Number((document.getElementById('page-top') as HTMLInputElement).value),
            right: Number((document.getElementById('page-right') as HTMLInputElement).value),
            bottom: Number((document.getElementById('page-bottom') as HTMLInputElement).value),
            left: Number((document.getElementById('page-left') as HTMLInputElement).value),
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
      title: 'Dados aplicados ao prospeccao!',
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


  const handleNovoProspeccao = async () => {
    if (!tituloProspeccao || !tituloProspeccao.trim()) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, informe o Título do Prospeccao antes de prosseguir.', confirmButtonColor: 'var(--primary-color)' });
      return;
    }
    
    let clienteFinal = selectedCliente;
    let clienteNomeFinal = selectedCliente;
    
    const clienteObj = clientes.find(c => c.id === selectedCliente || c.name === selectedCliente);
    if (clienteObj) {
      clienteFinal = clienteObj.id;
      clienteNomeFinal = clienteObj.name;
    }

    const valorNumerico = valorProspeccao ? parseFloat(valorProspeccao.replace(/[^0-9,-]+/g, "").replace(",", ".")) : 0;

    const imovelObj = imoveis.find(i => i.id === selectedImovel);

    // Salvar no sistema primeiro
    if (onSaveProspeccao) {
      await onSaveProspeccao({
        clienteId: clienteFinal,
        clienteNome: clienteNomeFinal,
        imovelId: selectedImovel,
        imovel: imovelObj?.title || '',
        valor: valorNumerico,
        titulo: tituloProspeccao,
        dataAssinatura,
        status: statusProspeccao,
        tipo: tipoProspeccao,
        conteudoHtml: editorRef.current ? editorRef.current.innerHTML : ''
      });
      Swal.fire({ icon: 'success', title: 'Prospeccao Salvo', text: 'Registrado no sistema com sucesso!', timer: 1500, showConfirmButton: false });
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
              <title>Prospeccao - ${clienteObj?.name}</title>
              <style>
                @page {
                  size: A4;
                  margin: ${estilos.page.top}mm ${estilos.page.right}mm ${estilos.page.bottom}mm ${estilos.page.left}mm;
                }
                body {
                  margin: 0;
                  font-family: Arial, sans-serif;
                  background: white;
                }
                .content-cell {
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
                
                /* Correção para imagens não vazarem no PDF e quebrarem formatação */
                .content-cell img { 
                  max-width: 100% !important; 
                  height: auto !important; 
                  page-break-inside: avoid;
                }
                
                /* Esconde hr de quebra de página visualmente no PDF para não aparecer a linha */
                .content-cell hr.page-break {
                  border: none !important;
                  margin: 0 !important;
                  opacity: 0 !important;
                }
              </style>
            </head>
            <body>
              <div class="content-cell">
                ${content}
              </div>
              
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
    const settings = await getGlobalSettings();
    const apiKey = settings?.key;

    if (!apiKey) {
      Swal.fire({
        icon: 'error',
        title: 'Chave não configurada',
        text: 'A chave da API do Gemini não foi encontrada. Configure-a na tela de Administração.',
      });
      return;
    }

    const { isConfirmed: textConfirmed } = await Swal.fire({
      title: 'Formatar com IA ✨',
      text: 'A IA irá organizar o diagnóstico e manter as imagens que você colou no editor. Deseja formatar o conteúdo atual?',
      showCancelButton: true,
      confirmButtonText: 'Gerar Formatação',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981'
    });

    if (!textConfirmed) return;
    
    const rawText = editorRef.current?.innerHTML || '';
    if (!rawText.trim()) {
      Swal.fire({ icon: 'warning', title: 'Editor vazio', text: 'Cole ou digite algo no editor primeiro.' });
      return;
    }

    Swal.fire({
      title: 'Processando com IA... ✨',
      text: 'Aguarde alguns segundos enquanto a inteligência artificial formata o documento...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const systemPrompt = `Você é um especialista em diagnósticos imobiliários e comerciais, formatando em HTML.

Sua função é receber um texto bruto ou HTML e devolver APENAS o HTML final, pronto para ser inserido em um editor rich text.

O documento pertence à Tali Agência (TALI SISTEMA DE GESTÃO).

REGRAS ABSOLUTAS DE SAÍDA:
- Responda somente com HTML.
- Não use markdown.
- Não use \`\`\`html.
- NÃO ALTERE, NÃO REMOVA E NÃO MODIFIQUE AS TAGS <img>. Mantenha os src base64 e estilos exatamente como vieram. Deixe as imagens no contexto apropriado.
- Não explique nada.
- Não adicione comentários.
- Não use <html>, <head>, <body>, <meta> ou <title>.
- O conteúdo deve começar diretamente com <h1>.
- Todo texto deve estar dentro de tags HTML.
- Nunca deixe texto solto fora de tags.
- Não use class, id, align ou dir.

ESTRUTURA PRINCIPAL:
- O título do diagnóstico deve ficar em uma única tag <h1>.
- O título dentro do <h1> deve ficar em caixa alta.
- Tópicos ou seções principais do diagnóstico devem ficar em <h2>.
- Subtópicos em <h3>.

PARÁGRAFOS E TEXTO:
- Todo texto corrido deve ficar dentro de <p>.
- Não use <br> solto, a menos que seja para quebra de linha em endereços.
- Para espaçamento entre blocos, use: <p><br></p>

NEGRITOS:
Use <strong> para destacar:
- Nomes de empresas, clientes ou parceiros
- Valores financeiros e percentuais
- Prazos importantes
- Conclusões chave ou alertas
Não transforme parágrafos inteiros em negrito.

LISTAS:
- Quando houver tópicos enumerados, converta para lista HTML.
- Use <ol> para listas numeradas.
- Use <ul> para listas com marcadores (bullet points).
- Cada item deve ficar dentro de <li>.

- Corrigir erros de digitação e gramática.
- Melhorar a coesão e clareza do texto (sem inventar dados).
- Estruturar parágrafos muito longos em tópicos mais legíveis.

DADOS SENSÍVEIS E IMAGENS:
- Não altere nomes, valores, datas ou dados.
- MANTENHA as tags <img> intocadas, na posição que façam mais sentido após a formatação do texto ao seu redor.

INSTRUÇÃO FINAL:
Converta o prospeccao bruto recebido para HTML seguindo rigorosamente todas as regras acima. Retorne somente o HTML final.`;

      const userPrompt = `PROSPECÇÃO BRUTO:\n${rawText}`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Erro ao processar com a IA.');
      }

      const data = await response.json();
      let htmlOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      htmlOutput = htmlOutput
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
        text: 'Prospecção formatada com a IA.',
        timer: 2000,
        showConfirmButton: false
      });
      
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Ops!',
        text: error.message || 'Houve um erro de comunicação com a IA Gemini.'
      });
    }
  };

  const handleSalvarNoSistema = async () => {
    if (!tituloProspeccao || !tituloProspeccao.trim()) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Por favor, informe o Título do Prospeccao antes de prosseguir.', confirmButtonColor: 'var(--primary-color)' });
      return;
    }

    let clienteFinal = selectedCliente;
    let clienteNomeFinal = selectedCliente;
    
    const clienteObj = clientes.find(c => c.id === selectedCliente || c.name === selectedCliente);
    if (clienteObj) {
      clienteFinal = clienteObj.id;
      clienteNomeFinal = clienteObj.name;
    }

    const valorNumerico = valorProspeccao ? parseFloat(valorProspeccao.replace(/[^0-9,-]+/g, "").replace(",", ".")) : 0;

    const imovelObj = imoveis.find(i => i.id === selectedImovel);

    if (onSaveProspeccao) {
      await onSaveProspeccao({
        clienteId: clienteFinal,
        clienteNome: clienteNomeFinal,
        imovelId: selectedImovel,
        imovel: imovelObj?.title || '',
        valor: valorNumerico,
        titulo: tituloProspeccao,
        dataAssinatura,
        status: statusProspeccao,
        tipo: tipoProspeccao,
        conteudoHtml: editorRef.current ? editorRef.current.innerHTML : ''
      });
      Swal.fire({ icon: 'success', title: 'Prospeccao Salvo', text: 'Registrado no sistema com sucesso!', timer: 1500, showConfirmButton: false });
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
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-color)' }}>Gerador de Prospecção</h2>
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
          <div className="gerador-sidebar" style={{ width: '320px', backgroundColor: 'var(--secondary-color)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="gerador-sidebar-inner" style={{ flex: 1, padding: '1.25rem 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'white' }}>Seus Modelos</h3>
                <select className="input" style={{ marginBottom: '0.5rem', fontSize: '0.9rem', backgroundColor: 'white', color: '#1e293b', padding: '0.4rem', borderRadius: '4px', width: '100%' }} value={selectedModeloId} onChange={e => handleLoadModelo(e.target.value)}>
                  <option value="">-- Prospeccao em Branco --</option>
                  {modelos.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={handleSaveModelo} style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}>
                  Salvar Atual como Modelo
                </button>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.2rem 0' }} />

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: '500', color: 'rgba(255,255,255,0.9)' }}>
                  Título da Prospecção <span style={{ color: '#ff6b6b' }}>*</span>
                </label>
                <input type="text" className="input" style={{ padding: '0.6rem', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', backgroundColor: 'white', color: '#1e293b', border: '1px solid transparent', borderRadius: '6px' }} placeholder="Ex: Prospecção Alpha" value={tituloProspeccao} onChange={e => setTituloProspeccao(e.target.value)} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500', fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' }}>Data da Prospecção</label>
                <input type="date" className="input" style={{ fontSize: '0.9rem', padding: '0.6rem', width: '100%', boxSizing: 'border-box', backgroundColor: 'white', color: '#1e293b', border: '1px solid transparent', borderRadius: '6px' }} value={dataAssinatura} onChange={e => setDataAssinatura(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}></div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handleSalvarNoSistema} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold', backgroundColor: 'white', borderColor: 'white', color: 'var(--secondary-color)' }}>
                  <FileText size={18} /> Salvar no Sistema
                </button>

                <button className="btn btn-primary" onClick={handleNovoProspeccao} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold', backgroundColor: 'var(--primary-color)', borderColor: 'var(--primary-color)', color: 'white' }}>
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

              <button onClick={handleFormatWithAI} className="editor-btn" title="Formatar Prospeccao com IA (ChatGPT)" style={{ color: '#10b981', fontWeight: 'bold', gap: '0.3rem', padding: '0.4rem 0.8rem', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}>
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
              <button onClick={handleInsertImage} className="editor-btn" title="Inserir Imagem por URL"><ImageIcon size={18} /></button>
              <button onClick={() => handleFormat('pageBreak')} className="editor-btn" title="Inserir Quebra de Página" style={{ color: '#ef4444' }}><Scissors size={18} /></button>

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
                {/* Sem logo no cabeçalho */}

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
                      padding: `${estilos.page.top}mm ${estilos.page.right}mm ${estilos.page.bottom}mm ${estilos.page.left}mm`,
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
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={handleEditorClick}
                  style={{
                    display: viewHtml ? 'none' : 'block',
                    padding: `${estilos.page.top}mm ${estilos.page.right}mm ${estilos.page.bottom}mm ${estilos.page.left}mm`,
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

                <div style={{ width: '100%', height: '20px', marginTop: 'auto' }}></div>
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
                        <div style={{ height: '80px', margin: '20px auto' }}></div>

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
                        <div style={{ height: '80px', width: '100%', marginTop: 'auto' }}></div>
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
