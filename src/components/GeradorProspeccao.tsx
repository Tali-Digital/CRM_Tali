import React, { useState, useRef, useEffect } from 'react';
import { subscribeToModelosProspeccao, addModeloProspeccao, updateModeloProspeccao, getGlobalSettings, updateProspeccaoDoc, updateProspect } from '../services/firestoreService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { ModeloProspeccao } from '../types';
import { X, Printer, FileText, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo, Redo, Eraser, Indent, Outdent, Wand2, Code, Sparkles, Image as ImageIcon, Scissors, Check, Edit2 } from 'lucide-react';
import Swal from 'sweetalert2';

interface GeradorProspeccaoProps {
  onClose: () => void;
  onSaveProspeccao?: (prospeccao: any) => Promise<void>;
  prospeccaoParaEditar?: any;
}

export default function GeradorProspeccao({ onClose, onSaveProspeccao, prospeccaoParaEditar }: GeradorProspeccaoProps) {
  const [donoClinica, setDonoClinica] = useState('');
  const [opcoesDono, setOpcoesDono] = useState<string[]>([]);
  const [clinica, setClinica] = useState('');
  const [dataProspeccao, setDataProspeccao] = useState(new Date().toISOString().split('T')[0]);
  const [cidadeBairro, setCidadeBairro] = useState('');
  const [enderecoCompleto, setEnderecoCompleto] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEntregue, setIsEntregue] = useState(false);

  const [selectedModeloId, setSelectedModeloId] = useState('');
  const [modelos, setModelos] = useState<ModeloProspeccao[]>([]);
  const [showPreview, setShowPreview] = useState(true);
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

  const conteudoInicial = `<p>Escreva ou cole o texto da sua prospecção aqui...</p>`;

  // Escutar a tecla ESC para fechar o editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Preencher dados ao editar
  useEffect(() => {
    if (prospeccaoParaEditar) {
      if (prospeccaoParaEditar.clienteNome) setDonoClinica(prospeccaoParaEditar.clienteNome);
      if (prospeccaoParaEditar.titulo) setClinica(prospeccaoParaEditar.titulo);
      if (prospeccaoParaEditar.dataAssinatura) setDataProspeccao(prospeccaoParaEditar.dataAssinatura);
      if (prospeccaoParaEditar.isEntregue) setIsEntregue(true);
      
      // Fetch live prospect data to ensure address and names are accurate
      if (prospeccaoParaEditar.clienteId) {
        getDoc(doc(db, 'prospects', prospeccaoParaEditar.clienteId)).then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            setCidadeBairro(data.location || '');
            setEnderecoCompleto(data.fullAddress || '');
            setClinica(data.clinicName || '');
            
            const rawOwner = data.ownerName || '';
            const parts = rawOwner.split(/,| e /i).map((s: string) => s.trim()).filter(Boolean);
            const options = Array.from(new Set([rawOwner, ...parts]));
            
            if (prospeccaoParaEditar.clienteNome) {
              const existingOption = options.find(opt => opt.toLowerCase() === prospeccaoParaEditar.clienteNome.toLowerCase());
              if (!existingOption) {
                options.push(prospeccaoParaEditar.clienteNome);
                setDonoClinica(prospeccaoParaEditar.clienteNome);
              } else {
                setDonoClinica(existingOption);
              }
            } else {
              setDonoClinica(rawOwner);
            }
            
            setOpcoesDono(options);
          } else {
            if (prospeccaoParaEditar.location) setCidadeBairro(prospeccaoParaEditar.location);
            if (prospeccaoParaEditar.fullAddress) setEnderecoCompleto(prospeccaoParaEditar.fullAddress);
          }
        });
      } else {
        if (prospeccaoParaEditar.location) setCidadeBairro(prospeccaoParaEditar.location);
        if (prospeccaoParaEditar.fullAddress) setEnderecoCompleto(prospeccaoParaEditar.fullAddress);
      }

      if (prospeccaoParaEditar.conteudoHtml && editorRef.current) {
        editorRef.current.innerHTML = prospeccaoParaEditar.conteudoHtml;
        setPreviewHtml(prospeccaoParaEditar.conteudoHtml);
      }
    }
  }, [prospeccaoParaEditar]);

  // Carregar modelos e estilos salvos
  useEffect(() => {
    const unsubscribe = subscribeToModelosProspeccao(setModelos);

    const savedEstilos = localStorage.getItem('tali_estilos_prospeccao_v1');
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
      editorRef.current.innerHTML = conteudoInicial;
      setPreviewHtml(conteudoInicial);
    }

    return () => unsubscribe();
  }, []);

  // Calcular número de páginas
  useEffect(() => {
    if (measureRef.current) {
      const height = measureRef.current.scrollHeight;
      setTotalPages(Math.max(1, Math.ceil(height / 843)));
    }
  }, [previewHtml]);

  const handleEditorInput = () => {
    if (editorRef.current) setPreviewHtml(editorRef.current.innerHTML);
  };

  const handleMarcarEntregue = async () => {
    if (!prospeccaoParaEditar || isSaving) return;
    setIsSaving(true);
    const newStatus = !isEntregue;
    try {
      await updateProspeccaoDoc(prospeccaoParaEditar.id, { isEntregue: newStatus });
      if (prospeccaoParaEditar.clienteId) {
        await updateProspect(prospeccaoParaEditar.clienteId, { isEntregue: newStatus });
      }
      setIsEntregue(newStatus);
      Swal.fire('Sucesso', newStatus ? 'Endereço marcado como entregue!' : 'Status de entrega revertido!', 'success');
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      Swal.fire('Erro', 'Não foi possível alterar o status de entrega.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Modelos ──────────────────────────────────────────────────────────────
  const handleSaveModelo = async () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const currentModel = modelos.find(m => m.id === selectedModeloId);

    const { value: nome } = await Swal.fire({
      title: 'Salvar Modelo',
      text: 'Digite o nome deste modelo:',
      input: 'text',
      inputValue: currentModel ? currentModel.nome : '',
      showCancelButton: true,
      confirmButtonText: 'Salvar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => { if (!value) return 'Você precisa digitar um nome!'; }
    });

    if (!nome) return;

    const existingIndex = modelos.findIndex(m => m.nome.trim().toLowerCase() === nome.trim().toLowerCase());
    let newSelectedId = '';

    if (existingIndex >= 0) {
      const { isConfirmed } = await Swal.fire({
        title: 'Modelo já existe',
        text: `Já existe um modelo chamado "${nome}". Deseja sobrescrevê-lo?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, sobrescrever',
        cancelButtonText: 'Cancelar'
      });
      if (!isConfirmed) return;
      await updateModeloProspeccao(modelos[existingIndex].id, { conteudo: html });
      newSelectedId = modelos[existingIndex].id;
    } else {
      newSelectedId = await addModeloProspeccao({ nome, conteudo: html });
    }

    Swal.fire({ title: 'Sucesso!', text: 'Modelo salvo!', icon: 'success', timer: 1500, showConfirmButton: false });
    setSelectedModeloId(newSelectedId);
  };

  const handleLoadModelo = (modeloId: string) => {
    setSelectedModeloId(modeloId);
    if (!modeloId) {
      if (editorRef.current) {
        editorRef.current.innerHTML = conteudoInicial;
        setPreviewHtml(conteudoInicial);
      }
      return;
    }
    const modelo = modelos.find(m => m.id === modeloId);
    if (modelo && editorRef.current) {
      editorRef.current.innerHTML = modelo.conteudo;
      setPreviewHtml(modelo.conteudo);
    }
  };

  // ── Editor ───────────────────────────────────────────────────────────────
  const clearFormatting = () => {
    document.execCommand('removeFormat', false, undefined);
    if (document.queryCommandState('insertOrderedList')) document.execCommand('insertOrderedList', false, undefined);
    if (document.queryCommandState('insertUnorderedList')) document.execCommand('insertUnorderedList', false, undefined);
    document.execCommand('formatBlock', false, 'P');
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
          parentElement.removeAttribute('type');
        }
        parentElement.querySelectorAll('*').forEach(el => {
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
      document.execCommand('insertHTML', false, '<hr class="page-break" style="page-break-after: always; border: none; border-top: 2px dashed #ef4444; margin: 40px 0; opacity: 0.5;" title="Quebra de Página" />');
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
    const [listTag, listStyle] = value.split('|');
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
    e.target.value = '';
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLImageElement) {
      const img = e.target;
      
      const scrollContainer = document.getElementById('editor-scroll-container');
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

      Swal.fire({
        title: 'Ajustar Imagem',
        html: `
          <div style="text-align: left; font-size: 0.95rem; display: flex; flex-direction: column; gap: 1.5rem; padding: 0.5rem;">
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label style="font-weight: 700; color: #475569;">Largura da Imagem <span style="font-size:0.75rem;font-weight:400;color:#94a3b8">Ex: 150 (px) ou 50%</span></label>
              <input id="swal-img-width" class="swal2-input" style="margin: 0; width: 100%; box-sizing: border-box;" value="${img.style.width || img.width}" placeholder="Ex: 300, 100%, 50vw">
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label style="font-weight: 700; color: #475569;">Alinhamento na Página</label>
              <select id="swal-img-align" class="swal2-select" style="margin: 0; width: 100%; box-sizing: border-box;">
                <option value="none">Padrão (Na linha do texto)</option>
                <option value="left" ${img.style.float === 'left' ? 'selected' : ''}>Flutuar à Esquerda</option>
                <option value="right" ${img.style.float === 'right' ? 'selected' : ''}>Flutuar à Direita</option>
                <option value="center" ${img.style.display === 'block' && img.style.margin.includes('auto') ? 'selected' : ''}>Centralizado</option>
                <option value="absolute_bottom" ${img.style.position === 'absolute' ? 'selected' : ''}>Fixo no Rodapé (Ultrapassa Margem)</option>
              </select>
            </div>
          </div>
        `,
        didOpen: () => {
          const input = document.getElementById('swal-img-width') as HTMLInputElement;
          const select = document.getElementById('swal-img-align') as HTMLSelectElement;
          
          if (input) {
            setTimeout(() => input.focus(), 100);
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') Swal.clickConfirm();
            });
          }
          if (select) {
            select.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') Swal.clickConfirm();
            });
          }
        },
        focusConfirm: false,
        returnFocus: false,
        showCancelButton: true,
        confirmButtonText: 'Aplicar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--primary-color)',
        preConfirm: () => {
          let width = (document.getElementById('swal-img-width') as HTMLInputElement).value.trim();
          if (/^\d+$/.test(width)) width = width + 'px';
          return { width, align: (document.getElementById('swal-img-align') as HTMLSelectElement).value };
        }
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          const { width, align } = result.value;
          if (width) { img.style.width = width; img.style.height = 'auto'; }
          if (align === 'absolute_bottom') {
            Object.assign(img.style, { display: 'block', position: 'absolute', bottom: '0px', left: '0px', width: '100%', margin: '0', float: 'none' });
          } else if (align === 'center') {
            Object.assign(img.style, { position: 'static', display: 'block', margin: '0 auto', float: 'none' });
          } else if (align === 'left') {
            Object.assign(img.style, { position: 'static', display: 'inline-block', margin: '0 15px 15px 0', float: 'left' });
          } else if (align === 'right') {
            Object.assign(img.style, { position: 'static', display: 'inline-block', margin: '0 0 15px 15px', float: 'right' });
          } else {
            Object.assign(img.style, { position: 'static', display: 'inline-block', margin: '0', float: 'none' });
          }
          handleEditorInput();
        }
        
        // Restore scroll position
        if (scrollContainer) {
          setTimeout(() => {
            scrollContainer.scrollTop = scrollTop;
          }, 10);
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
      tempDiv.querySelectorAll('*').forEach(el => {
        if (el instanceof HTMLElement) {
          const isBold = el.style.fontWeight === 'bold' || el.tagName === 'B' || el.tagName === 'STRONG' || parseInt(el.style.fontWeight) > 600;
          const isItalic = el.style.fontStyle === 'italic' || el.tagName === 'I' || el.tagName === 'EM';
          const isUnderline = el.style.textDecoration.includes('underline') || el.tagName === 'U';
          const isCenter = el.style.textAlign === 'center';
          const isRight = el.style.textAlign === 'right';
          const isJustify = el.style.textAlign === 'justify';
          el.removeAttribute('class'); el.removeAttribute('id'); el.removeAttribute('style'); el.removeAttribute('dir'); el.removeAttribute('lang');
          if (isBold) el.style.fontWeight = 'bold';
          if (isItalic) el.style.fontStyle = 'italic';
          if (isUnderline) el.style.textDecoration = 'underline';
          if (isCenter) el.style.textAlign = 'center';
          if (isRight) el.style.textAlign = 'right';
          if (isJustify) el.style.textAlign = 'justify';
        }
      });
      let cleanedHTML = tempDiv.innerHTML.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
      document.execCommand('insertHTML', false, cleanedHTML);
      editorRef.current?.focus();
      handleEditorInput();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Quebras do Word corrigidas!', showConfirmButton: false, timer: 2000 });
    } else {
      Swal.fire({ icon: 'info', title: 'Selecione o texto', text: 'Selecione o texto com problemas de quebra do Word.' });
    }
  };

  const resizeImage = (file: File | Blob, maxWidth: number = 800): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF'; // Fundo branco caso haja transparência e converta para jpeg
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadImageToHostinger = async (base64Image: string): Promise<string> => {
    Swal.fire({ title: 'Enviando imagem...', text: 'Aguarde um momento.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const response = await fetch('https://crm.talidigital.com.br/upload.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
      const data = await response.json();
      if (data.success && data.url) {
        Swal.close();
        return data.url;
      } else {
        throw new Error(data.message || 'Erro no upload');
      }
    } catch (error) {
      console.error('Upload falhou:', error);
      Swal.fire('Erro!', 'Falha ao enviar a imagem para o servidor. Inserindo localmente.', 'error');
      return base64Image; // Fallback para base64 se falhar
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    // Suporte para colar imagens
    for (let i = 0; i < clipboardData.items.length; i++) {
      if (clipboardData.items[i].type.indexOf('image') !== -1) {
        const blob = clipboardData.items[i].getAsFile();
        if (blob) {
          resizeImage(blob).then(resizedBase64 => {
            uploadImageToHostinger(resizedBase64).then(finalUrl => {
              document.execCommand('insertHTML', false, `<img src="${finalUrl}" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />`);
              handleEditorInput();
            });
          });
          return;
        }
      }
    }
    let pasteHtml = clipboardData.getData('text/html');
    const pasteText = clipboardData.getData('text/plain');
    if (!pasteHtml) { document.execCommand('insertText', false, pasteText); return; }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pasteHtml;
    tempDiv.querySelectorAll('meta, link, style, script').forEach(tag => tag.remove());
    tempDiv.querySelectorAll('*').forEach(el => {
      if (el instanceof HTMLElement) {
        const isBold = el.style.fontWeight === 'bold' || el.tagName === 'B' || el.tagName === 'STRONG' || parseInt(el.style.fontWeight) > 600;
        const isItalic = el.style.fontStyle === 'italic' || el.tagName === 'I' || el.tagName === 'EM';
        const isUnderline = el.style.textDecoration.includes('underline') || el.tagName === 'U';
        const isCenter = el.style.textAlign === 'center';
        const isRight = el.style.textAlign === 'right';
        const isJustify = el.style.textAlign === 'justify';
        el.removeAttribute('class'); el.removeAttribute('id'); el.removeAttribute('style'); el.removeAttribute('dir'); el.removeAttribute('lang');
        if (isBold) el.style.fontWeight = 'bold';
        if (isItalic) el.style.fontStyle = 'italic';
        if (isUnderline) el.style.textDecoration = 'underline';
        if (isCenter) el.style.textAlign = 'center';
        if (isRight) el.style.textAlign = 'right';
        if (isJustify) el.style.textAlign = 'justify';
      }
    });
    let cleanHtml = tempDiv.innerHTML.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
    cleanHtml = cleanHtml.replace(/<p><\/p>/g, '').replace(/<p>\s*<\/p>/g, '');
    const finalDiv = document.createElement('div');
    finalDiv.innerHTML = cleanHtml;
    finalDiv.querySelectorAll('img').forEach(img => { img.style.maxWidth = '100%'; img.style.borderRadius = '8px'; img.style.margin = '10px 0'; });
    document.execCommand('insertHTML', false, finalDiv.innerHTML);
    handleEditorInput();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      for (let i = 0; i < dt.files.length; i++) {
        const file = dt.files[i];
        if (file.type.startsWith('image/')) {
          resizeImage(file).then(resizedBase64 => {
            uploadImageToHostinger(resizedBase64).then(finalUrl => {
              document.execCommand('insertHTML', false, `<img src="${finalUrl}" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />`);
              handleEditorInput();
            });
          });
        }
      }
    }
  };

  const handleInsertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        resizeImage(file).then(resizedBase64 => {
          uploadImageToHostinger(resizedBase64).then(finalUrl => {
            document.execCommand('insertHTML', false, `<img src="${finalUrl}" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />`);
            editorRef.current?.focus();
            handleEditorInput();
          });
        });
      }
    };
    input.click();
  };

  const handleConfigurarEstilos = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Configurar Estilos',
      width: 650,
      html: `
        <div style="text-align: left; font-size: 14px; display: grid; gap: 0.8rem; margin-top: 10px; max-height: 65vh; overflow-y: auto; padding-right: 10px;">
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Título do Documento (H1)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Tamanho: <input id="h1-size" type="number" value="${estilos.h1.size}" style="width: 50px; padding: 4px;"> pt</span>
              <span>Recuo: <input id="h1-indent" type="number" value="${estilos.h1.indent}" style="width: 50px; padding: 4px;"> px</span>
              <label><input id="h1-bold" type="checkbox" ${estilos.h1.bold ? 'checked' : ''}> Negrito</label>
              <label><input id="h1-upper" type="checkbox" ${estilos.h1.uppercase ? 'checked' : ''}> Maiúsculo</label>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Seção Principal (H2)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Tamanho: <input id="h2-size" type="number" value="${estilos.h2.size}" style="width: 50px; padding: 4px;"> pt</span>
              <span>Recuo: <input id="h2-indent" type="number" value="${estilos.h2.indent}" style="width: 50px; padding: 4px;"> px</span>
              <label><input id="h2-bold" type="checkbox" ${estilos.h2.bold ? 'checked' : ''}> Negrito</label>
              <label><input id="h2-upper" type="checkbox" ${estilos.h2.uppercase ? 'checked' : ''}> Maiúsculo</label>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Sub-seção (H3)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Tamanho: <input id="h3-size" type="number" value="${estilos.h3.size}" style="width: 50px; padding: 4px;"> pt</span>
              <span>Recuo: <input id="h3-indent" type="number" value="${estilos.h3.indent}" style="width: 50px; padding: 4px;"> px</span>
              <label><input id="h3-bold" type="checkbox" ${estilos.h3.bold ? 'checked' : ''}> Negrito</label>
              <label><input id="h3-upper" type="checkbox" ${estilos.h3.uppercase ? 'checked' : ''}> Maiúsculo</label>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Texto Normal (P)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Tamanho: <input id="p-size" type="number" value="${estilos.p.size}" style="width: 50px; padding: 4px;"> pt</span>
              <span>Recuo: <input id="p-indent" type="number" value="${estilos.p.indent}" style="width: 50px; padding: 4px;"> px</span>
              <span>1ª Linha: <input id="p-firstline" type="number" value="${estilos.p.firstLine}" style="width: 50px; padding: 4px;"> px</span>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Listas</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Recuo: <input id="list-indent" type="number" value="${estilos.list.indent}" style="width: 50px; padding: 4px;"> px</span>
              <span>Espaço entre itens: <input id="list-spacing" type="number" value="${estilos.list.spacing}" style="width: 50px; padding: 4px;"> px</span>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display:block; margin-bottom: 8px; color: #334155;">Margens do Documento (mm)</strong>
            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
              <span>Topo: <input id="page-top" type="number" value="${estilos.page.top}" style="width: 50px; padding: 4px;"></span>
              <span>Direita: <input id="page-right" type="number" value="${estilos.page.right}" style="width: 50px; padding: 4px;"></span>
              <span>Baixo: <input id="page-bottom" type="number" value="${estilos.page.bottom}" style="width: 50px; padding: 4px;"></span>
              <span>Esquerda: <input id="page-left" type="number" value="${estilos.page.left}" style="width: 50px; padding: 4px;"></span>
            </div>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Salvar Estilos',
      cancelButtonText: 'Cancelar',
      preConfirm: () => ({
        h1: { size: Number((document.getElementById('h1-size') as HTMLInputElement).value), indent: Number((document.getElementById('h1-indent') as HTMLInputElement).value), bold: (document.getElementById('h1-bold') as HTMLInputElement).checked, uppercase: (document.getElementById('h1-upper') as HTMLInputElement).checked },
        h2: { size: Number((document.getElementById('h2-size') as HTMLInputElement).value), indent: Number((document.getElementById('h2-indent') as HTMLInputElement).value), bold: (document.getElementById('h2-bold') as HTMLInputElement).checked, uppercase: (document.getElementById('h2-upper') as HTMLInputElement).checked },
        h3: { size: Number((document.getElementById('h3-size') as HTMLInputElement).value), indent: Number((document.getElementById('h3-indent') as HTMLInputElement).value), bold: (document.getElementById('h3-bold') as HTMLInputElement).checked, uppercase: (document.getElementById('h3-upper') as HTMLInputElement).checked },
        p: { size: Number((document.getElementById('p-size') as HTMLInputElement).value), indent: Number((document.getElementById('p-indent') as HTMLInputElement).value), firstLine: Number((document.getElementById('p-firstline') as HTMLInputElement).value) },
        list: { indent: Number((document.getElementById('list-indent') as HTMLInputElement).value), spacing: Number((document.getElementById('list-spacing') as HTMLInputElement).value) },
        page: { top: Number((document.getElementById('page-top') as HTMLInputElement).value), right: Number((document.getElementById('page-right') as HTMLInputElement).value), bottom: Number((document.getElementById('page-bottom') as HTMLInputElement).value), left: Number((document.getElementById('page-left') as HTMLInputElement).value) }
      })
    });

    if (formValues) {
      setEstilos(formValues);
      localStorage.setItem('tali_estilos_prospeccao_v1', JSON.stringify(formValues));
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Estilos salvos!', showConfirmButton: false, timer: 2000 });
    }
  };

  // ── IA ───────────────────────────────────────────────────────────────────
  const handleFormatWithAI = async () => {
    const settings = await getGlobalSettings();
    const apiKey = settings?.key;
    if (!apiKey) {
      Swal.fire({ icon: 'error', title: 'Chave não configurada', text: 'Configure a chave da API do Gemini na tela de Administração.' });
      return;
    }
    const { isConfirmed } = await Swal.fire({
      title: 'Formatar com IA ✨',
      text: 'A IA irá organizar o conteúdo mantendo as imagens. Deseja continuar?',
      showCancelButton: true,
      confirmButtonText: 'Formatar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981'
    });
    if (!isConfirmed) return;

    const rawText = editorRef.current?.innerHTML || '';
    if (!rawText.trim()) { Swal.fire({ icon: 'warning', title: 'Editor vazio', text: 'Escreva algo primeiro.' }); return; }

    Swal.fire({ title: 'Processando com IA... ✨', text: 'Aguarde...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      const systemPrompt = `Você é um especialista em prospecções comerciais para clínicas odontológicas, formatando em HTML.
Receba texto bruto ou HTML e retorne APENAS o HTML final, pronto para inserção num editor rich text.
REGRAS: Somente HTML. Sem markdown. Sem \`\`\`html. NÃO altere tags <img>. Sem <html><head><body>.
Comece com <h1>. Todo texto dentro de tags HTML. Sem class, id, align, dir.
Use <h1> para título, <h2> para seções, <h3> para sub-seções, <p> para texto, <ul>/<ol>/<li> para listas, <strong> para destaques.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: `PROSPECÇÃO:\n${rawText}` }] }],
          generationConfig: { temperature: 0.2 }
        })
      });

      if (!response.ok) { const err = await response.json(); throw new Error(err.error?.message || 'Erro na IA.'); }

      const data = await response.json();
      let htmlOutput = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/```html/g, '').replace(/```/g, '').trim();

      if (editorRef.current) { editorRef.current.innerHTML = htmlOutput; setPreviewHtml(htmlOutput); }
      Swal.fire({ icon: 'success', title: 'Formatado!', timer: 2000, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Erro na IA', text: error.message || 'Erro de comunicação com Gemini.' });
    }
  };

  // ── Salvar / Imprimir ────────────────────────────────────────────────────
  const handleSalvarNoSistema = async () => {
    if (!clinica.trim()) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe o nome da Clínica antes de salvar.', confirmButtonColor: 'var(--primary-color)' });
      return;
    }
    if (onSaveProspeccao) {
      await onSaveProspeccao({
        clienteNome: donoClinica,
        titulo: clinica,
        dataAssinatura: dataProspeccao,
        location: cidadeBairro,
        fullAddress: enderecoCompleto,
        conteudoHtml: editorRef.current?.innerHTML || ''
      });
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Salvo!', text: 'Prospecção registrada com sucesso.', timer: 1500, showConfirmButton: false });
    }
  };

  const handleImprimir = async () => {
    if (!clinica.trim()) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe o nome da Clínica antes de imprimir.', confirmButtonColor: 'var(--primary-color)' });
      return;
    }
    if (onSaveProspeccao) {
      try {
        await onSaveProspeccao({
          clienteNome: donoClinica,
          titulo: clinica,
          dataAssinatura: dataProspeccao,
          location: cidadeBairro,
          fullAddress: enderecoCompleto,
          conteudoHtml: editorRef.current?.innerHTML || ''
        });
      } catch (err) { /* continua para imprimir mesmo se save falhar */ }
    }

    if (editorRef.current) {
      const content = viewHtml ? previewHtml : editorRef.current.innerHTML;
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.write(`
          <html>
            <head>
              <title>${clinica || 'Prospecção'}</title>
              <style>
                @page { size: A4; margin: ${estilos.page.top}mm ${estilos.page.right}mm ${estilos.page.bottom}mm ${estilos.page.left}mm; }
                body { margin: 0; font-family: Arial, sans-serif; background: white; }
                .content-cell { font-size: 11pt; line-height: 1.5; text-align: justify; }
                .content-cell h1 { font-size: ${estilos.h1.size}pt !important; margin-left: ${estilos.h1.indent}px !important; font-weight: ${estilos.h1.bold ? 'bold' : 'normal'} !important; text-align: center; margin-top: 15px; margin-bottom: 15px; text-transform: ${estilos.h1.uppercase ? 'uppercase' : 'none'} !important; }
                .content-cell h2 { font-size: ${estilos.h2.size}pt !important; margin-left: ${estilos.h2.indent}px !important; font-weight: ${estilos.h2.bold ? 'bold' : 'normal'} !important; margin-top: 15px; margin-bottom: 10px; text-transform: ${estilos.h2.uppercase ? 'uppercase' : 'none'} !important; }
                .content-cell h3 { font-size: ${estilos.h3.size}pt !important; margin-left: ${estilos.h3.indent}px !important; font-weight: ${estilos.h3.bold ? 'bold' : 'normal'} !important; margin-top: 12px; margin-bottom: 8px; text-transform: ${estilos.h3.uppercase ? 'uppercase' : 'none'} !important; }
                .content-cell p { font-size: ${estilos.p.size}pt !important; margin-left: ${estilos.p.indent}px !important; text-indent: ${estilos.p.firstLine}px !important; margin-top: 0; margin-bottom: 10px; text-align: justify; }
                .content-cell ul { padding-left: ${estilos.list.indent}px !important; list-style-type: disc !important; list-style-position: outside !important; }
                .content-cell ol { padding-left: ${estilos.list.indent}px !important; list-style-type: decimal !important; list-style-position: outside !important; }
                .content-cell li { margin-bottom: ${estilos.list.spacing}px !important; }
                .content-cell img { max-width: 100% !important; height: auto !important; page-break-inside: avoid; }
                .content-cell hr.page-break { border: none !important; margin: 0 !important; opacity: 0 !important; }
              </style>
            </head>
            <body>
              <div class="content-cell">${content}</div>
              <script>setTimeout(() => window.print(), 800);<\/script>
            </body>
          </html>
        `);
        doc.close();
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 10000);
      }
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="gerador-modal-container" style={{ backgroundColor: '#f8fafc', width: showPreview ? '100vw' : '95%', maxWidth: showPreview ? '100vw' : '1400px', height: showPreview ? '100vh' : '90vh', borderRadius: showPreview ? '0' : '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', transition: 'all 0.3s' }}>

        {/* Header */}
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

          {/* Div oculto para medir páginas */}
          <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
            <div ref={measureRef} dangerouslySetInnerHTML={{ __html: previewHtml }} style={{ width: 'calc(794px - 40mm)', padding: '10px', fontSize: '11pt', lineHeight: '1.5', boxSizing: 'border-box' }} />
          </div>

          {/* Sidebar */}
          <div className="gerador-sidebar" style={{ width: '320px', backgroundColor: 'var(--secondary-color)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="gerador-sidebar-inner" style={{ flex: 1, padding: '1.25rem 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', overflowY: 'auto' }}>

              {/* Modelos */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'white' }}>Seus Modelos</h3>
                <select className="input" style={{ marginBottom: '0.5rem', fontSize: '0.9rem', backgroundColor: 'white', color: '#1e293b', padding: '0.4rem', borderRadius: '4px', width: '100%' }} value={selectedModeloId} onChange={e => handleLoadModelo(e.target.value)}>
                  <option value="">-- Prospecção em Branco --</option>
                  {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <button onClick={handleSaveModelo} style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}>
                  Salvar Atual como Modelo
                </button>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.2rem 0' }} />

              {/* Data da Prospecção - Único campo editável */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500', fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' }}>Data da Prospecção</label>
                <input type="date" className="input" style={{ fontSize: '0.9rem', padding: '0.6rem', width: '100%', boxSizing: 'border-box', backgroundColor: 'white', color: '#1e293b', border: '1px solid transparent', borderRadius: '6px' }} value={dataProspeccao} onChange={e => setDataProspeccao(e.target.value)} />
              </div>

              {/* Informações da Clínica - Visualização */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>Dados da Clínica</h4>
                  <a 
                    href={prospeccaoParaEditar?.clienteId ? `#/prospeccao?edit=${prospeccaoParaEditar.clienteId}` : '#'}
                    onClick={(e) => {
                      if (!prospeccaoParaEditar || !prospeccaoParaEditar.clienteId) {
                        e.preventDefault();
                        Swal.fire('Aviso', 'Esta ficha ainda não foi salva como Prospecto.', 'warning');
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#fcd34d', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', padding: 0, textDecoration: 'none' }}
                  >
                    <Edit2 size={12} /> Editar Ficha Completa
                  </a>
                </div>
                
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem' }}>
                  <strong style={{ color: 'white' }}>Dono da Clínica:</strong>
                  {opcoesDono.length > 1 ? (
                    <select
                      className="input"
                      style={{ marginTop: '0.3rem', fontSize: '0.85rem', padding: '0.4rem', backgroundColor: 'white', color: '#1e293b', border: '1px solid transparent', borderRadius: '4px', width: '100%' }}
                      value={donoClinica}
                      onChange={(e) => setDonoClinica(e.target.value)}
                    >
                      {opcoesDono.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  ) : (
                    <div style={{ marginTop: '0.2rem' }}>{donoClinica || '-'}</div>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem' }}>
                  <strong style={{ color: 'white' }}>Nome da Clínica:</strong> {clinica || '-'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem' }}>
                  <strong style={{ color: 'white' }}>Cidade/Bairro:</strong> {cidadeBairro || '-'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                  <strong style={{ color: 'white' }}>Endereço:</strong> {enderecoCompleto || '-'}
                </div>
              </div>

              <div style={{ flex: 1 }}></div>

              {/* Botões de ação */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  disabled={isSaving}
                  onClick={async () => { if (isSaving) return; setIsSaving(true); try { await handleSalvarNoSistema(); } finally { setIsSaving(false); } }}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold', backgroundColor: isSaving ? '#94a3b8' : 'white', border: '2px solid white', color: isSaving ? 'white' : 'var(--secondary-color)', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}
                >
                  <FileText size={18} /> {isSaving ? 'Salvando...' : 'Salvar no Sistema'}
                </button>
                <button
                  disabled={isSaving}
                  onClick={async () => { if (isSaving) return; setIsSaving(true); try { await handleImprimir(); } finally { setIsSaving(false); } }}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold', backgroundColor: isSaving ? '#94a3b8' : 'var(--primary-color)', border: `2px solid ${isSaving ? '#94a3b8' : 'var(--primary-color)'}`, color: 'white', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}
                >
                  <Printer size={18} /> {isSaving ? 'Processando...' : 'Imprimir / Salvar PDF'}
                </button>
                
                {prospeccaoParaEditar && (
                  <button
                    disabled={isSaving}
                    onClick={handleMarcarEntregue}
                    style={{ 
                      width: '100%', 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      padding: '0.75rem', 
                      fontSize: '1rem', 
                      fontWeight: 'bold', 
                      backgroundColor: isEntregue ? '#22c55e' : '#ef4444', 
                      border: `2px solid ${isEntregue ? '#22c55e' : '#ef4444'}`, 
                      color: 'white', 
                      borderRadius: '8px', 
                      cursor: isSaving ? 'not-allowed' : 'pointer', 
                      opacity: isSaving ? 0.7 : 1,
                      marginTop: '0.5rem'
                    }}
                  >
                    <Check size={18} /> {isEntregue ? 'Endereço Entregue' : 'Marcar como Entregue'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Área do Editor */}
          <div className="gerador-editor" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#e2e8f0' }}>

            {/* Toolbar */}
            <div className="gerador-toolbar" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'white', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => handleFormat('undo')} className="editor-btn" title="Desfazer"><Undo size={18} /></button>
              <button onClick={() => handleFormat('redo')} className="editor-btn" title="Refazer"><Redo size={18} /></button>
              <button onClick={() => handleFormat('removeFormat')} className="editor-btn" title="Limpar Formatação"><Eraser size={18} /></button>
              <button onClick={handleFixWordBreaks} className="editor-btn" title="Corrigir Quebras do Word" style={{ color: 'var(--primary-color)' }}><Wand2 size={18} /></button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <button onClick={handleFormatWithAI} className="editor-btn" title="Formatar com IA" style={{ color: '#10b981', fontWeight: 'bold', gap: '0.3rem', padding: '0.4rem 0.8rem', backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}>
                <Sparkles size={18} /> IA
              </button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <select onChange={async (e) => {
                const val = e.target.value;
                if (!val) return;
                if (val === 'CONFIG') { handleConfigurarEstilos(); e.target.value = ''; return; }
                if (val === 'P') { clearFormatting(); } else { document.execCommand('formatBlock', false, val); }
                e.target.value = '';
                editorRef.current?.focus();
                handleEditorInput();
              }} className="editor-select" style={{ fontWeight: 'bold' }}>
                <option value="">Estilos...</option>
                <option value="P">Texto Normal</option>
                <option value="H1">Título</option>
                <option value="H2">Seção Principal</option>
                <option value="H3">Sub-seção</option>
                <option disabled>──────────</option>
                <option value="CONFIG">⚙️ Personalizar Estilos...</option>
              </select>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <select onChange={(e) => handleFormat('fontSize', e.target.value)} className="editor-select" defaultValue="3">
                <option value="1">Tam. 1</option>
                <option value="2">Tam. 2</option>
                <option value="3">Tam. 3 (Normal)</option>
                <option value="4">Tam. 4</option>
                <option value="5">Tam. 5</option>
                <option value="6">Tam. 6</option>
                <option value="7">Tam. 7</option>
              </select>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <button onClick={() => handleFormat('bold')} className="editor-btn" title="Negrito"><Bold size={18} /></button>
              <button onClick={() => handleFormat('italic')} className="editor-btn" title="Itálico"><Italic size={18} /></button>
              <button onClick={() => handleFormat('underline')} className="editor-btn" title="Sublinhado"><Underline size={18} /></button>
              <button onClick={() => handleFormat('strikethrough')} className="editor-btn" title="Tachado"><Strikethrough size={18} /></button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>
              <button onClick={handleInsertImage} className="editor-btn" title="Inserir Imagem"><ImageIcon size={18} /></button>
              <button onClick={() => handleFormat('pageBreak')} className="editor-btn" title="Quebra de Página" style={{ color: '#ef4444' }}><Scissors size={18} /></button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <button onClick={() => handleFormat('justifyLeft')} className="editor-btn" title="Esquerda"><AlignLeft size={18} /></button>
              <button onClick={() => handleFormat('justifyCenter')} className="editor-btn" title="Centralizar"><AlignCenter size={18} /></button>
              <button onClick={() => handleFormat('justifyRight')} className="editor-btn" title="Direita"><AlignRight size={18} /></button>
              <button onClick={() => handleFormat('justifyFull')} className="editor-btn" title="Justificar"><AlignJustify size={18} /></button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

              <button onClick={() => handleFormat('outdent')} className="editor-btn" title="Diminuir Recuo"><Outdent size={18} /></button>
              <button onClick={() => handleFormat('indent')} className="editor-btn" title="Aumentar Recuo"><Indent size={18} /></button>

              <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>
              <button onClick={() => setViewHtml(!viewHtml)} className="editor-btn" title="Editar HTML" style={{ color: viewHtml ? 'var(--primary-color)' : 'var(--text-secondary)', backgroundColor: viewHtml ? '#e0f2fe' : 'transparent' }}><Code size={18} /></button>

              <select onChange={handleListStyle} className="editor-select">
                <option value="">Listas...</option>
                <option value="ul|disc">Bolinhas</option>
                <option value="ul|circle">Círculos</option>
                <option value="ul|square">Quadrados</option>
                <option value="ol|decimal">Números (1, 2, 3)</option>
                <option value="ol|lower-alpha">Letras (a, b, c)</option>
                <option value="ol|upper-alpha">Letras (A, B, C)</option>
                <option value="ol|lower-roman">Romano (i, ii)</option>
                <option value="ol|upper-roman">Romano (I, II)</option>
              </select>
            </div>

            {/* Editor Central */}
            <div id="editor-scroll-container" style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: 'white' }}>
              <div className="editor-page-wrapper" style={{ width: '100%', maxWidth: '210mm', minHeight: '297mm', margin: '0 auto', backgroundColor: 'white', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>

                {viewHtml && (
                  <textarea
                    ref={(el) => { if (el) { setTimeout(() => { el.style.height = '1px'; el.style.height = `${el.scrollHeight + 20}px`; }, 0); } }}
                    value={previewHtml}
                    onChange={(e) => {
                      setPreviewHtml(e.target.value);
                      e.target.style.height = '1px';
                      e.target.style.height = `${e.target.scrollHeight + 20}px`;
                      if (editorRef.current) editorRef.current.innerHTML = e.target.value;
                    }}
                    style={{ width: '100%', padding: `${estilos.page.top}mm ${estilos.page.right}mm ${estilos.page.bottom}mm ${estilos.page.left}mm`, outline: 'none', fontSize: '10pt', fontFamily: 'monospace', lineHeight: '1.5', minHeight: '400px', color: '#334155', backgroundColor: '#f8fafc', border: 'none', resize: 'none', overflow: 'hidden', boxSizing: 'border-box' }}
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
                  style={{ display: viewHtml ? 'none' : 'block', padding: `${estilos.page.top}mm ${estilos.page.right}mm ${estilos.page.bottom}mm ${estilos.page.left}mm`, flex: 1, outline: 'none', fontSize: '11pt', lineHeight: '1.5', textAlign: 'justify', minHeight: '200px', color: '#000000', wordWrap: 'break-word' }}
                />
              </div>
            </div>
          </div>

          {/* Prévia */}
          {showPreview && (
            <div className="gerador-preview" style={{ width: '450px', backgroundColor: '#e2e8f0', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', fontWeight: '500', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Printer size={18} /> Prévia da Impressão</div>
                <span style={{ fontSize: '0.85rem' }}>{totalPages} página{totalPages > 1 ? 's' : ''}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '476px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '794px', transform: 'scale(0.6)', transformOrigin: 'top center', display: 'flex', flexDirection: 'column', gap: '40px', marginBottom: `calc(-40% * ${totalPages * 1123}px)` }}>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <div key={i} style={{ width: '794px', height: '1123px', backgroundColor: 'white', boxShadow: '0 15px 35px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
                        <div style={{ height: '80px', margin: '20px auto' }}></div>
                        <div style={{ height: '843px', overflow: 'hidden', margin: '0 20mm' }}>
                          <div className="editor-content" dangerouslySetInnerHTML={{ __html: previewHtml }} style={{ marginTop: `-${i * 843}px`, padding: '10px', fontSize: '11pt', lineHeight: '1.5', textAlign: 'justify', color: 'black' }} />
                        </div>
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
        .editor-btn { background: white; border: 1px solid transparent; border-radius: 4px; padding: 0.4rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .editor-btn:hover { background: #f1f5f9; color: var(--primary-color); border-color: #cbd5e1; }
        .editor-select { padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; outline: none; color: var(--text-secondary); background: white; font-size: 0.85rem; cursor: pointer; }
        .editor-select:hover { border-color: #cbd5e1; }
        .editor-content h1 { font-size: ${estilos.h1.size}pt !important; font-weight: ${estilos.h1.bold ? 'bold' : 'normal'} !important; text-align: center; text-transform: ${estilos.h1.uppercase ? 'uppercase' : 'none'} !important; }
        .editor-content h2 { font-size: ${estilos.h2.size}pt !important; font-weight: ${estilos.h2.bold ? 'bold' : 'normal'} !important; text-transform: ${estilos.h2.uppercase ? 'uppercase' : 'none'} !important; }
        .editor-content h3 { font-size: ${estilos.h3.size}pt !important; font-weight: ${estilos.h3.bold ? 'bold' : 'normal'} !important; text-transform: ${estilos.h3.uppercase ? 'uppercase' : 'none'} !important; }
        .editor-content p { font-size: ${estilos.p.size}pt !important; text-align: justify; }
        .editor-content ul { padding-left: ${estilos.list.indent}px !important; list-style-type: disc !important; }
        .editor-content ol { padding-left: ${estilos.list.indent}px !important; list-style-type: decimal !important; }
        .editor-content li { margin-bottom: ${estilos.list.spacing}px !important; display: list-item !important; }
        @media (max-width: 768px) {
          .gerador-modal-container { width: 100vw !important; height: 100vh !important; max-width: 100vw !important; border-radius: 0 !important; }
          .gerador-main-content { flex-direction: column !important; overflow-y: auto !important; }
          .gerador-sidebar { width: 100% !important; border-left: none !important; border-bottom: 1px solid var(--border-color) !important; }
          .gerador-sidebar-inner { overflow-y: visible !important; }
          .gerador-editor { width: 100% !important; overflow-y: visible !important; }
          .gerador-toolbar { overflow-x: auto !important; flex-wrap: nowrap !important; }
          .editor-page-wrapper { min-height: auto !important; padding: 10px !important; }
          .editor-content { padding: 10px !important; }
          .gerador-header-preview-toggle { display: none !important; }
          .gerador-preview { display: none !important; }
        }
      `}</style>
    </div>
  );
}
