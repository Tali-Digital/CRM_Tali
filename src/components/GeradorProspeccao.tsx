import React, { useState, useRef, useEffect, useMemo } from 'react';
import { subscribeToModelosProspeccao, addModeloProspeccao, updateModeloProspeccao, getGlobalSettings, updateProspeccaoDoc, updateProspect } from '../services/firestoreService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { ModeloProspeccao } from '../types';
import { X, Printer, Brain, FileText, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo, Redo, Eraser, Indent, Outdent, Wand2, Code, Sparkles, Image as ImageIcon, Scissors, Check, CheckSquare, Edit2, Plus, Save, Table, Crop, Layers, ZoomIn, ZoomOut, Palette, Highlighter, FileX, Trash2, BoxSelect, Minus, ChevronDown } from 'lucide-react';
import { VariableMappingModal } from './VariableMappingModal';
import { InlineImageCropperOverlay } from './InlineImageCropperOverlay';
import { VisualCropModal } from './VisualCropModal';
import { InteractiveMarginResizer } from './InteractiveMarginResizer';
import { DEFAULT_VARIABLE_TAGS } from '../services/mappingTagsService';
import Swal from 'sweetalert2';
import { cleanRating, cleanReviews } from '../services/localFalconService';
export const cleanDocumentHtml = (rawHtml: string): string => {
  if (!rawHtml) return '';
  let cleaned = rawHtml;

  // Remover quebras manuais obsoletas (<hr class="page-break">)
  cleaned = cleaned.replace(/<hr[^>]*class="[^"]*page-break[^"]*"[^>]*>/gi, '');
  cleaned = cleaned.replace(/<hr[^>]*title="Quebra de Página"[^>]*>/gi, '');

  // Substituir qualquer ocorrência de fontes como Times New Roman ou Serif por Arial, sans-serif
  cleaned = cleaned.replace(/font-family\s*:\s*[^;"]*(times|serif|georgia|roman)[^;"]*/gi, 'font-family: Arial, sans-serif');

  // Corrigir URLs HTTP de imagens antigas do servidor Hostinger para HTTPS (evita bloqueio de mixed content)
  cleaned = cleaned.replace(/src="http:\/\/crm\.talidigital\.com\.br/gi, 'src="https://crm.talidigital.com.br');
  cleaned = cleaned.replace(/src='http:\/\/crm\.talidigital\.com\.br/gi, "src='https://crm.talidigital.com.br");

  // Corrigir falta de /uploads/ em links de imagens do crm.talidigital.com.br
  cleaned = cleaned.replace(/src="https:\/\/crm\.talidigital\.com\.br\/img_/gi, 'src="https://crm.talidigital.com.br/uploads/img_');
  cleaned = cleaned.replace(/src='https:\/\/crm\.talidigital\.com\.br\/img_/gi, "src='https://crm.talidigital.com.br/uploads/img_");

  // Corrigir caminhos relativos de imagens (ex: src="img_..." ou src="uploads/...")
  cleaned = cleaned.replace(/src="(?!\/|https?:\/\/|data:|blob:)(img_[^"]+)"/gi, 'src="https://crm.talidigital.com.br/uploads/$1"');
  cleaned = cleaned.replace(/src='(?!\/|https?:\/\/|data:|blob:)(img_[^']+)'/gi, "src='https://crm.talidigital.com.br/uploads/$1'");
  cleaned = cleaned.replace(/src="(?!\/|https?:\/\/|data:|blob:)([^"]+)"/gi, 'src="https://crm.talidigital.com.br/$1"');
  cleaned = cleaned.replace(/src='(?!\/|https?:\/\/|data:|blob:)([^']+)'/gi, "src='https://crm.talidigital.com.br/$1'");

  // Substituir sequências de interrogações em nomes/textos por textos limpos (ex: ????????????????????)
  cleaned = cleaned.replace(/Dr\.\s*\?{2,}/gi, 'Dr. Proprietário');
  cleaned = cleaned.replace(/\?{3,}/g, '');

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleaned, 'text/html');

    doc.querySelectorAll('*').forEach(el => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style && htmlEl.style.fontFamily) {
        if (/times|serif|georgia|roman/i.test(htmlEl.style.fontFamily)) {
          htmlEl.style.fontFamily = 'Arial, sans-serif';
        }
      }
    });

    doc.querySelectorAll('img').forEach(img => {
      let src = img.getAttribute('src')?.trim() || '';

      if (src.startsWith('http://crm.talidigital.com.br')) {
        src = src.replace('http://', 'https://');
      }

      if (src.startsWith('https://crm.talidigital.com.br/img_')) {
        src = src.replace('https://crm.talidigital.com.br/img_', 'https://crm.talidigital.com.br/uploads/img_');
      } else if (!src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('blob:') && src.length > 0) {
        const cleanPath = src.replace(/^\//, '');
        if (cleanPath.startsWith('img_')) {
          src = `https://crm.talidigital.com.br/uploads/${cleanPath}`;
        } else {
          src = `https://crm.talidigital.com.br/${cleanPath}`;
        }
      }
      img.setAttribute('src', src);

      if (!src || src === 'undefined' || src === 'null' || src === 'about:blank') {
        img.remove();
      } else {
        img.style.maxWidth = '100%';
      }
    });

    return doc.body.innerHTML;
  } catch (e) {
    return cleaned;
  }
};

interface GeradorProspeccaoProps {
  onClose: () => void;
  onSaveProspeccao?: (prospeccao: any) => Promise<void>;
  prospeccaoParaEditar?: any;
  isModeloOnlyMode?: boolean;
  modeloIdParaEditar?: string;
}

export default function GeradorProspeccao({ onClose, onSaveProspeccao, prospeccaoParaEditar, isModeloOnlyMode, modeloIdParaEditar }: GeradorProspeccaoProps) {
  const [showMargins, setShowMargins] = useState<boolean>(true);
  const [selectedFontSizeNum, setSelectedFontSizeNum] = useState<number>(3);
  const [showFontSizePopover, setShowFontSizePopover] = useState<boolean>(false);
  const [donoClinica, setDonoClinica] = useState('');
  const [opcoesDono, setOpcoesDono] = useState<string[]>([]);
  const [clinica, setClinica] = useState('');
  const [dataProspeccao, setDataProspeccao] = useState(new Date().toISOString().split('T')[0]);
  const [cidadeBairro, setCidadeBairro] = useState('');
  const [enderecoCompleto, setEnderecoCompleto] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEntregue, setIsEntregue] = useState(false);
  const [isFinalizada, setIsFinalizada] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Estados de responsividade e zoom para celular
  const [isMobileView, setIsMobileView] = useState<boolean>(false);
  const [mobileZoom, setMobileZoom] = useState<number>(0.65);

  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 1050 || window.matchMedia('(orientation: portrait)').matches;
      setIsMobileView(isMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleZoomIn = () => setMobileZoom(prev => Math.min(Number((prev + 0.1).toFixed(2)), 1.5));
  const handleZoomOut = () => setMobileZoom(prev => Math.max(Number((prev - 0.1).toFixed(2)), 0.35));
  const handleToggleZoomFit = () => setMobileZoom(prev => (prev >= 0.95 ? 0.65 : 1.0));

  const [selectedModeloId, setSelectedModeloId] = useState('');
  const [nomeModeloState, setNomeModeloState] = useState('');
  const [descricaoModeloState, setDescricaoModeloState] = useState('');
  const [modelos, setModelos] = useState<ModeloProspeccao[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [viewHtml, setViewHtml] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [prospectData, setProspectData] = useState<any>(null);

  const computedOpcoesDono = useMemo(() => {
    const baseString = prospectData?.ownerName || (prospeccaoParaEditar as any)?.clienteNome || donoClinica || '';
    if (!baseString) return opcoesDono;
    const parts = baseString.split(/,|;|\/| e /i).map((s: string) => s.trim()).filter(Boolean);
    let list: string[] = [];
    if (parts.length > 1) {
      list = Array.from(new Set([baseString, ...parts, ...opcoesDono]));
    } else {
      list = Array.from(new Set([baseString, ...opcoesDono]));
    }
    return list.filter(Boolean);
  }, [prospectData?.ownerName, prospeccaoParaEditar, donoClinica, opcoesDono]);

  const [estilos, setEstilos] = useState({
    h1: { size: 16, bold: true, uppercase: true, indent: 0 },
    h2: { size: 14, bold: true, uppercase: true, indent: 0 },
    h3: { size: 12, bold: true, uppercase: false, indent: 0 },
    p: { size: 11, indent: 0, firstLine: 0 },
    list: { indent: 40, spacing: 5 },
    page: { top: 15, right: 15, bottom: 15, left: 15 }
  });

  const [selectedLineHeight, setSelectedLineHeight] = useState<string>('1.5');
  const [textColor, setTextColor] = useState<string>('#000000');
  const [highlightColor, setHighlightColor] = useState<string>('#ffff00');
  const [showColorPopover, setShowColorPopover] = useState<boolean>(false);
  const [showHighlightPopover, setShowHighlightPopover] = useState<boolean>(false);
  const [isRemoveElementMode, setIsRemoveElementMode] = useState<boolean>(false);

  const handleOpenColorPopover = () => {
    saveSelection();
    setShowHighlightPopover(false);
    setShowColorPopover(!showColorPopover);
  };

  const handleOpenHighlightPopover = () => {
    saveSelection();
    setShowColorPopover(false);
    setShowHighlightPopover(!showHighlightPopover);
  };

  const applyTextColor = (color: string | null) => {
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch (e) {}

    restoreSelection();
    const sel = window.getSelection();

    if (color === null) {
      try {
        document.execCommand('removeFormat', false, undefined);
        document.execCommand('foreColor', false, '#000000');
      } catch (e) {}

      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const parent = container.nodeType === 3 ? container.parentElement : (container as HTMLElement);
        if (parent && editorRef.current?.contains(parent)) {
          const styledEl = parent.closest<HTMLElement>('[style*="color"]');
          if (styledEl && styledEl !== editorRef.current && !styledEl.classList.contains('a4-page-content')) {
            styledEl.style.color = '';
          }
        }
      }
      setTextColor('#000000');
    } else {
      let applied = false;

      if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
        try {
          applied = document.execCommand('foreColor', false, color);
        } catch (e) {}

        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const parent = container.nodeType === 3 ? container.parentElement : (container as HTMLElement);

        if (parent && editorRef.current?.contains(parent)) {
          if (parent.tagName === 'SPAN' || parent.tagName === 'FONT') {
            parent.style.color = color;
            applied = true;
          }
        }
      }

      if (!applied || !sel || sel.isCollapsed) {
        const anchorNode = sel?.anchorNode;
        const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
        const block = anchorEl?.closest<HTMLElement>('p, h1, h2, h3, li, td, th, span, div.a4-page-content > *');
        if (block && editorRef.current?.contains(block)) {
          block.style.color = color;
        }
      }

      setTextColor(color);
    }

    handleEditorInput();
    setShowColorPopover(false);
  };

  const applyHighlightColor = (color: string | null) => {
    try {
      document.execCommand('styleWithCSS', false, true);
    } catch (e) {}

    restoreSelection();
    const sel = window.getSelection();

    if (color === null) {
      try {
        document.execCommand('hiliteColor', false, 'transparent');
        document.execCommand('backColor', false, 'transparent');
      } catch (e) {}

      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const parent = container.nodeType === 3 ? container.parentElement : (container as HTMLElement);
        if (parent && editorRef.current?.contains(parent)) {
          const styledEl = parent.closest<HTMLElement>('[style*="background"]');
          if (styledEl && styledEl !== editorRef.current && !styledEl.classList.contains('a4-page-content')) {
            styledEl.style.backgroundColor = '';
          }
        }
      }
      setHighlightColor('#ffffff');
    } else {
      let applied = false;
      if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
        try {
          applied = document.execCommand('hiliteColor', false, color);
          if (!applied) {
            applied = document.execCommand('backColor', false, color);
          }
        } catch (e) {}

        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const parent = container.nodeType === 3 ? container.parentElement : (container as HTMLElement);
        if (parent && editorRef.current?.contains(parent)) {
          if (parent.tagName === 'SPAN' || parent.tagName === 'FONT' || parent.tagName === 'MARK') {
            parent.style.backgroundColor = color;
            applied = true;
          }
        }
      }

      if (!applied || !sel || sel.isCollapsed) {
        const anchorNode = sel?.anchorNode;
        const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
        const block = anchorEl?.closest<HTMLElement>('p, h1, h2, h3, li, td, th, span, div.a4-page-content > *');
        if (block && editorRef.current?.contains(block)) {
          block.style.backgroundColor = color;
        }
      }

      setHighlightColor(color);
    }

    handleEditorInput();
    setShowHighlightPopover(false);
  };

  const [marginTargetMode, setMarginTargetMode] = useState<'current' | 'all'>('current');
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [activePageMargins, setActivePageMargins] = useState<{ top: number; right: number; bottom: number; left: number }>({ top: 15, right: 15, bottom: 15, left: 15 });

  const updateActivePageFromSelection = () => {
    if (!editorRef.current) return;
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
    const pageEl = anchorEl?.closest<HTMLElement>('.a4-page');
    if (pageEl && editorRef.current) {
      const pages = Array.from(editorRef.current.querySelectorAll<HTMLElement>(':scope > .a4-page'));
      const idx = pages.indexOf(pageEl);
      if (idx !== -1) {
        setActivePageIndex(idx);
        const content = pageEl.querySelector<HTMLElement>(':scope > .a4-page-content');
        if (content) {
          const pTop = parseFloat(content.style.paddingTop) || estilos.page.top;
          const pRight = parseFloat(content.style.paddingRight) || estilos.page.right;
          const pBottom = parseFloat(content.style.paddingBottom) || estilos.page.bottom;
          const pLeft = parseFloat(content.style.paddingLeft) || estilos.page.left;
          setActivePageMargins({ top: pTop, right: pRight, bottom: pBottom, left: pLeft });
        }
      }
    }
  };

  const handleUpdateMargin = (top: number, right: number, bottom: number, left: number, targetAll: boolean = marginTargetMode === 'all') => {
    const newMargins = {
      top: Math.max(0, top),
      right: Math.max(0, right),
      bottom: Math.max(0, bottom),
      left: Math.max(0, left)
    };
    setActivePageMargins(newMargins);

    if (targetAll) {
      const newEstilos = { ...estilos, page: newMargins };
      setEstilos(newEstilos);
      localStorage.setItem('tali_estilos_prospeccao_v1', JSON.stringify(newEstilos));

      if (editorRef.current) {
        const contents = editorRef.current.querySelectorAll<HTMLElement>('.a4-page-content');
        contents.forEach(content => {
          content.style.padding = `${newMargins.top}mm ${newMargins.right}mm ${newMargins.bottom}mm ${newMargins.left}mm`;
        });
        schedulePagination();
      }
    } else {
      if (editorRef.current) {
        const pages = Array.from(editorRef.current.querySelectorAll<HTMLElement>(':scope > .a4-page'));
        const targetPageEl = pages[activePageIndex] || pages[0];
        if (targetPageEl) {
          const content = targetPageEl.querySelector<HTMLElement>(':scope > .a4-page-content');
          if (content) {
            content.style.padding = `${newMargins.top}mm ${newMargins.right}mm ${newMargins.bottom}mm ${newMargins.left}mm`;
          }
        }
        schedulePagination();
      }
    }
  };

  const handleApplyLineHeight = (heightVal: string) => {
    const val = parseFloat(heightVal);
    if (isNaN(val) || val <= 0) return;
    const strVal = String(val);
    setSelectedLineHeight(strVal);

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      const anchorNode = selection?.anchorNode;
      const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
      const activeBlock = anchorElement?.closest('p, div, h1, h2, h3, li') as HTMLElement;
      if (activeBlock && editorRef.current?.contains(activeBlock)) {
        activeBlock.style.lineHeight = strVal;
      } else if (editorRef.current) {
        const blocks = editorRef.current.querySelectorAll<HTMLElement>('.a4-page-content p, .a4-page-content h1, .a4-page-content h2, .a4-page-content h3, .a4-page-content li');
        blocks.forEach(b => b.style.lineHeight = strVal);
      }
      handleEditorInput();
      return;
    }

    const range = selection.getRangeAt(0);
    let container: HTMLElement | null = range.commonAncestorContainer as HTMLElement;
    if (container && container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }

    if (container && editorRef.current?.contains(container)) {
      const parentBlock = container.closest('p, div, h1, h2, h3, li') as HTMLElement;
      if (parentBlock) {
        parentBlock.style.lineHeight = strVal;
      }
      const allBlocks = editorRef.current.querySelectorAll<HTMLElement>('p, div, h1, h2, h3, li');
      allBlocks.forEach(b => {
        if (selection.containsNode(b, true)) {
          b.style.lineHeight = strVal;
        }
      });
    }
    handleEditorInput();
  };

  const editorRef = useRef<HTMLDivElement>(null);
  const paginationFrameRef = useRef<HTMLDivElement>(null);
  const isPaginatingRef = useRef(false);
  const paginationRafRef = useRef<number | null>(null);
  const paginationTimeoutRef = useRef<number | null>(null);
  const isComposingRef = useRef(false);
  const dirtyPageRef = useRef<HTMLElement | null>(null);

  const [selectedEditorImage, setSelectedEditorImage] = useState<HTMLImageElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const draggedImageRef = useRef<HTMLImageElement | null>(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed && editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
      return true;
    }
    return false;
  };

  // Escutar arrasto interno de imagens entre páginas A4
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'IMG') {
        draggedImageRef.current = target as HTMLImageElement;
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', 'INTERNAL_IMAGE_DRAG');
          e.dataTransfer.effectAllowed = 'move';
        }
      }
    };

    editor.addEventListener('dragstart', handleDragStart);
    return () => {
      editor.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  // Escutar clique em qualquer imagem dentro do editor e manter a seleção de texto atualizada
  // Escutar clique em qualquer lugar para selecionar/desmarcar imagem e manter a seleção de texto atualizada
  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      if (target.tagName === 'IMG' && editorRef.current?.contains(target)) {
        setSelectedEditorImage(target as HTMLImageElement);
      } else if (!target.closest('.inline-image-cropper-overlay')) {
        setSelectedEditorImage(null);
      }
    };

    const handleSelectionChange = () => {
      saveSelection();
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [previewHtml]);

  const conteudoInicial = `<p>Escreva ou cole o texto da sua prospecção aqui...</p>`;

  // Escutar a tecla ESC para desmarcar imagem ou fechar o editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedEditorImage) {
          setSelectedEditorImage(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectedEditorImage]);

  // Preencher dados ao editar
  useEffect(() => {
    if (prospeccaoParaEditar) {
      if (prospeccaoParaEditar.clienteNome) setDonoClinica(prospeccaoParaEditar.clienteNome);
      if (prospeccaoParaEditar.titulo) setClinica(prospeccaoParaEditar.titulo);
      if (prospeccaoParaEditar.dataAssinatura) setDataProspeccao(prospeccaoParaEditar.dataAssinatura);
      if (prospeccaoParaEditar.isEntregue) setIsEntregue(true);
      if (prospeccaoParaEditar.isFinalizada) setIsFinalizada(true);

      // Fetch live prospect data to ensure address and names are accurate
      if (prospeccaoParaEditar.clienteId) {
        getDoc(doc(db, 'prospects', prospeccaoParaEditar.clienteId)).then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            setProspectData(data);
            setCidadeBairro(data.location || '');
            setEnderecoCompleto(data.fullAddress || '');
            setClinica(data.clinicName || '');
            if (data.marketingDiagnostic) setDiagnosticData(data.marketingDiagnostic);

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
        setEditorHtml(prospeccaoParaEditar.conteudoHtml);
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
          page: parsed.page || { top: 15, right: 15, bottom: 15, left: 15 }
        });
      } catch (e) { }
    }

    if (editorRef.current && editorRef.current.innerHTML === '') {
      setEditorHtml(conteudoInicial);
    }

    return () => unsubscribe();
  }, []);

  const getCanonicalHtml = () => {
    if (!editorRef.current) return '';
    const pages = Array.from(editorRef.current.querySelectorAll<HTMLElement>(':scope > .a4-page'));
    if (!pages.length) return editorRef.current.innerHTML;
    return pages.map(page => page.querySelector<HTMLElement>(':scope > .a4-page-content')?.innerHTML || '').join('');
  };

  const createPage = () => {
    const page = document.createElement('section');
    page.className = 'a4-page';
    page.contentEditable = 'false';
    const content = document.createElement('div');
    content.className = 'a4-page-content';
    content.contentEditable = 'true';

    const lastPageContent = editorRef.current?.querySelector('.a4-page:last-child .a4-page-content') as HTMLElement | null;
    if (lastPageContent && lastPageContent.style.padding) {
      content.style.padding = lastPageContent.style.padding;
    } else {
      content.style.padding = `${estilos.page.top}mm ${estilos.page.right}mm ${estilos.page.bottom}mm ${estilos.page.left}mm`;
    }

    page.appendChild(content);
    return { page, content };
  };

  const exceedsPageContent = (content: HTMLElement, node: Node) => {
    if (!(node instanceof HTMLElement)) return content.scrollHeight > content.clientHeight + 1;
    const contentRect = content.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const contentStyles = window.getComputedStyle(content);
    const bottomLimit = contentRect.bottom - parseFloat(contentStyles.paddingBottom || '0');
    const marginBottom = parseFloat(window.getComputedStyle(node).marginBottom || '0');
    return nodeRect.bottom + marginBottom > bottomLimit + 1;
  };

  const updatePageCount = () => {
    const count = editorRef.current?.querySelectorAll(':scope > .a4-page').length || 1;
    setTotalPages(Math.max(1, count));
  };

  const splitBlockAtSelection = (block: HTMLElement): HTMLElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);

    if (!block.contains(range.endContainer)) return null;

    try {
      const endRange = document.createRange();
      endRange.selectNodeContents(block);
      endRange.setStart(range.endContainer, range.endOffset);

      const extracted = endRange.extractContents();
      if (extracted && extracted.childNodes.length > 0 && (extracted.textContent || '').trim().length > 0) {
        const newBlock = block.cloneNode(false) as HTMLElement;
        newBlock.appendChild(extracted);
        return newBlock;
      }
    } catch (e) {
      console.warn('Split block error:', e);
    }
    return null;
  };

  const isCursorAtStartOfContent = (content: HTMLElement, range: Range): boolean => {
    if (!range.collapsed) return false;
    try {
      const preRange = document.createRange();
      preRange.selectNodeContents(content);
      preRange.setEnd(range.startContainer, range.startOffset);

      const textBefore = (preRange.toString() || '').replace(/[\s\n\r\t\u200B]+/g, '');
      const mediaBefore = preRange.cloneContents().querySelectorAll('img, table, iframe').length;

      return textBefore.length === 0 && mediaBefore === 0;
    } catch (e) {
      return false;
    }
  };

  const balancePagesFrom = (startContent: HTMLElement | null) => {
    const editor = editorRef.current;
    if (!editor || !startContent || isPaginatingRef.current || !startContent.isConnected) return;
    isPaginatingRef.current = true;
    try {
      let page = startContent.closest<HTMLElement>('.a4-page');
      while (page) {
        const content = page.querySelector<HTMLElement>(':scope > .a4-page-content');
        if (!content) break;

        while (content.lastChild && exceedsPageContent(content, content.lastChild)) {
          const lastNode = content.lastChild;

          // Se o elemento for uma imagem ou contiver uma imagem, NÃO passa para a próxima folha automaticamente!
          // Imagens permanecem sempre na folha atual e só mudam de folha se forem arrastadas (drag & drop).
          const isImageNode = (lastNode instanceof HTMLElement) && (lastNode.tagName === 'IMG' || lastNode.querySelector('img') !== null);
          if (isImageNode) {
            const imgEl = lastNode.tagName === 'IMG' ? (lastNode as HTMLImageElement) : lastNode.querySelector('img');
            if (imgEl) {
              const contentRect = content.getBoundingClientRect();
              const contentStyles = window.getComputedStyle(content);
              const paddingTop = parseFloat(contentStyles.paddingTop || '0');
              const paddingBottom = parseFloat(contentStyles.paddingBottom || '0');
              const maxAvailHeight = contentRect.height - paddingTop - paddingBottom - 15;
              imgEl.style.maxHeight = `${Math.max(80, maxAvailHeight)}px`;
              imgEl.style.objectFit = 'contain';
            }
            break;
          }

          let nextPage = page.nextElementSibling as HTMLElement | null;
          if (!nextPage?.classList.contains('a4-page')) {
            nextPage = createPage().page;
            editor.insertBefore(nextPage, page.nextSibling);
          }
          const nextContent = nextPage.querySelector<HTMLElement>(':scope > .a4-page-content');
          if (!nextContent) break;

          let nodeToMove: Node = lastNode;

          if (lastNode instanceof HTMLElement && lastNode.tagName !== 'TABLE' && lastNode.tagName !== 'IMG') {
            const splitResult = splitBlockAtSelection(lastNode);
            if (splitResult) {
              nodeToMove = splitResult;
            }
          }

          nextContent.insertBefore(nodeToMove, nextContent.firstChild);
        }

        let nextPage = page.nextElementSibling as HTMLElement | null;
        if (nextPage?.classList.contains('a4-page')) {
          const nextContent = nextPage.querySelector<HTMLElement>(':scope > .a4-page-content');
          while (nextContent?.firstChild) {
            const candidate = nextContent.firstChild;
            content.appendChild(candidate);
            if (exceedsPageContent(content, candidate)) {
              content.removeChild(candidate);
              nextContent.insertBefore(candidate, nextContent.firstChild);
              break;
            }
          }
          if (nextContent && !nextContent.childNodes.length) {
            nextPage.remove();
            nextPage = page.nextElementSibling as HTMLElement | null;
          }
        }

        page = nextPage?.classList.contains('a4-page') ? nextPage : null;
      }
      updatePageCount();
    } finally {
      isPaginatingRef.current = false;
    }
  };

  const paginateEditor = () => {
    const editor = editorRef.current;
    if (!editor || isPaginatingRef.current) return;
    const selection = window.getSelection();
    let startMarker: HTMLSpanElement | null = null;
    let endMarker: HTMLSpanElement | null = null;
    if (selection?.rangeCount && editor.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0).cloneRange();
      startMarker = document.createElement('span');
      startMarker.dataset.caretMarker = 'start';
      startMarker.style.cssText = 'display:inline;width:0;height:0;overflow:hidden;';
      if (!range.collapsed) {
        const endRange = range.cloneRange();
        endRange.collapse(false);
        endMarker = document.createElement('span');
        endMarker.dataset.caretMarker = 'end';
        endMarker.style.cssText = 'display:inline;width:0;height:0;overflow:hidden;';
        endRange.insertNode(endMarker);
      }
      range.collapse(true);
      range.insertNode(startMarker);
    }
    isPaginatingRef.current = true;
    try {
      const fragment = document.createDocumentFragment();
      const existingPages = Array.from(editor.querySelectorAll<HTMLElement>(':scope > .a4-page'));
      const pagePaddings: string[] = [];

      if (existingPages.length) {
        existingPages.forEach(page => {
          const content = page.querySelector<HTMLElement>(':scope > .a4-page-content');
          if (content) {
            pagePaddings.push(content.style.padding || '');
            while (content.firstChild) fragment.appendChild(content.firstChild);
          }
        });
      } else {
        while (editor.firstChild) fragment.appendChild(editor.firstChild);
      }

      editor.replaceChildren();

      let pageCountIndex = 0;
      const getNewPage = () => {
        const pageObj = createPage();
        if (pagePaddings[pageCountIndex]) {
          pageObj.content.style.padding = pagePaddings[pageCountIndex];
        }
        pageCountIndex++;
        return pageObj;
      };

      let current = getNewPage();
      editor.appendChild(current.page);
      const nodes = Array.from(fragment.childNodes);

      nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) return;

        current.content.appendChild(node);
        if (exceedsPageContent(current.content, node) && current.content.childNodes.length > 1) {
          current.content.removeChild(node);
          current = getNewPage();
          editor.appendChild(current.page);
          current.content.appendChild(node);
        }
      });

      updatePageCount();
      if (startMarker?.isConnected) {
        const range = document.createRange();
        range.setStartBefore(startMarker);
        if (endMarker?.isConnected) range.setEndBefore(endMarker);
        else range.collapse(true);
        startMarker.remove();
        if (endMarker?.isConnected) endMarker.remove();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    } finally {
      if (startMarker?.isConnected) startMarker.remove();
      if (endMarker?.isConnected) endMarker.remove();
      isPaginatingRef.current = false;
    }
  };

  const schedulePagination = () => {
    if (paginationTimeoutRef.current !== null) {
      window.clearTimeout(paginationTimeoutRef.current);
      paginationTimeoutRef.current = null;
    }
    if (paginationRafRef.current !== null) cancelAnimationFrame(paginationRafRef.current);
    paginationRafRef.current = requestAnimationFrame(() => {
      paginationRafRef.current = null;
      paginateEditor();
    });
  };

  const schedulePaginationAfterInput = () => {
    if (isComposingRef.current) return;
    if (paginationTimeoutRef.current !== null) window.clearTimeout(paginationTimeoutRef.current);
    paginationTimeoutRef.current = window.setTimeout(() => {
      paginationTimeoutRef.current = null;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode)) return;
      balancePagesFrom(dirtyPageRef.current);
      dirtyPageRef.current = null;
    }, 350);
  };

  const setEditorHtml = (html: string) => {
    if (!editorRef.current) return;
    const sanitized = cleanDocumentHtml(html);
    editorRef.current.innerHTML = sanitized;
    setPreviewHtml(sanitized);
    schedulePagination();
  };

  useEffect(() => {
    schedulePagination();
    return () => {
      if (paginationRafRef.current !== null) cancelAnimationFrame(paginationRafRef.current);
      if (paginationTimeoutRef.current !== null) window.clearTimeout(paginationTimeoutRef.current);
    };
  }, [estilos.page.top, estilos.page.right, estilos.page.bottom, estilos.page.left]);

  const handleEditorInput = (event?: React.FormEvent<HTMLDivElement>) => {
    const target = event?.target as HTMLElement | undefined;
    const anchorNode = window.getSelection()?.anchorNode;
    const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
    dirtyPageRef.current = target?.closest<HTMLElement>('.a4-page-content')
      || anchorElement?.closest<HTMLElement>('.a4-page-content')
      || dirtyPageRef.current
      || editorRef.current?.querySelector<HTMLElement>(':scope > .a4-page > .a4-page-content')
      || null;
    schedulePaginationAfterInput();
  };

  const handleApplyAllTags = () => {
    if (!editorRef.current) return;

    const { resumo1 = '', resumo2 = '', resumo3 = '', placar, site, anuncios, gmn } = diagnosticData || {};
    const planoAcao = Array.isArray(diagnosticData?.planoAcao) ? diagnosticData.planoAcao : [];
    const clientRank = Number(diagnosticData?.posicaoCliente ?? gmn?.posicaoMedia);
    const hasValidClientRank = Number.isInteger(clientRank) && clientRank > 0;
    const concorrentes = Array.from(
      new Map(
        (Array.isArray(diagnosticData?.concorrentes) ? diagnosticData.concorrentes : [])
          .filter((competitor: any) => competitor?.nome && !competitor.nome.startsWith('Concorrente Local'))
          .filter((competitor: any) => hasValidClientRank && (clientRank === 1
            ? Number(competitor.posicao) > clientRank
            : Number(competitor.posicao) < clientRank
          ))
          .sort((a: any, b: any) => (a.posicao ?? Number.MAX_SAFE_INTEGER) - (b.posicao ?? Number.MAX_SAFE_INTEGER))
          .map((competitor: any) => [competitor.placeId || competitor.nome.trim().toLowerCase(), competitor])
      ).values()
    ).slice(0, 3);

    const resumoHtml = (resumo1 || resumo2 || resumo3) ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #334155; margin-top: 0; font-size: 14pt;">Resumo Executivo (IA)</h3>
        ${resumo1 ? `<p style="margin-bottom: 10px;">${resumo1}</p>` : ''}
        ${resumo2 ? `<p style="margin-bottom: 10px;">${resumo2}</p>` : ''}
        ${resumo3 ? `<p style="margin-bottom: 0;">${resumo3}</p>` : ''}
      </div>
    ` : '';

    const placarHtml = placar ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #334155; margin-top: 0; font-size: 14pt;">Placar de Presença (IA)</h3>
        <ul style="padding-left: 20px;">
          <li>Google: ${placar.google ?? 0}/100</li>
          <li>Reputação: ${placar.reputacao ?? 0}/100</li>
          <li>Instagram: ${placar.instagram ?? 0}/100</li>
          <li>Site: ${placar.site ?? 0}/100</li>
          <li>Ads: ${placar.ads ?? 0}/100</li>
        </ul>
      </div>
    ` : '';

    const gmnHtml = gmn ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #334155; margin-top: 0; font-size: 14pt;">Google Meu Negócio (IA)</h3>
        <p>Você aparece no Top 3 em <strong>${gmn.top3Percent ?? 0}%</strong> da região, e está invisível em <strong>${gmn.foraTop20Percent ?? 0}%</strong>.</p>
        <ul style="padding-left: 20px;">
          ${gmn.oportunidade1 ? `<li>${gmn.oportunidade1}</li>` : ''}
          ${gmn.oportunidade2 ? `<li>${gmn.oportunidade2}</li>` : ''}
        </ul>
      </div>
    ` : '';

    const siteHtml = site ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #8b5cf6; padding: 15px; margin: 20px 0; border-radius: 6px;">
        <h3 style="color: #334155; margin-top: 0; font-size: 14pt;">Desempenho e Qualidade do Site (Google PageSpeed)</h3>

        <div style="display: flex; gap: 10px; margin: 15px 0; flex-wrap: wrap; text-align: center;">
          <div style="flex: 1; min-width: 75px; padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 18pt; font-weight: 900; color: #ef4444;">${site.velocidade ?? 33}</div>
            <div style="font-size: 8pt; font-weight: bold; color: #64748b; margin-top: 4px;">Desempenho</div>
          </div>
          <div style="flex: 1; min-width: 75px; padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 18pt; font-weight: 900; color: #10b981;">${site.acessibilidade ?? 92}</div>
            <div style="font-size: 8pt; font-weight: bold; color: #64748b; margin-top: 4px;">Acessibilidade</div>
          </div>
          <div style="flex: 1; min-width: 75px; padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 18pt; font-weight: 900; color: #10b981;">${site.praticas ?? 96}</div>
            <div style="font-size: 8pt; font-weight: bold; color: #64748b; margin-top: 4px;">Práticas recomendadas</div>
          </div>
          <div style="flex: 1; min-width: 75px; padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 18pt; font-weight: 900; color: #10b981;">${site.seo !== undefined ? site.seo : 92}</div>
            <div style="font-size: 8pt; font-weight: bold; color: #64748b; margin-top: 4px;">SEO</div>
          </div>
          <div style="flex: 1; min-width: 75px; padding: 10px; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-size: 12pt; font-weight: 900; color: #d97706; background: #fef3c7; border-radius: 12px; display: inline-block; padding: 2px 8px;">1/2</div>
            <div style="font-size: 8pt; font-weight: bold; color: #64748b; margin-top: 4px;">Navegação agêntica</div>
          </div>
        </div>

        <ul style="padding-left: 20px;">
          ${site.oportunidade1 ? `<li>${site.oportunidade1}</li>` : ''}
          ${site.oportunidade2 ? `<li>${site.oportunidade2}</li>` : ''}
        </ul>
      </div>
    ` : '';

    const anunciosHtml = anuncios ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #334155; margin-top: 0; font-size: 14pt;">Tráfego Pago (IA)</h3>
        <p>Anuncia no Google: ${anuncios.clienteAnunciaGoogle ? 'Sim' : 'Não'} | Concorrentes: ${anuncios.concorrentesGoogle ?? 0}.</p>
        <p>Anuncia no Meta: ${anuncios.clienteAnunciaMeta ? 'Sim' : 'Não'} | Concorrentes: ${anuncios.concorrentesMeta ?? 0}.</p>
        <ul style="padding-left: 20px;">
          ${anuncios.oportunidade1 ? `<li>${anuncios.oportunidade1}</li>` : ''}
          ${anuncios.oportunidade2 ? `<li>${anuncios.oportunidade2}</li>` : ''}
        </ul>
      </div>
    ` : '';

    const cData = prospectData?.calculatorData || {};
    const ticketMedio = cData.ticketMedio || 1500;
    const buscasMes = 500;
    const cons = Math.round(buscasMes * 0.02 * ticketMedio);
    const mod = Math.round(buscasMes * 0.04 * ticketMedio);
    const agr = Math.round(buscasMes * 0.06 * ticketMedio);

    const dinheiroMesaHtml = `
      <div style="background-color: #f8fafc; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #334155; margin-top: 0; font-size: 14pt;">Dinheiro na Mesa (Estimativa)</h3>
        <p>Com um ticket médio de R$ ${ticketMedio.toLocaleString('pt-BR')} e 500 buscas mensais estimadas na região, uma campanha agressiva captando 6% das buscas pode gerar até <strong>R$ ${agr.toLocaleString('pt-BR')} de faturamento extra por mês.</strong></p>
      </div>
    `;

    const planoHtml = planoAcao.length > 0 ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #334155; margin-top: 0; font-size: 14pt;">Plano de Ação de 30 Dias (IA)</h3>
        <ul style="padding-left: 20px;">
          ${planoAcao.map((acao: any) => `<li style="margin-bottom: 8px;"><strong>${acao.titulo || ''}</strong>: ${acao.descricao || ''}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const concorrentesHtml = concorrentes.length > 0 ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #334155; margin-top: 0; font-size: 14pt;">Análise de Concorrentes (IA)</h3>
        <ul style="padding-left: 20px;">
          ${concorrentes.map((c: any) => `<li style="margin-bottom: 8px;"><strong>${c.nome || ''}</strong>: Nota ${c.nota ?? 'N/A'} (${c.avaliacoes ?? 0} avaliações). Anuncia no Google: ${c.anunciaGoogle ? 'Sim' : 'Não'}.</li>`).join('')}
        </ul>
      </div>
    ` : '';

    const selectedMap = (gmn as any)?.selectedMapForCarta
      || (diagnosticData as any)?.selectedMapForCarta
      || (diagnosticData as any)?.gmn?.selectedMapForCarta
      || (prospectData as any)?.selectedMapForCarta
      || (prospectData as any)?.marketingDiagnostic?.selectedMapForCarta
      || (prospectData as any)?.marketingDiagnostic?.gmn?.selectedMapForCarta
      || (prospeccaoParaEditar as any)?.selectedMapForCarta;

    const mapImageUrl = selectedMap?.mapImageUrl
      || (selectedMap?.scanId ? `https://lf-static-v2.localfalcon.com/image/${selectedMap.scanId}` : '')
      || gmn?.mapaCalorImg
      || (gmn?.scanId ? `https://lf-static-v2.localfalcon.com/image/${gmn.scanId}` : '')
      || (diagnosticData as any)?.mapaCalorImg
      || ((diagnosticData as any)?.scanId ? `https://lf-static-v2.localfalcon.com/image/${(diagnosticData as any).scanId}` : '')
      || (prospectData as any)?.mapaCalorImg
      || (prospectData as any)?.mapaCalorUrl
      || ((prospectData as any)?.scanId ? `https://lf-static-v2.localfalcon.com/image/${(prospectData as any).scanId}` : '')
      || (prospectData as any)?.marketingDiagnostic?.gmn?.mapaCalorImg
      || ((prospectData as any)?.marketingDiagnostic?.gmn?.scanId ? `https://lf-static-v2.localfalcon.com/image/${(prospectData as any).marketingDiagnostic.gmn.scanId}` : '')
      || (prospeccaoParaEditar as any)?.mapaCalorImg
      || ((prospeccaoParaEditar as any)?.scanId ? `https://lf-static-v2.localfalcon.com/image/${(prospeccaoParaEditar as any).scanId}` : '')
      || '';

    const searchRadiusKm = selectedMap?.radius
      || gmn?.radius
      || (diagnosticData as any)?.gmn?.radius
      || (diagnosticData as any)?.radius
      || (prospectData as any)?.radius
      || (prospectData as any)?.marketingDiagnostic?.gmn?.radius
      || 5;

    const mapaCalorHtml = mapImageUrl ? `
      <div style="margin: 24px 0; text-align: center;">
        <img src="${mapImageUrl}" alt="Mapa de calor real do Local Falcon" style="display: block; width: 100%; max-width: 760px; height: auto; margin: 0 auto; border-radius: 12px; border: 1px solid #cbd5e1;" />
        <div style="margin-top: 8px; font-size: 9.5pt; color: #475569; font-weight: 600; font-family: sans-serif;">
          📍 Raio utilizado na busca: <span style="color: #0f172a; font-weight: 800;">${searchRadiusKm} km</span>
        </div>
      </div>
    ` : `
      <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; color: #64748b; font-family: sans-serif;">
        <div style="font-size: 14pt; font-weight: bold; color: #475569; margin-bottom: 6px;">🗺️ Mapa de Calor (Local Falcon)</div>
        <div style="font-size: 9.5pt; color: #64748b; margin-bottom: 4px;">Nenhuma varredura do Local Falcon encontrada para esta prospect. Realize a varredura no diagnóstico de marketing ou adicione a imagem do mapa.</div>
        <div style="font-size: 9pt; font-weight: 600; color: #475569;">📍 Raio configurado para busca: ${searchRadiusKm} km</div>
      </div>
    `;
    const fichaClinicaHtml = `
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin:20px 0; font-family:Arial,sans-serif; color:#0f172a;">
        <div style="font-size:18pt; font-weight:800; margin-bottom:6px;">${clinica || prospectData?.clinicName || 'Clínica'}</div>
        <div style="font-size:10pt; color:#475569; margin-bottom:10px;">${enderecoCompleto || prospectData?.fullAddress || cidadeBairro || prospectData?.location || 'Endereço não informado'}</div>
        <div style="font-size:11pt; font-weight:700;">${cleanRating(prospectData?.gmnRating)} <span style="color:#f59e0b;">★★★★★</span> <span style="color:#64748b; font-weight:400;">(${cleanReviews(prospectData?.gmnReviewsCount, prospectData?.gmnRating)} avaliações)</span></div>
      </div>
    `;
    const pillarItems = [
      ['Google', placar?.google], ['Reputação', placar?.reputacao], ['Instagram', placar?.instagram], ['Site', placar?.site], ['Ads', placar?.ads]
    ];
    const placarPilaresHtml = placar ? `
      <div style="background:#ffffff; color:#0f172a; border-radius:16px; padding:20px; margin:20px 0; font-family:Arial,sans-serif; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.04); -webkit-print-color-adjust:exact; print-color-adjust:exact;">
        <h3 style="margin:0 0 16px; font-size:15pt; color:#0f172a;">Placar por pilar</h3>
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between;">
          ${pillarItems.map(([label, value]) => `<div style="flex:1; min-width:90px; border:1px solid #e2e8f0; background:#f8fafc; border-radius:12px; padding:12px; text-align:center; -webkit-print-color-adjust:exact; print-color-adjust:exact;"><div style="font-size:20pt; font-weight:800; color:#059669;">${value ?? 'N/A'}</div><div style="font-size:9pt; font-weight:700; color:#334155; margin-top:6px;">${label}</div></div>`).join('')}
        </div>
      </div>
    ` : '';
    const effectiveClientRank = hasValidClientRank ? clientRank : (gmn?.posicaoMedia ? Number(gmn.posicaoMedia) : 7);
    const clientAddress = enderecoCompleto || prospectData?.fullAddress || cidadeBairro || prospectData?.location || '';
    const clientRating = cleanRating(prospectData?.gmnRating || gmn?.rating || '4.8');
    const clientReviews = cleanReviews(prospectData?.gmnReviewsCount, prospectData?.gmnRating || gmn?.rating);

    const cleanReviewsStr = (val: any) => String(val ?? '0').replace(/avaliaç[õo]es/gi, '').trim();

    const clientRankingHtml = `
      <div style="background-color: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 10px 14px; margin: 0; display: flex; align-items: center; gap: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <div style="width: 30px; height: 30px; border-radius: 50%; background-color: #dc2626; color: #ffffff; font-weight: bold; font-size: 11pt; display: flex; align-items: center; justify-content: center; flex-shrink: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          ${effectiveClientRank}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 700; font-size: 10.5pt; color: #991b1b; margin-bottom: 3px; line-height: 1.3;">
            ${clinica || prospectData?.clinicName || 'Sua clínica'} (você)
          </div>
          ${clientAddress ? `<div style="font-size: 8.5pt; color: #64748b; margin-bottom: 3px; line-height: 1.3;">${clientAddress}</div>` : ''}
          <div style="font-size: 9pt; font-weight: 700; color: #334155; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span>${clientRating}</span>
            <span style="color: #f59e0b;">★★★★★</span>
            <span style="color: #94a3b8; font-weight: 400; font-size: 8.5pt;">(${cleanReviewsStr(clientReviews)} avaliações)</span>
          </div>
        </div>
      </div>
    `;
    const rankingHtml = (hasValidClientRank || concorrentes.length > 0) ? `
      <div style="background: #ffffff; color: #0f172a; border-radius: 14px; padding: 14px 18px; margin: 14px 0; font-family: Arial, sans-serif; border: 1px solid #e2e8f0; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <h3 style="margin: 0 0 10px 0; font-size: 13.5pt; font-weight: 800; color: #0f172a;">
          ${effectiveClientRank === 1 ? 'Concorrentes após você' : 'Quem aparece na frente de você'}
        </h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${effectiveClientRank === 1 ? clientRankingHtml : ''}
          ${concorrentes.length ? concorrentes.map((c: any) => {
            const addr = c.endereco || c.address || c.fullAddress || c.location || c.vicinity || c.formatted_address || cidadeBairro || prospectData?.location || '';
            const ratingVal = c.nota ?? c.rating ?? c.gmnRating ?? c.stars ?? c.score;
            const formattedRating = ratingVal ? Number(ratingVal).toFixed(1) : '—';
            const rawRev = c.avaliacoes ?? c.reviews ?? c.reviewsCount ?? c.reviews_count ?? c.user_ratings_total ?? c.gmnReviewsCount;
            const revCount = rawRev != null ? cleanReviewsStr(rawRev) : null;
            return `
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; margin: 0; display: flex; align-items: center; gap: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              <div style="width: 30px; height: 30px; border-radius: 50%; background-color: #3b82f6; color: #ffffff; font-weight: bold; font-size: 11pt; display: flex; align-items: center; justify-content: center; flex-shrink: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                ${c.posicao}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700; font-size: 10.5pt; color: #0f172a; margin-bottom: 3px; line-height: 1.3;">
                  ${c.nome || c.name || 'Concorrente'}
                </div>
                ${addr ? `<div style="font-size: 8.5pt; color: #64748b; margin-bottom: 3px; line-height: 1.3;">${addr}</div>` : ''}
                <div style="font-size: 9pt; font-weight: 700; color: #334155; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span>${formattedRating}</span>
                  <span style="color: #f59e0b;">★★★★★</span>
                  <span style="color: #94a3b8; font-weight: 400; font-size: 8.5pt;">(${revCount !== null ? `${revCount} avaliações` : 'sem avaliações'})</span>
                </div>
              </div>
            </div>
          `;
          }).join('') : '<p style="color: #059669; font-size: 10pt; font-weight: 700; margin: 6px 0;">Sua empresa está em 1º lugar entre os resultados analisados.</p>'}
          ${effectiveClientRank !== 1 ? clientRankingHtml : ''}
        </div>
      </div>
    ` : '';
    const pageSpeedHtml = site ? `
      <div style="background:#ffffff; color:#0f172a; border-radius:16px; padding:20px; margin:20px 0; font-family:Arial,sans-serif; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.04); -webkit-print-color-adjust:exact; print-color-adjust:exact;">
        <h3 style="margin:0 0 16px; font-size:15pt; color:#0f172a;">Velocidade e SEO</h3>
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between;">
          ${[['Desempenho', site.velocidade], ['Acessibilidade', site.acessibilidade], ['Práticas recomendadas', site.praticas], ['SEO', site.seo]].map(([label, value]) => `<div style="flex:1; min-width:100px; border:1px solid #e2e8f0; background:#f8fafc; border-radius:12px; padding:12px; text-align:center; -webkit-print-color-adjust:exact; print-color-adjust:exact;"><div style="font-size:20pt; font-weight:800; color:#059669;">${value ?? 'Sem dados'}</div><div style="font-size:9pt; font-weight:700; color:#334155; margin-top:6px;">${label}</div></div>`).join('')}
        </div>
      </div>
    ` : '';
    const dinheiroMesaVisualHtml = `
      <div style="background:#ffffff; color:#0f172a; border-radius:16px; padding:20px; margin:20px 0; font-family:Arial,sans-serif; border:1px solid #e2e8f0; box-shadow:0 2px 8px rgba(0,0,0,0.04); -webkit-print-color-adjust:exact; print-color-adjust:exact;">
        <h3 style="margin:0 0 6px; font-size:15pt; color:#0f172a;">Dinheiro na mesa</h3><p style="margin:0 0 16px; color:#475569; font-size:10pt;">Estimativa da receita que deixa de entrar por mês.</p>
        <div style="margin:12px 0;"><strong style="color:#0f172a;">Conservador</strong><span style="float:right; color:#059669; font-size:14pt; font-weight:bold;">R$ ${cons.toLocaleString('pt-BR')}/mês</span><div style="height:10px; border-radius:8px; background:#e2e8f0; margin-top:8px; -webkit-print-color-adjust:exact; print-color-adjust:exact;"><div style="width:33%; height:10px; border-radius:8px; background:#10b981; -webkit-print-color-adjust:exact; print-color-adjust:exact;"></div></div></div>
        <div style="margin:12px 0;"><strong style="color:#0f172a;">Moderado</strong><span style="float:right; color:#059669; font-size:14pt; font-weight:bold;">R$ ${mod.toLocaleString('pt-BR')}/mês</span><div style="height:10px; border-radius:8px; background:#e2e8f0; margin-top:8px; -webkit-print-color-adjust:exact; print-color-adjust:exact;"><div style="width:50%; height:10px; border-radius:8px; background:#10b981; -webkit-print-color-adjust:exact; print-color-adjust:exact;"></div></div></div>
        <div style="margin:12px 0;"><strong style="color:#0f172a;">Agressivo</strong><span style="float:right; color:#059669; font-size:14pt; font-weight:bold;">R$ ${agr.toLocaleString('pt-BR')}/mês</span><div style="height:10px; border-radius:8px; background:#e2e8f0; margin-top:8px; -webkit-print-color-adjust:exact; print-color-adjust:exact;"><div style="width:100%; height:10px; border-radius:8px; background:#10b981; -webkit-print-color-adjust:exact; print-color-adjust:exact;"></div></div></div>
      </div>
    `;

    const keywordTermo = (prospectData as any)?.keyword || (diagnosticData as any)?.termoPesquisado || (diagnosticData as any)?.gmn?.keyword || 'dentista';

    const cardLegendaMapaHtml = `
      <div style="background-color: #ffffff; padding: 12px 14px; border-radius: 12px; font-family: sans-serif; text-align: center; margin: 12px 0; color: #0f172a; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; font-size: 9.5pt; font-weight: bold;">
          <span style="color: #059669; display: inline-flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #10b981;"></span> Top 3 (1ª a 3ª posição)
          </span>
          <span style="color: #d97706; display: inline-flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #f59e0b;"></span> Aparece (4ª a 10ª)
          </span>
          <span style="color: #dc2626; display: inline-flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ef4444;"></span> 11ª posição ou pior
          </span>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 10pt; color: #475569; flex-wrap: wrap;">
          <span>Searching</span>
          <span style="background-color: #f1f5f9; color: #0f172a; padding: 3px 10px; border-radius: 6px; font-weight: bold; border: 1px solid #cbd5e1;">
            "${keywordTermo}"
          </span>
          <span>on</span>
          <span style="background-color: #f8fafc; color: #0f172a; padding: 3px 10px; border-radius: 16px; font-weight: bold; border: 1px solid #e2e8f0; display: inline-flex; align-items: center; gap: 4px;">
            📍 Google Maps
          </span>
          <span style="background-color: #e0e7ff; color: #3730a3; padding: 3px 10px; border-radius: 16px; font-weight: bold; border: 1px solid #c7d2fe; display: inline-flex; align-items: center; gap: 4px;">
            📍 Raio: ${searchRadiusKm} km
          </span>
          <span>for:</span>
        </div>
      </div>
    `;

    const cardBuscaGoogleHtml = `
      <div style="background-color: #ffffff; padding: 12px 14px; border-radius: 14px; font-family: sans-serif; text-align: center; margin: 12px 0; color: #0f172a; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; font-size: 9.5pt; font-weight: bold;">
          <span style="color: #059669; display: inline-flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #10b981;"></span> Top 3 (1ª a 3ª posição)
          </span>
          <span style="color: #d97706; display: inline-flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #f59e0b;"></span> Aparece (4ª a 10ª)
          </span>
          <span style="color: #dc2626; display: inline-flex; align-items: center; gap: 4px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ef4444;"></span> 11ª posição ou pior
          </span>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 10pt; color: #475569; flex-wrap: wrap; margin-bottom: 8px;">
          <span>Searching</span>
          <span style="background-color: #f1f5f9; color: #0f172a; padding: 3px 10px; border-radius: 6px; font-weight: bold; border: 1px solid #cbd5e1;">
            "${keywordTermo}"
          </span>
          <span>on</span>
          <span style="background-color: #f8fafc; color: #0f172a; padding: 3px 10px; border-radius: 16px; font-weight: bold; border: 1px solid #e2e8f0; display: inline-flex; align-items: center; gap: 4px;">
            📍 Google Maps
          </span>
          <span style="background-color: #e0e7ff; color: #3730a3; padding: 3px 10px; border-radius: 16px; font-weight: bold; border: 1px solid #c7d2fe; display: inline-flex; align-items: center; gap: 4px;">
            📍 Raio: ${searchRadiusKm} km
          </span>
          <span>for:</span>
        </div>
        <div style="background-color: #ffffff; color: #0f172a; padding: 10px 14px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">
          <div style="font-size: 11pt; font-weight: 800; margin-bottom: 3px; color: #0f172a; text-align: center;">${clinica || prospectData?.clinicName || 'Clínica Odontológica'}</div>
          <div style="font-size: 8.5pt; color: #475569; margin-bottom: 5px; line-height: 1.3; text-align: center;">${enderecoCompleto || prospectData?.fullAddress || cidadeBairro || prospectData?.location || 'Endereço não informado'}</div>
          <div style="font-size: 9.5pt; font-weight: 700; color: #0f172a; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>${prospectData?.gmnRating || '4.9'}</span>
            <span style="color: #f59e0b;">★★★★★</span>
            <span style="color: #64748b; font-weight: normal; font-size: 8.5pt;">(${prospectData?.gmnReviewsCount || 0})</span>
          </div>
        </div>
      </div>
    `;

    let html = getCanonicalHtml();

    // Purga qualquer texto de legenda do Local Falcon / Scan ID do documento ao aplicar as tags
    html = html.replace(/(<p[^>]*>)?\s*Mapa da varredura Local Falcon[^\n<]*(\s*<\/p>)?/gi, '');
    html = html.replace(/Mapa da varredura Local Falcon\s*\|\s*Scan:\s*[^\s<]+/gi, '');
    html = html.replace(/Scan:\s*[a-f0-9]{10,}/gi, '');

    let appended = '';

    const visualTags: Record<string, string> = {
      '{{IA_CARD_BUSCA_GOOGLE}}': cardBuscaGoogleHtml,
      '{{IA_CARD_LEGENDA_MAPA}}': cardLegendaMapaHtml,
      '{{IA_MAPA_CALOR}}': mapaCalorHtml,
      '{{IA_FICHA_CLINICA}}': fichaClinicaHtml,
      '{{IA_PLACAR_PILARES}}': placarPilaresHtml,
      '{{IA_RANKING_CONCORRENTES}}': rankingHtml,
      '{{IA_PAGESPEED}}': pageSpeedHtml,
      '{{IA_DINHEIRO_NA_MESA}}': dinheiroMesaVisualHtml,
      '{{IA_RESUMO}}': resumoHtml,
      '{{IA_PLACAR}}': placarHtml,
      '{{IA_GMN}}': gmnHtml,
      '{{IA_SITE}}': siteHtml,
      '{{IA_ANUNCIOS}}': anunciosHtml,
      '{{IA_DINHEIRO}}': dinheiroMesaHtml,
      '{{IA_PLANO_ACAO}}': planoHtml,
      '{{IA_CONCORRENTES}}': concorrentesHtml,
    };
    let applied = 0;
    let unavailable = 0;
    Object.entries(visualTags).forEach(([tag, value]) => {
      if (!html.includes(tag)) return;
      if (value) {
        html = html.split(tag).join(value);
        applied += 1;
      } else {
        unavailable += 1;
      }
    });
    const liveProspect = { ...prospectData, clinicName: clinica || prospectData?.clinicName, ownerName: donoClinica || prospectData?.ownerName, location: cidadeBairro || prospectData?.location, fullAddress: enderecoCompleto || prospectData?.fullAddress };
    DEFAULT_VARIABLE_TAGS.forEach((tag) => {
      if (visualTags[tag.code] !== undefined) return;
      if (!html.includes(tag.code)) return;
      html = html.split(tag.code).join(tag.exampleValue(liveProspect, diagnosticData));
      applied += 1;
    });
    setEditorHtml(html);
    Swal.fire({ toast: true, position: 'top-end', icon: applied ? 'success' : 'info', title: applied ? `${applied} tipo(s) de tag aplicado(s)` : 'Nenhuma tag encontrada na carta', text: unavailable ? `${unavailable} tag(s) visual(is) sem dados reais disponíveis.` : undefined, showConfirmButton: false, timer: 2600 });
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

  const handleMarcarFinalizada = async () => {
    if (isSaving) return;
    const newStatus = !isFinalizada;
    if (prospeccaoParaEditar && prospeccaoParaEditar.id) {
      setIsSaving(true);
      try {
        await updateProspeccaoDoc(prospeccaoParaEditar.id, { isFinalizada: newStatus });
        setIsFinalizada(newStatus);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: newStatus ? 'Marcada como Finalizada (Pronta p/ Entrega)!' : 'Revertido para Em Andamento',
          showConfirmButton: false,
          timer: 2000
        });
      } catch (error) {
        console.error('Erro ao alterar status:', error);
        Swal.fire('Erro', 'Não foi possível alterar o status.', 'error');
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsFinalizada(newStatus);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: newStatus ? 'Marcada como Finalizada! Clique em Salvar.' : 'Status Revertido',
        showConfirmButton: false,
        timer: 2000
      });
    }
  };

  const isInitialModeloLoadedRef = useRef(false);

  useEffect(() => {
    if (isModeloOnlyMode && modeloIdParaEditar && modelos.length > 0 && !isInitialModeloLoadedRef.current) {
      const mod = modelos.find(m => m.id === modeloIdParaEditar);
      if (mod) {
        isInitialModeloLoadedRef.current = true;
        setSelectedModeloId(mod.id);
        setNomeModeloState(mod.nome);
        setDescricaoModeloState(mod.descricao || '');
        if (editorRef.current) {
          setEditorHtml(mod.conteudo);
        }
      }
    } else if (isModeloOnlyMode && !modeloIdParaEditar && !selectedModeloId && !isInitialModeloLoadedRef.current) {
      isInitialModeloLoadedRef.current = true;
      setNomeModeloState('Novo Modelo');
      setDescricaoModeloState('');
    }
  }, [isModeloOnlyMode, modeloIdParaEditar, modelos, selectedModeloId]);

  // ── Modelos ──────────────────────────────────────────────────────────────
  const handleSelectModeloInMode = (modeloId: string) => {
    setSelectedModeloId(modeloId);
    if (!modeloId) {
      setNomeModeloState('Novo Modelo');
      setDescricaoModeloState('');
      if (editorRef.current) {
        setEditorHtml('<p>Escreva aqui o conteúdo do novo modelo...</p>');
      }
      return;
    }
    const mod = modelos.find(m => m.id === modeloId);
    if (mod) {
      setNomeModeloState(mod.nome);
      setDescricaoModeloState(mod.descricao || '');
      if (editorRef.current) {
        setEditorHtml(mod.conteudo);
      }
    }
  };

  const handleSaveModeloOnly = async () => {
    if (!editorRef.current) return;
    const rawHtml = getCanonicalHtml();

    if (!nomeModeloState.trim()) {
      Swal.fire('Nome Obrigatório', 'Por favor, informe o nome do modelo.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const html = await processAndUploadAllImagesInHtml(rawHtml);
      if (selectedModeloId) {
        await updateModeloProspeccao(selectedModeloId, {
          nome: nomeModeloState.trim(),
          descricao: descricaoModeloState.trim(),
          conteudo: html
        });
      } else {
        const newId = await addModeloProspeccao({
          nome: nomeModeloState.trim(),
          descricao: descricaoModeloState.trim(),
          conteudo: html,
          ordem: modelos.length
        });
        setSelectedModeloId(newId);
      }

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Modelo salvo com sucesso!',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
    } catch (e: any) {
      console.error('Erro ao salvar modelo:', e);
      Swal.fire('Erro', e.message || String(e), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveModelo = async () => {
    if (!editorRef.current) return;
    const currentModel = modelos.find(m => m.id === selectedModeloId);

    const { value: nome } = await Swal.fire({
      title: 'Salvar Modelo de Prospecção',
      text: 'Digite o nome para identificar este modelo:',
      input: 'text',
      inputValue: currentModel ? currentModel.nome : '',
      showCancelButton: true,
      confirmButtonText: 'Salvar Modelo',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => { if (!value || !value.trim()) return 'Você precisa digitar um nome!'; }
    });

    if (!nome) return;

    try {
      const rawHtml = getCanonicalHtml();
      const html = await processAndUploadAllImagesInHtml(rawHtml);
      const existingIndex = modelos.findIndex(m => m.nome.trim().toLowerCase() === nome.trim().toLowerCase());
      let newSelectedId = '';

      if (existingIndex >= 0) {
        const { isConfirmed } = await Swal.fire({
          title: 'Modelo já existe',
          text: `Já existe um modelo chamado "${nome}". Deseja atualizar o conteúdo dele com a versão atual?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sim, atualizar modelo',
          cancelButtonText: 'Cancelar'
        });
        if (!isConfirmed) return;
        await updateModeloProspeccao(modelos[existingIndex].id, {
          nome: nome.trim(),
          conteudo: html,
          updatedAt: new Date().toISOString()
        });
        newSelectedId = modelos[existingIndex].id;
      } else {
        newSelectedId = await addModeloProspeccao({
          nome: nome.trim(),
          descricao: '',
          conteudo: html,
          ordem: modelos.length,
          createdAt: new Date().toISOString()
        });
      }

      setSelectedModeloId(newSelectedId);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `Modelo "${nome.trim()}" salvo com sucesso!`,
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true
      });
    } catch (err: any) {
      console.error('Erro ao salvar modelo:', err);
      Swal.fire('Erro ao Salvar', err.message || 'Não foi possível salvar o modelo no banco de dados.', 'error');
    }
  };

  const handleLoadModelo = (modeloId: string) => {
    setSelectedModeloId(modeloId);
    if (!modeloId) {
      if (editorRef.current) {
        setEditorHtml(conteudoInicial);
      }
      return;
    }
    const modelo = modelos.find(m => m.id === modeloId);
    if (modelo && editorRef.current) {
      setEditorHtml(modelo.conteudo);
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

  const fontSizeLabels: Record<number, string> = {
    1: '10pt',
    2: '12pt',
    3: '14pt',
    4: '18pt',
    5: '24pt',
    6: '32pt',
    7: '48pt',
  };

  const handleApplyFontSize = (numSize: number) => {
    const boundedSize = Math.max(1, Math.min(7, numSize));
    setSelectedFontSizeNum(boundedSize);

    restoreSelection();
    const sel = window.getSelection();
    let currentRange: Range | null = null;
    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      currentRange = sel.getRangeAt(0).cloneRange();
    } else if (savedSelectionRef.current && !savedSelectionRef.current.collapsed) {
      currentRange = savedSelectionRef.current.cloneRange();
    }

    document.execCommand('fontSize', false, String(boundedSize));

    if (currentRange) {
      const currentSel = window.getSelection();
      if (currentSel) {
        const anchor = currentSel.anchorNode;
        const parent = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement;
        if (parent) {
          const fontEl = parent.closest('font[size], span[style*="font-size"]');
          if (fontEl) {
            const newRange = document.createRange();
            newRange.selectNodeContents(fontEl);
            currentSel.removeAllRanges();
            currentSel.addRange(newRange);
            savedSelectionRef.current = newRange.cloneRange();
          } else if (currentRange.startContainer.isConnected && currentRange.endContainer.isConnected) {
            currentSel.removeAllRanges();
            currentSel.addRange(currentRange);
            savedSelectionRef.current = currentRange.cloneRange();
          }
        }
      }
    }

    editorRef.current?.focus();
    handleEditorInput();
  };

  const handleFormat = (command: string, value?: string) => {
    if (command === 'removeFormat') {
      clearFormatting();
      return;
    }

    restoreSelection();
    const sel = window.getSelection();
    let currentRange: Range | null = null;
    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      currentRange = sel.getRangeAt(0).cloneRange();
    } else if (savedSelectionRef.current && !savedSelectionRef.current.collapsed) {
      currentRange = savedSelectionRef.current.cloneRange();
    }

    document.execCommand(command, false, value);

    if (currentRange) {
      setTimeout(() => {
        const currentSel = window.getSelection();
        if (currentSel) {
          const anchor = currentSel.anchorNode;
          const parent = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement;

          if (command === 'fontSize' && parent) {
            const fontEl = parent.closest('font[size], span[style*="font-size"]');
            if (fontEl) {
              const newRange = document.createRange();
              newRange.selectNodeContents(fontEl);
              currentSel.removeAllRanges();
              currentSel.addRange(newRange);
              savedSelectionRef.current = newRange.cloneRange();
              editorRef.current?.focus();
              handleEditorInput();
              return;
            }
          }

          if (currentRange.startContainer.isConnected && currentRange.endContainer.isConnected) {
            currentSel.removeAllRanges();
            currentSel.addRange(currentRange);
            savedSelectionRef.current = currentRange.cloneRange();
          }
        }
        editorRef.current?.focus();
        handleEditorInput();
      }, 0);
    } else {
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
    const targetEl = e.target as HTMLElement;
    if (!targetEl) return;

    if (isRemoveElementMode) {
      e.preventDefault();
      e.stopPropagation();

      const hrTarget = targetEl.tagName === 'HR' ? targetEl : targetEl.closest('hr');
      if (hrTarget) {
        hrTarget.remove();
        handleEditorInput();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Linha removida!', showConfirmButton: false, timer: 1500 });
        return;
      }

      const imgTarget = targetEl.tagName === 'IMG' ? targetEl : targetEl.closest('img');
      if (imgTarget) {
        imgTarget.remove();
        setSelectedEditorImage(null);
        handleEditorInput();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Imagem removida!', showConfirmButton: false, timer: 1500 });
        return;
      }

      const blockTarget = targetEl.closest('table, blockquote, div[style*="border"], div[style*="background"], p, h1, h2, h3, h4, li') || targetEl;

      if (blockTarget && blockTarget !== editorRef.current && !blockTarget.classList.contains('a4-page-content') && !blockTarget.classList.contains('a4-page')) {
        blockTarget.remove();
        handleEditorInput();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Elemento removido!', showConfirmButton: false, timer: 1500 });
        return;
      }
    }

    if (targetEl instanceof HTMLElement) {
        const currentBlock = targetEl.closest('p, div, h1, h2, h3, h4, section, hr, li') || targetEl;
        if (currentBlock instanceof HTMLElement && (currentBlock.style.borderBottom || currentBlock.style.borderBottomWidth)) {
          const rect = currentBlock.getBoundingClientRect();
          const distFromBottom = Math.abs(e.clientY - rect.bottom);
          if (distFromBottom <= 14) {
            e.preventDefault();
            e.stopPropagation();
            currentBlock.style.borderBottom = '';
            currentBlock.style.borderBottomWidth = '';
            currentBlock.style.borderBottomStyle = '';
            currentBlock.style.paddingBottom = '';
            handleEditorInput();
            return;
          }
        }
    }

    if (targetEl && targetEl.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedEditorImage(targetEl as HTMLImageElement);
    } else if (selectedEditorImage && !(targetEl?.closest('.inline-image-cropper-overlay'))) {
      setSelectedEditorImage(null);
    }

    updateActivePageFromSelection();

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let node = selection.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (node instanceof HTMLElement) {
        const block = node.closest('p, div, h1, h2, h3, li') as HTMLElement || node;
        const lh = block.style.lineHeight || window.getComputedStyle(block).lineHeight;
        if (lh) {
          const parsed = parseFloat(lh);
          if (!isNaN(parsed) && parsed < 10) {
            setSelectedLineHeight(String(parsed));
          }
        }
      }
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
    if (!base64Image || !base64Image.startsWith('data:image')) return base64Image;
    try {
      const response = await fetch('https://crm.talidigital.com.br/upload.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
      const data = await response.json();
      if (data.success && data.url) {
        const secureUrl = data.url.replace(/^http:\/\//i, 'https://');
        return secureUrl;
      }
    } catch (error) {
      console.warn('Upload para Hostinger falhou:', error);
    }
    return base64Image;
  };

  const processAndUploadAllImagesInHtml = async (rawHtml: string): Promise<string> => {
    if (!rawHtml) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;
    const images = Array.from(tempDiv.querySelectorAll('img'));

    let hasUploaded = false;
    for (const img of images) {
      const src = img.getAttribute('src')?.trim() || '';
      if (src.startsWith('data:image')) {
        hasUploaded = true;
        const uploadedUrl = await uploadImageToHostinger(src);
        if (uploadedUrl && uploadedUrl.startsWith('http')) {
          img.setAttribute('src', uploadedUrl);
        }
      }
    }

    if (hasUploaded && editorRef.current) {
      editorRef.current.innerHTML = tempDiv.innerHTML;
    }

    return tempDiv.innerHTML;
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

    // 1. Arraste interno de imagem entre folhas A4
    if (draggedImageRef.current) {
      const draggedImg = draggedImageRef.current;
      draggedImageRef.current = null;

      const targetEl = e.target as HTMLElement;
      const targetPageContent = targetEl.closest<HTMLElement>('.a4-page-content');

      if (targetPageContent && editorRef.current?.contains(targetPageContent)) {
        let wrapper: HTMLElement = draggedImg;
        let parent = draggedImg.parentElement;
        while (parent && parent !== editorRef.current && !parent.classList.contains('a4-page-content')) {
          if (parent.tagName === 'P' || parent.tagName === 'FIGURE' || parent.classList.contains('image-wrapper') || parent.tagName === 'DIV') {
            wrapper = parent;
            break;
          }
          parent = parent.parentElement;
        }

        if (targetEl && targetEl !== targetPageContent && targetPageContent.contains(targetEl)) {
          targetPageContent.insertBefore(wrapper, targetEl);
        } else {
          targetPageContent.appendChild(wrapper);
        }

        draggedImg.style.maxHeight = '';
        editorRef.current?.focus();
        handleEditorInput();
        balancePagesFrom(targetPageContent);
        return;
      }
    }

    // 2. Upload externo de novas imagens
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      for (let i = 0; i < dt.files.length; i++) {
        const file = dt.files[i];
        if (file.type.startsWith('image/')) {
          resizeImage(file).then(resizedBase64 => {
            uploadImageToHostinger(resizedBase64).then(finalUrl => {
              const targetEl = e.target as HTMLElement;
              const targetPageContent = targetEl.closest<HTMLElement>('.a4-page-content') || editorRef.current?.querySelector('.a4-page-content');
              if (targetPageContent) {
                const p = document.createElement('p');
                p.style.textAlign = 'center';
                p.style.margin = '12px 0';
                p.innerHTML = `<img src="${finalUrl}" style="max-width: 100%; border-radius: 8px; margin: 0 auto; display: block;" />`;
                targetPageContent.appendChild(p);
                handleEditorInput();
              }
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

  const handleInsertTable = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Inserir Tabela na Carta',
      html: `
        <div style="display:flex; flex-direction:column; gap:12px; text-align:left; font-size:13px; margin-top:10px;">
          <div>
            <label style="font-weight:bold; display:block; margin-bottom:4px;">Número de Linhas:</label>
            <input id="swal-rows" type="number" min="1" max="20" value="3" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-weight:bold; display:block; margin-bottom:4px;">Número de Colunas:</label>
            <input id="swal-cols" type="number" min="1" max="10" value="3" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box;">
          </div>
          <div>
            <label style="font-weight:bold; display:block; margin-bottom:4px;">Estilo da Tabela:</label>
            <select id="swal-style" class="swal2-input" style="margin:0; width:100%; box-sizing:border-box; height:40px;">
              <option value="modern">Moderna com Cabeçalho Roxo</option>
              <option value="dark">Escura Elegante (Moderna)</option>
              <option value="simple">Simples com Bordas</option>
              <option value="minimal">Minimalista Limpa</option>
            </select>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Inserir Tabela',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#6366f1',
      preConfirm: () => {
        const rows = parseInt((document.getElementById('swal-rows') as HTMLInputElement).value || '3', 10);
        const cols = parseInt((document.getElementById('swal-cols') as HTMLInputElement).value || '3', 10);
        const style = (document.getElementById('swal-style') as HTMLSelectElement).value;
        return { rows, cols, style };
      }
    });

    if (!formValues) return;

    const { rows, cols, style } = formValues;

    let headerBg = '#6366f1';
    let headerColor = '#ffffff';
    let borderColor = '#cbd5e1';

    if (style === 'dark') {
      headerBg = '#0f172a';
      headerColor = '#ffffff';
      borderColor = '#334155';
    } else if (style === 'simple') {
      headerBg = '#f1f5f9';
      headerColor = '#1e293b';
      borderColor = '#94a3b8';
    } else if (style === 'minimal') {
      headerBg = '#ffffff';
      headerColor = '#334155';
      borderColor = '#e2e8f0';
    }

    let tableHtml = `<div style="margin:16px 0; overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:10pt; background:#ffffff; border:1px solid ${borderColor}; border-radius:6px; overflow:hidden;">`;
    
    tableHtml += `<thead style="background-color:${headerBg}; color:${headerColor}; font-weight:bold;"><tr>`;
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<th style="padding:10px 12px; border:1px solid ${borderColor}; text-align:left;">Cabeçalho ${c}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;

    for (let r = 1; r <= rows; r++) {
      const bg = r % 2 === 0 ? '#f8fafc' : '#ffffff';
      tableHtml += `<tr style="background-color:${bg};">`;
      for (let c = 1; c <= cols; c++) {
        tableHtml += `<td style="padding:8px 12px; border:1px solid ${borderColor}; color:#334155;">Linha ${r}, Coluna ${c}</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table></div><p><br></p>`;

    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, tableHtml);
      handleEditorInput();
    }
  };

  const handleCropSelectedImage = () => {
    let targetImg: HTMLImageElement | null = selectedEditorImage;
    if (!targetImg && editorRef.current) {
      const imgs = editorRef.current.querySelectorAll('img');
      if (imgs.length > 0) {
        targetImg = imgs[0] as HTMLImageElement;
      }
    }
    if (targetImg) {
      setSelectedEditorImage(targetImg);
    } else {
      Swal.fire('Atenção', 'Clique em uma imagem na carta para selecioná-la e recortá-la.', 'info');
    }
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

    const rawText = getCanonicalHtml();
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

      if (editorRef.current) setEditorHtml(htmlOutput);
      Swal.fire({ icon: 'success', title: 'Formatado!', timer: 2000, showConfirmButton: false });
    } catch (error: any) {
      Swal.fire({ icon: 'error', title: 'Erro na IA', text: error.message || 'Erro de comunicação com Gemini.' });
    }
  };

  const handleInsertTag = (tagCode: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();
    restoreSelection();

    const inserted = document.execCommand('insertText', false, tagCode);
    if (!inserted) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(tagCode);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        const firstPageContent = editorRef.current.querySelector('.a4-page-content') || editorRef.current;
        firstPageContent.innerHTML += ` ${tagCode} `;
      }
    }

    saveSelection();
    handleEditorInput();
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `Tag ${tagCode} inserida no texto!`,
      showConfirmButton: false,
      timer: 1200
    });
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
        isFinalizada: isFinalizada,
        conteudoHtml: getCanonicalHtml()
      });
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Salvo!', text: 'Prospecção salva com sucesso no sistema.', timer: 2000, showConfirmButton: false });
    }
  };

  const handleImprimir = async () => {
    if (!clinica.trim()) {
      Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe o nome da Clínica antes de imprimir.', confirmButtonColor: 'var(--primary-color)' });
      return;
    }
    const nomeEmpresa = clinica.trim() || prospectData?.clinicName || 'Clínica';
    const pdfTitle = `${nomeEmpresa} - Diagnóstico Estratégico`;
    const originalTitle = document.title;
    document.title = pdfTitle;

    if (onSaveProspeccao) {
      try {
        await onSaveProspeccao({
          clienteNome: donoClinica,
          titulo: clinica,
          dataAssinatura: dataProspeccao,
          location: cidadeBairro,
          fullAddress: enderecoCompleto,
          conteudoHtml: getCanonicalHtml()
        });
      } catch (err) { /* continua para imprimir */ }
    }

    if (editorRef.current) {
      paginateEditor();
      const pages = Array.from(editorRef.current.querySelectorAll<HTMLElement>(':scope > .a4-page'));
      const printablePages = pages.map(page => {
        const content = page.querySelector<HTMLElement>(':scope > .a4-page-content');
        const stylePadding = content?.style.padding || `${estilos.page.top}mm ${estilos.page.right}mm ${estilos.page.bottom}mm ${estilos.page.left}mm`;
        return `<section class="print-page"><div class="content-cell" style="padding: ${stylePadding} !important; ${content?.getAttribute('style') || ''}">${content?.innerHTML || ''}</div></section>`;
      }).join('');
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${pdfTitle}</title>
              <style>
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
                 @page { size: A4; margin: 0; }
                  html, body { margin: 0; padding: 0; width: 210mm; font-family: Arial, sans-serif !important; background: white; }
                  .print-page { width: 210mm; height: 297mm; box-sizing: border-box; overflow: hidden; break-after: page; page-break-after: always; background: white; }
                  .print-page:last-child { break-after: auto; page-break-after: auto; }
                  .content-cell, .content-cell * { font-family: Arial, sans-serif !important; }
                  .content-cell { width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; font-size: 11pt; line-height: 1.5; text-align: justify; }
                 .content-cell h1 { font-family: Arial, sans-serif; font-size: ${estilos.h1.size}pt !important; line-height: 1.5; font-weight: ${estilos.h1.bold ? 'bold' : 'normal'} !important; text-align: center; text-transform: ${estilos.h1.uppercase ? 'uppercase' : 'none'} !important; margin: 15px 0; }
                 .content-cell h2 { font-family: Arial, sans-serif; font-size: ${estilos.h2.size}pt !important; line-height: 1.5; font-weight: ${estilos.h2.bold ? 'bold' : 'normal'} !important; text-transform: ${estilos.h2.uppercase ? 'uppercase' : 'none'} !important; margin: 15px 0 10px; }
                 .content-cell h3 { font-family: Arial, sans-serif; font-size: ${estilos.h3.size}pt !important; line-height: 1.5; font-weight: ${estilos.h3.bold ? 'bold' : 'normal'} !important; text-transform: ${estilos.h3.uppercase ? 'uppercase' : 'none'} !important; margin: 12px 0 8px; }
                 .content-cell p { font-family: Arial, sans-serif; font-size: ${estilos.p.size}pt !important; line-height: 1.5; margin: 0 0 10px; text-align: justify; }
                 .content-cell ul { padding-left: ${estilos.list.indent}px !important; list-style-type: disc !important; }
                 .content-cell ol { padding-left: ${estilos.list.indent}px !important; list-style-type: decimal !important; }
                 .content-cell li { margin-bottom: ${estilos.list.spacing}px !important; }
                 .content-cell > :first-child { margin-top: 0 !important; }
                 .content-cell > :last-child { margin-bottom: 0 !important; }
                 .content-cell img { max-width: 100%; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                .page-break, hr.page-break, hr[title="Quebra de Página"] {
                  page-break-after: always !important;
                  break-after: page !important;
                  border: none !important;
                  border-top: none !important;
                  visibility: hidden !important;
                  height: 0 !important;
                  min-height: 0 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  opacity: 0 !important;
                }
               </style>
            </head>
            <body>
              ${printablePages}
              <script>
                function triggerPrint() {
                  const images = Array.from(document.querySelectorAll('img'));
                  let printed = false;

                  const doPrint = () => {
                    if (printed) return;
                    printed = true;
                    setTimeout(() => {
                      window.print();
                    }, 200);
                  };

                  if (images.length === 0) {
                    doPrint();
                    return;
                  }

                  let loaded = 0;
                  const onCheck = () => {
                    loaded++;
                    if (loaded >= images.length) {
                      doPrint();
                    }
                  };

                  // Fallback timer: se alguma imagem falhar ou demorar mais de 1.5s, força a impressão
                  const fallbackTimer = setTimeout(() => {
                    doPrint();
                  }, 1500);

                  images.forEach(img => {
                    if (img.complete) {
                      onCheck();
                    } else {
                      img.onload = () => onCheck();
                      img.onerror = () => onCheck();
                    }
                  });
                }
                if (document.readyState === 'complete') {
                  triggerPrint();
                } else {
                  window.onload = triggerPrint;
                }
              <\/script>
            </body>
          </html>
        `);
        doc.close();
        setTimeout(() => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            }
          } catch (e) {
            console.error('Erro ao disparar impressão:', e);
          }
        }, 400);

        setTimeout(() => {
          document.title = originalTitle;
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 15000);
      }
    }
  };



  // --- OBTER BLOCO / CAIXA SELECIONADA ---
  const getActiveBlockContainer = (): HTMLElement | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const editor = editorRef.current;
    if (!editor) return null;

    let node = selection.anchorNode;
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    let current = node as HTMLElement | null;
    while (current && current !== editor && !current.classList?.contains('a4-page-content')) {
      const isBlockContainer = 
        current.tagName === 'TABLE' ||
        current.tagName === 'BLOCKQUOTE' ||
        current.tagName === 'HR' ||
        (current.tagName === 'DIV' && (
          current.style.border !== '' ||
          current.style.borderRadius !== '' ||
          current.style.background !== '' ||
          current.style.backgroundColor !== '' ||
          current.className.includes('card') ||
          current.className.includes('block')
        ));

      if (isBlockContainer) {
        return current;
      }
      current = current.parentElement;
    }

    current = node as HTMLElement | null;
    while (current && current.parentElement && !current.parentElement.classList?.contains('a4-page-content')) {
      current = current.parentElement;
    }
    return (current && current.parentElement?.classList?.contains('a4-page-content')) ? current : null;
  };

  // --- REMOVER BLOCO / CAIXA SELECIONADA ---
  const handleRemoveSelectedBlock = () => {
    const block = getActiveBlockContainer();
    if (!block) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'Posicione o cursor dentro do bloco ou caixa que deseja remover.',
        showConfirmButton: false,
        timer: 2500
      });
      return;
    }

    const textClean = (block.textContent || '').replace(/[\s\n\r\t\u200B]+/g, '');
    const isEmp = textClean.length === 0;

    if (!isEmp) {
      Swal.fire({
        title: 'Remover este bloco?',
        text: 'Você removerá esta caixa/bloco do documento.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sim, remover bloco',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          block.remove();
          paginateEditor();
          Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Bloco removido!', showConfirmButton: false, timer: 2000 });
        }
      });
    } else {
      block.remove();
      paginateEditor();
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Bloco removido!', showConfirmButton: false, timer: 2000 });
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl + A ou Cmd + A -> Selecionar todo o conteúdo de todas as páginas A4
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      const editor = editorRef.current;
      if (editor) {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          const range = document.createRange();
          const pageContents = editor.querySelectorAll<HTMLElement>('.a4-page-content');
          if (pageContents.length > 0) {
            const first = pageContents[0];
            const last = pageContents[pageContents.length - 1];
            range.setStart(first, 0);
            range.setEnd(last, last.childNodes.length);
            sel.addRange(range);
          } else {
            range.selectNodeContents(editor);
            sel.addRange(range);
          }
        }
      }
    }
    // Ctrl + Z ou Cmd + Z -> Desfazer
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      document.execCommand('undo');
      handleEditorInput();
    }
    // Ctrl + Y ou Cmd + Y ou Ctrl + Shift + Z -> Refazer
    else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
      document.execCommand('redo');
      handleEditorInput();
    }
    // Backspace ou Delete em bloco/caixa vazia ou no início da página
    else if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const anchorNode = range.startContainer;
        const anchorEl = anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as HTMLElement);
        const currentPage = anchorEl?.closest<HTMLElement>('.a4-page');
        const currentContent = currentPage?.querySelector<HTMLElement>('.a4-page-content');

        if (currentPage && currentContent && editorRef.current?.contains(currentPage)) {
          const prevPage = currentPage.previousElementSibling as HTMLElement | null;
          if (prevPage?.classList.contains('a4-page')) {
            const prevContent = prevPage.querySelector<HTMLElement>('.a4-page-content');

            if (isCursorAtStartOfContent(currentContent, range) && prevContent) {
              e.preventDefault();

              const firstChild = currentContent.firstChild as HTMLElement | null;
              const lastPrevChild = prevContent.lastChild as HTMLElement | null;

              if (firstChild && lastPrevChild && firstChild.tagName === 'P' && lastPrevChild.tagName === 'P') {
                const textLenBefore = (lastPrevChild.textContent || '').length;
                while (firstChild.firstChild) {
                  lastPrevChild.appendChild(firstChild.firstChild);
                }
                firstChild.remove();

                const newRange = document.createRange();
                const textNodes: Node[] = [];
                const walk = document.createTreeWalker(lastPrevChild, NodeFilter.SHOW_TEXT);
                let currentTextNode: Node | null;
                while (currentTextNode = walk.nextNode()) {
                  textNodes.push(currentTextNode);
                }

                let currentOffsetCount = 0;
                let setDone = false;
                for (const tNode of textNodes) {
                  const len = tNode.textContent?.length || 0;
                  if (currentOffsetCount + len >= textLenBefore) {
                    newRange.setStart(tNode, Math.min(len, textLenBefore - currentOffsetCount));
                    newRange.collapse(true);
                    setDone = true;
                    break;
                  }
                  currentOffsetCount += len;
                }

                if (!setDone) {
                  newRange.selectNodeContents(lastPrevChild);
                  newRange.collapse(false);
                }

                selection.removeAllRanges();
                selection.addRange(newRange);
                savedSelectionRef.current = newRange.cloneRange();
              } else if (firstChild) {
                if (!firstChild.textContent?.trim() && firstChild.querySelectorAll('img, table').length === 0) {
                  firstChild.remove();
                } else {
                  prevContent.appendChild(firstChild);
                }
                
                const newRange = document.createRange();
                newRange.selectNodeContents(prevContent);
                newRange.collapse(false);
                selection.removeAllRanges();
                selection.addRange(newRange);
                savedSelectionRef.current = newRange.cloneRange();
              }

              if (!currentContent.childNodes.length) {
                currentPage.remove();
              }

              editorRef.current?.focus();
              balancePagesFrom(prevContent);
              return;
            }
          }
        }
      }

      // Deletar contêiner/card de bloco vazio
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node = sel.anchorNode;
        if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
        if (node instanceof HTMLElement) {
          const container = node.closest('div[style*="border"], div[style*="background"], div[class*="card"], blockquote, table');
          if (container && container instanceof HTMLElement && editorRef.current?.contains(container)) {
            const textContent = (container.textContent || '').replace(/[\s\n\r\t\u200B]+/g, '');
            const hasMedia = container.querySelectorAll('img, table, iframe').length > 0;
            
            if (!textContent && !hasMedia) {
              e.preventDefault();
              const parent = container.parentElement;
              container.remove();
              if (parent) {
                const range = document.createRange();
                range.selectNodeContents(parent);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
              }
              paginateEditor();
              return;
            }
          }
        }
      }
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div onClick={e => e.stopPropagation()} className="gerador-modal-container" style={{ backgroundColor: '#f8fafc', width: '96%', maxWidth: '1600px', height: '92vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', transition: 'all 0.3s' }}>

        {/* Header Responsivo (Desktop vs Mobile) */}
        {!isMobileView ? (
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title={isSidebarOpen ? "Ocultar Painel de Configurações" : "Mostrar Painel de Configurações"}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.8rem',
                  backgroundColor: isSidebarOpen ? '#f1f5f9' : '#5271FF',
                  color: isSidebarOpen ? '#334155' : 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isSidebarOpen ? 'none' : '0 2px 4px rgba(82, 113, 255, 0.3)'
                }}
              >
                <Layers size={16} />
                <span>{isSidebarOpen ? 'Ocultar Painel' : 'Mostrar Painel'}</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={22} color="var(--primary-color)" />
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>Gerador de Prospecção & Automação de Cartas</h2>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                disabled={isSaving}
                onClick={async () => { if (isSaving) return; setIsSaving(true); try { await handleSalvarNoSistema(); } finally { setIsSaving(false); } }}
                title="Salvar no Sistema"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                <FileText size={14} /> <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
              </button>

              <button
                disabled={isSaving}
                onClick={async () => { if (isSaving) return; setIsSaving(true); try { await handleImprimir(); } finally { setIsSaving(false); } }}
                title="Imprimir / Salvar PDF"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                <Printer size={14} /> <span>Imprimir PDF</span>
              </button>

              <button
                disabled={isSaving}
                onClick={handleMarcarFinalizada}
                title={isFinalizada ? "Proposta Finalizada (Pronta p/ Entrega)" : "Marcar como Finalizada / Pronta p/ Entrega"}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: isFinalizada ? '#f59e0b' : '#0d9488', color: 'white', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                <CheckSquare size={14} /> <span>{isFinalizada ? 'Finalizada' : 'Marcar Finalizada'}</span>
              </button>

              {prospeccaoParaEditar && (
                <button
                  disabled={isSaving}
                  onClick={handleMarcarEntregue}
                  title={isEntregue ? "Endereço Entregue" : "Marcar como Entregue"}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.75rem', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: isEntregue ? '#22c55e' : '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: isSaving ? 'not-allowed' : 'pointer' }}
                >
                  <Check size={14} /> <span>{isEntregue ? 'Entregue' : 'Marcar Entregue'}</span>
                </button>
              )}

              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.25rem' }}><X size={24} color="var(--text-secondary)" /></button>
            </div>
          </div>
        ) : (
          /* Header Mobile Otimizado (2 linhas compactas) */
          <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {/* Linha 1: Botão Painel + Título compacto + Fechar X */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', width: '100%' }}>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.6rem',
                  backgroundColor: isSidebarOpen ? '#f1f5f9' : '#5271FF', color: isSidebarOpen ? '#334155' : 'white',
                  border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0
                }}
              >
                <Layers size={14} />
                <span>{isSidebarOpen ? 'Ocultar Painel' : 'Painel'}</span>
              </button>

              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', overflow: 'hidden' }}>
                <FileText size={16} color="var(--primary-color)" style={{ flexShrink: 0 }} />
                <h2 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary-color)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Gerador de Prospecção
                </h2>
              </div>

              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', flexShrink: 0 }}>
                <X size={20} color="var(--text-secondary)" />
              </button>
            </div>

            {/* Linha 2: Ações + Zoom */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflowX: 'auto', flexWrap: 'nowrap' }}>
              <button
                disabled={isSaving}
                onClick={async () => { if (isSaving) return; setIsSaving(true); try { await handleSalvarNoSistema(); } finally { setIsSaving(false); } }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', whiteSpace: 'nowrap' }}
              >
                <FileText size={13} /> <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
              </button>

              <button
                disabled={isSaving}
                onClick={async () => { if (isSaving) return; setIsSaving(true); try { await handleImprimir(); } finally { setIsSaving(false); } }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', whiteSpace: 'nowrap' }}
              >
                <Printer size={13} /> <span>PDF</span>
              </button>

              <button
                disabled={isSaving}
                onClick={handleMarcarFinalizada}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: isFinalizada ? '#f59e0b' : '#0d9488', color: 'white', border: 'none', borderRadius: '6px', whiteSpace: 'nowrap' }}
              >
                <CheckSquare size={13} /> <span>{isFinalizada ? 'Finalizada' : 'Finalizar?'}</span>
              </button>

              {prospeccaoParaEditar && (
                <button
                  disabled={isSaving}
                  onClick={handleMarcarEntregue}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: isEntregue ? '#22c55e' : '#ef4444', color: 'white', border: 'none', borderRadius: '6px', whiteSpace: 'nowrap' }}
                >
                  <Check size={13} /> <span>{isEntregue ? 'Entregue' : 'Entregue?'}</span>
                </button>
              )}

              {/* Controles de Zoom no Celular */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.15rem 0.35rem', flexShrink: 0 }}>
                <button onClick={handleZoomOut} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: '#334155', display: 'flex', alignItems: 'center' }} title="Diminuir Zoom">
                  <ZoomOut size={14} />
                </button>
                <button onClick={handleToggleZoomFit} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', color: '#1e293b', padding: '0 0.2rem', minWidth: '34px', textAlign: 'center' }} title="Clique para alternar 65% / 100%">
                  {Math.round(mobileZoom * 100)}%
                </button>
                <button onClick={handleZoomIn} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: '#334155', display: 'flex', alignItems: 'center' }} title="Aumentar Zoom">
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAINEL DE CONFIGURAÇÕES RETRÁTIL (LATERAL EM DESKTOP, SUPERIOR EM MOBILE/TELAS VERTICAIS) */}
        <div className="gerador-body-container" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {isSidebarOpen && (
            <div className="gerador-config-panel" style={{ backgroundColor: '#1e293b', borderRight: '2px solid #334155', color: 'white', flexShrink: 0 }}>
              <div className="config-inner-wrapper">

                {/* Bloco 1: Modelos */}
                <div className="config-block-modelos" style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'white', fontWeight: '600' }}>Seus Modelos</h3>
                  <select
                    className="input"
                    style={{ marginBottom: isModeloOnlyMode ? '0' : '0.5rem', fontSize: '0.85rem', backgroundColor: 'white', color: '#1e293b', padding: '0.4rem', borderRadius: '4px', width: '100%' }}
                    value={selectedModeloId}
                    onChange={e => isModeloOnlyMode ? handleSelectModeloInMode(e.target.value) : handleLoadModelo(e.target.value)}
                  >
                    <option value="">-- Novo Modelo --</option>
                    {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                  {!isModeloOnlyMode && (
                    <button onClick={handleSaveModelo} style={{ width: '100%', padding: '0.45rem', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      Salvar Atual como Modelo
                    </button>
                  )}
                </div>

                {isModeloOnlyMode ? (
                  /* Modo Apenas Modelo */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500', fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' }}>Nome do Modelo</label>
                      <input type="text" className="input" style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%', boxSizing: 'border-box', backgroundColor: 'white', color: '#1e293b', borderRadius: '6px' }} value={nomeModeloState} onChange={e => setNomeModeloState(e.target.value)} placeholder="Ex: 01 - Confronto por Demanda" />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '500', fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' }}>Descrição do Modelo</label>
                      <input type="text" className="input" style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%', boxSizing: 'border-box', backgroundColor: 'white', color: '#1e293b', borderRadius: '6px' }} value={descricaoModeloState} onChange={e => setDescricaoModeloState(e.target.value)} placeholder="Descreva a finalidade..." />
                    </div>
                    <button
                      disabled={isSaving}
                      onClick={handleSaveModeloOnly}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1.2rem',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        backgroundColor: isSaving ? '#94a3b8' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        width: '100%',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Save size={16} /> <span>{isSaving ? 'Salvando...' : 'Salvar Modelo'}</span>
                    </button>
                  </div>
                ) : (
                  /* Modo Normal */
                  <>
                    {/* Bloco 2: Data da Prospecção */}
                    <div className="config-block-data" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' }}>Data da Prospecção</label>
                      <input type="date" className="input" style={{ fontSize: '0.85rem', padding: '0.55rem', width: '100%', boxSizing: 'border-box', backgroundColor: 'white', color: '#1e293b', border: '1px solid transparent', borderRadius: '6px' }} value={dataProspeccao} onChange={e => setDataProspeccao(e.target.value)} />
                    </div>

                    {/* Bloco 3: Dados da Clínica */}
                    <div className="config-block-clinica" style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>Dados da Clínica</h4>
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

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                        <div>
                          <div style={{ marginBottom: '3px' }}>
                            <strong style={{ color: 'white' }}>Dono (Endereçado a):</strong>
                          </div>
                          {computedOpcoesDono.length > 1 ? (
                            <select
                              value={donoClinica}
                              onChange={(e) => setDonoClinica(e.target.value)}
                              style={{
                                width: '100%',
                                backgroundColor: '#0f172a',
                                color: '#fcd34d',
                                border: '1px solid #3b82f6',
                                borderRadius: '6px',
                                padding: '5px 8px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              {computedOpcoesDono.map((op, idx) => (
                                <option key={idx} value={op}>
                                  {op}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={donoClinica}
                              onChange={(e) => setDonoClinica(e.target.value)}
                              placeholder="Nome do Dono..."
                              style={{
                                width: '100%',
                                backgroundColor: '#0f172a',
                                color: '#ffffff',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '0.8rem',
                                outline: 'none'
                              }}
                            />
                          )}
                        </div>
                        <div><strong style={{ color: 'white' }}>Clínica:</strong> {clinica || '-'}</div>
                        <div><strong style={{ color: 'white' }}>Cidade:</strong> {cidadeBairro || '-'}</div>
                        <div><strong style={{ color: 'white' }}>Endereço:</strong> {enderecoCompleto || '-'}</div>
                      </div>
                    </div>
                  </>
                )}

              </div>
            </div>
          )}

          <div className="gerador-main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

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
                
                {/* Controle de Tamanho de Fonte Sem Perda de Seleção do Mouse */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.1rem 0.2rem' }}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFontSize(selectedFontSizeNum - 1)}
                    className="editor-btn"
                    title="Diminuir Tamanho da Fonte (Manter Seleção do Mouse)"
                    style={{ padding: '0.2rem', height: '24px', width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Minus size={14} />
                  </button>

                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowFontSizePopover(!showFontSizePopover)}
                    className="editor-btn"
                    title="Escolher Tamanho da Fonte (Manter Seleção do Mouse)"
                    style={{ padding: '0.2rem 0.4rem', height: '24px', fontSize: '0.78rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#0f172a' }}
                  >
                    <span>{fontSizeLabels[selectedFontSizeNum] || `${selectedFontSizeNum}`}</span>
                    <ChevronDown size={12} />
                  </button>

                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleApplyFontSize(selectedFontSizeNum + 1)}
                    className="editor-btn"
                    title="Aumentar Tamanho da Fonte (Manter Seleção do Mouse)"
                    style={{ padding: '0.2rem', height: '24px', width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={14} />
                  </button>

                  {showFontSizePopover && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                        zIndex: 100,
                        padding: '0.3rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                        minWidth: '135px'
                      }}
                    >
                      {[
                        { size: 1, label: 'Tam 1 (10pt)' },
                        { size: 2, label: 'Tam 2 (12pt)' },
                        { size: 3, label: 'Tam 3 (14pt - Normal)' },
                        { size: 4, label: 'Tam 4 (18pt)' },
                        { size: 5, label: 'Tam 5 (24pt)' },
                        { size: 6, label: 'Tam 6 (32pt)' },
                        { size: 7, label: 'Tam 7 (48pt)' },
                      ].map((item) => (
                        <button
                          key={item.size}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            handleApplyFontSize(item.size);
                            setShowFontSizePopover(false);
                          }}
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.78rem',
                            fontWeight: selectedFontSizeNum === item.size ? 'bold' : 'normal',
                            backgroundColor: selectedFontSizeNum === item.size ? '#eff6ff' : 'transparent',
                            color: selectedFontSizeNum === item.size ? '#2563eb' : '#334155',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span>{item.label}</span>
                          {selectedFontSizeNum === item.size && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

                <button onClick={() => handleFormat('bold')} className="editor-btn" title="Negrito"><Bold size={18} /></button>
                <button onClick={() => handleFormat('italic')} className="editor-btn" title="Itálico"><Italic size={18} /></button>
                <button onClick={() => handleFormat('underline')} className="editor-btn" title="Sublinhado"><Underline size={18} /></button>
                <button onClick={() => handleFormat('strikethrough')} className="editor-btn" title="Tachado"><Strikethrough size={18} /></button>

                {/* Botão Discreto de Cor do Texto */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleOpenColorPopover}
                    className="editor-btn"
                    title="Cor do Texto Selecionado"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.3rem 0.4rem',
                      backgroundColor: showColorPopover ? '#f1f5f9' : 'transparent',
                      borderColor: showColorPopover ? '#cbd5e1' : 'transparent'
                    }}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Palette size={18} style={{ color: '#334155' }} />
                      <div style={{ position: 'absolute', bottom: '-3px', left: 0, right: 0, height: '3px', backgroundColor: textColor, borderRadius: '2px' }} />
                    </div>
                  </button>

                  {showColorPopover && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        zIndex: 100,
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.6rem',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                        width: '180px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#1e293b' }}>Cor do Texto</span>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setShowColorPopover(false)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
                        {['#000000', '#475569', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0284c7', '#059669', '#ea580c', '#ffffff'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyTextColor(c)}
                            style={{
                              width: '22px', height: '22px', borderRadius: '4px', backgroundColor: c,
                              border: c === '#ffffff' ? '1px solid #cbd5e1' : '1px solid transparent',
                              cursor: 'pointer', boxShadow: textColor === c ? '0 0 0 2px #3b82f6' : 'none'
                            }}
                            title={c}
                          />
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingTop: '0.2rem', borderTop: '1px solid #f1f5f9' }}>
                        <input
                          type="color"
                          value={textColor}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => setTextColor(e.target.value)}
                          style={{ width: '28px', height: '26px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyTextColor(textColor)}
                          style={{ flex: 1, padding: '0.25rem 0.4rem', fontSize: '0.72rem', fontWeight: 'bold', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Aplicar Cor
                        </button>
                      </div>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyTextColor(null)}
                        style={{ width: '100%', padding: '0.3rem', fontSize: '0.72rem', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: '4px', cursor: 'pointer', textAlign: 'center' }}
                      >
                        ↺ Resetar Cor (Preto Padrão)
                      </button>
                    </div>
                  )}
                </div>

                {/* Botão Discreto de Marca-Texto */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleOpenHighlightPopover}
                    className="editor-btn"
                    title="Cor de Fundo / Marca-Texto"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justify: 'center',
                      padding: '0.3rem 0.4rem',
                      backgroundColor: showHighlightPopover ? '#f1f5f9' : 'transparent',
                      borderColor: showHighlightPopover ? '#cbd5e1' : 'transparent'
                    }}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Highlighter size={18} style={{ color: '#334155' }} />
                      <div style={{ position: 'absolute', bottom: '-3px', left: 0, right: 0, height: '3px', backgroundColor: highlightColor, borderRadius: '2px' }} />
                    </div>
                  </button>

                  {showHighlightPopover && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        zIndex: 100,
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.6rem',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                        width: '180px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#1e293b' }}>Cor de Fundo</span>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setShowHighlightPopover(false)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
                        {['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#ddd6fe', '#fef3c7', '#d9f99d', '#bae6fd', '#fecdd3', '#e9d5ff', '#ffffff'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyHighlightColor(c)}
                            style={{
                              width: '22px', height: '22px', borderRadius: '4px', backgroundColor: c,
                              border: c === '#ffffff' ? '1px solid #cbd5e1' : '1px solid transparent',
                              cursor: 'pointer', boxShadow: highlightColor === c ? '0 0 0 2px #3b82f6' : 'none'
                            }}
                            title={c}
                          />
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingTop: '0.2rem', borderTop: '1px solid #f1f5f9' }}>
                        <input
                          type="color"
                          value={highlightColor}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => setHighlightColor(e.target.value)}
                          style={{ width: '28px', height: '26px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyHighlightColor(highlightColor)}
                          style={{ flex: 1, padding: '0.25rem 0.4rem', fontSize: '0.72rem', fontWeight: 'bold', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Aplicar Fundo
                        </button>
                      </div>

                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyHighlightColor(null)}
                        style={{ width: '100%', padding: '0.3rem', fontSize: '0.72rem', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: '4px', cursor: 'pointer', textAlign: 'center' }}
                      >
                        ↺ Resetar Fundo (Transparente)
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>
                <button onClick={handleInsertImage} className="editor-btn" title="Inserir Imagem"><ImageIcon size={18} /></button>
                <button onClick={handleCropSelectedImage} className="editor-btn" title="Recortar & Redimensionar Imagem Visualmente (Arrastar Cantos)" style={{ color: '#8b5cf6' }}><Crop size={18} /></button>
                <button onClick={handleInsertTable} className="editor-btn" title="Inserir Tabela Personalizada na Carta" style={{ color: '#6366f1' }}><Table size={18} /></button>
                
                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const nextState = !isRemoveElementMode;
                    setIsRemoveElementMode(nextState);
                    if (nextState) {
                      Swal.fire({
                        toast: true,
                        position: 'top-end',
                        icon: 'warning',
                        title: 'Modo Remover Elementos Ativo!',
                        text: 'Clique em qualquer bloco, linha, card ou imagem para excluir imediatamente.',
                        showConfirmButton: false,
                        timer: 3000
                      });
                    }
                  }}
                  className="editor-btn"
                  title={isRemoveElementMode ? "Modo Remover Elementos ATIVO (Clique em qualquer linha, bloco ou imagem para excluir)" : "Ativar Modo Remover Elementos (Clique em qualquer linha, bloco, card ou imagem para excluir instantaneamente)"}
                  style={{
                    color: isRemoveElementMode ? '#ffffff' : '#dc2626',
                    backgroundColor: isRemoveElementMode ? '#dc2626' : '#fff1f2',
                    border: isRemoveElementMode ? '1px solid #b91c1c' : '1px solid #fecdd3',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    boxShadow: isRemoveElementMode ? '0 0 12px rgba(220, 38, 38, 0.5)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <Trash2 size={16} />
                  <span>{isRemoveElementMode ? 'Remover Elementos: ON' : 'Remover Elementos'}</span>
                </button>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>
                <button
                  onClick={() => setShowMargins(prev => !prev)}
                  className="editor-btn"
                  title={showMargins ? "Ocultar Linhas Guia de Margem da Folha" : "Exibir Linhas Guia de Margem da Folha"}
                  style={{
                    color: showMargins ? '#2563eb' : '#64748b',
                    backgroundColor: showMargins ? '#eff6ff' : 'transparent',
                    border: showMargins ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.2rem 0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}
                >
                  <BoxSelect size={18} />
                  <span>{showMargins ? 'Margens: ON' : 'Ver Margens'}</span>
                </button>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

                <button onClick={() => handleFormat('justifyLeft')} className="editor-btn" title="Esquerda"><AlignLeft size={18} /></button>
                <button onClick={() => handleFormat('justifyCenter')} className="editor-btn" title="Centralizar"><AlignCenter size={18} /></button>
                <button onClick={() => handleFormat('justifyRight')} className="editor-btn" title="Direita"><AlignRight size={18} /></button>
                <button onClick={() => handleFormat('justifyFull')} className="editor-btn" title="Justificar"><AlignJustify size={18} /></button>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

                <button onClick={() => handleFormat('outdent')} className="editor-btn" title="Diminuir Recuo"><Outdent size={18} /></button>
                <button onClick={() => handleFormat('indent')} className="editor-btn" title="Aumentar Recuo"><Indent size={18} /></button>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>

                {/* Controle de Altura de Linha (Line Height) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#f8fafc', padding: '0.15rem 0.4rem', border: '1px solid var(--border-color)', borderRadius: '6px' }} title="Altura da linha (espaçamento entre linhas) do texto selecionado">
                  <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Alt. Linha:</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="4.0"
                    value={selectedLineHeight}
                    onChange={(e) => handleApplyLineHeight(e.target.value)}
                    style={{ width: '48px', padding: '0.2rem', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', color: '#0f172a', backgroundColor: 'white' }}
                  />
                  <select
                    onChange={(e) => handleApplyLineHeight(e.target.value)}
                    value={selectedLineHeight}
                    className="editor-select"
                    style={{ padding: '0.2rem 0.3rem', fontSize: '0.75rem', fontWeight: 'bold' }}
                  >
                    <option value="0.9">0.9</option>
                    <option value="1.0">1.0 (Simples)</option>
                    <option value="1.1">1.1</option>
                    <option value="1.15">1.15</option>
                    <option value="1.2">1.2 (Justo)</option>
                    <option value="1.3">1.3</option>
                    <option value="1.4">1.4</option>
                    <option value="1.5">1.5 (Padrão)</option>
                    <option value="1.6">1.6</option>
                    <option value="1.8">1.8</option>
                    <option value="2.0">2.0 (Duplo)</option>
                  </select>
                </div>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }}></div>
                <button
                  onClick={() => {
                    if (!viewHtml) {
                      setPreviewHtml(getCanonicalHtml());
                    } else {
                      setEditorHtml(previewHtml);
                    }
                    setViewHtml(!viewHtml);
                  }}
                  className="editor-btn"
                  title={viewHtml ? "Voltar ao Modo Visual (WYSIWYG)" : "Editar Código HTML do Documento"}
                  style={{ color: viewHtml ? '#0284c7' : 'var(--text-secondary)', backgroundColor: viewHtml ? '#e0f2fe' : 'transparent', fontWeight: 'bold' }}
                >
                  <Code size={18} /> {viewHtml ? ' Ver Visual' : ''}
                </button>
              </div>

              {/* Editor Workspace */}
              <div id="editor-scroll-container" style={{ flex: 1, overflowY: 'auto', padding: isMobileView ? '1rem 0.25rem' : '2rem 1rem', display: 'flex', justifyContent: 'center', overflowX: 'auto', position: 'relative' }}>
                {viewHtml && (
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1000px', height: '100%', minHeight: '700px', backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
                    {/* Cabeçalho do Editor de Código */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', backgroundColor: '#1e293b', borderBottom: '1px solid #334155', color: 'white', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Code size={18} style={{ color: '#38bdf8' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Editor de Código HTML</span>
                        <span style={{ fontSize: '0.7rem', color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>HTML / Marcação</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              let formatted = previewHtml
                                .replace(/></g, '>\n<')
                                .trim();
                              setPreviewHtml(formatted);
                            } catch (e) {}
                          }}
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#334155', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer' }}
                          title="Organizar e quebrar linhas das tags HTML"
                        >
                          Formatador HTML
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(previewHtml);
                            Swal.fire({ icon: 'success', title: 'Copiado!', text: 'Código HTML copiado para a área de transferência.', timer: 1500, showConfirmButton: false });
                          }}
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#334155', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          Copiar Código
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditorHtml(previewHtml);
                            setViewHtml(false);
                          }}
                          style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          ✓ Aplicar & Voltar ao Visual
                        </button>
                      </div>
                    </div>

                    {/* Área de Edição do Código HTML */}
                    <textarea
                      value={previewHtml}
                      onChange={(e) => setPreviewHtml(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const target = e.target as HTMLTextAreaElement;
                          const start = target.selectionStart;
                          const end = target.selectionEnd;
                          const newValue = target.value.substring(0, start) + '  ' + target.value.substring(end);
                          setPreviewHtml(newValue);
                          setTimeout(() => {
                            target.selectionStart = target.selectionEnd = start + 2;
                          }, 0);
                        }
                      }}
                      style={{
                        flex: 1,
                        width: '100%',
                        height: '100%',
                        minHeight: '650px',
                        padding: '1.2rem',
                        outline: 'none',
                        fontSize: '0.88rem',
                        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                        lineHeight: '1.6',
                        color: '#f8fafc',
                        backgroundColor: '#0f172a',
                        border: 'none',
                        resize: 'none',
                        overflowY: 'auto',
                        boxSizing: 'border-box',
                        tabSize: 2
                      }}
                      spellCheck={false}
                      placeholder="Digite ou edite o código HTML da sua carta de prospecção..."
                    />
                  </div>
                )}

                <style>{`
                  @media print {
                    * {
                      box-shadow: none !important;
                      -webkit-box-shadow: none !important;
                    }
                  }

                  .editor-content {
                    display: flex;
                    flex-direction: column;
                    gap: 12mm;
                    width: 210mm;
                    outline: none;
                  }

                  .editor-content .a4-page {
                    position: relative;
                    width: 210mm;
                    height: 297mm;
                    min-height: 297mm;
                    flex: 0 0 297mm;
                    box-sizing: border-box;
                    overflow: visible;
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
                  }

                  .editor-content .a4-page-content {
                    width: 100%;
                    height: 100%;
                    box-sizing: border-box;
                    outline: none;
                    overflow: hidden;
                  }

                  .editor-content .a4-page-content > :first-child { margin-top: 0 !important; }
                  .editor-content .a4-page-content > :last-child { margin-bottom: 0 !important; }

                  .editor-content img {
                    cursor: grab !important;
                    user-select: none !important;
                    -webkit-user-drag: element !important;
                  }

                  .editor-content img:active {
                    cursor: grabbing !important;
                  }

                  .editor-content hr {
                    cursor: pointer !important;
                    transition: all 0.2s !important;
                  }
                  .editor-content hr:hover {
                    border-top-color: #ef4444 !important;
                    outline: 2px dashed #ef4444 !important;
                    outline-offset: 2px !important;
                  }

                  .editor-content table,
                  .editor-content blockquote,
                  .editor-content div[style*="border"],
                  .editor-content div[style*="background"] {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                  }

                  .editor-content.remove-mode-active .a4-page-content * {
                    cursor: pointer !important;
                  }

                  .editor-content.remove-mode-active .a4-page-content *:hover {
                    outline: 2px dashed #ef4444 !important;
                    outline-offset: 2px !important;
                    background-color: rgba(239, 68, 68, 0.08) !important;
                  }

                  .editor-content.show-margins .a4-page {
                    background-color: #dbeafe !important; /* Azul claro homogêneo para a área das margens da folha */
                  }

                  .editor-content.show-margins .a4-page-content {
                    background-color: #ffffff !important;
                    background-clip: content-box !important; /* Restringe o fundo branco apenas à área interna de texto */
                    box-shadow: inset 0 0 0 1px #93c5fd !important; /* Apenas a linha limite interna */
                  }

                  @media print {
                    .editor-content.show-margins .a4-page {
                      background-color: #ffffff !important;
                    }
                    .editor-content.show-margins .a4-page-content {
                      background-clip: border-box !important;
                      box-shadow: none !important;
                    }
                  }
                `}</style>

                <div
                  ref={editorRef}
                  className={`editor-content ${showMargins ? 'show-margins' : ''} ${isRemoveElementMode ? 'remove-mode-active' : ''}`}
                  contentEditable
                  suppressContentEditableWarning
                  onClick={handleEditorClick}
                  onKeyDown={handleEditorKeyDown}
                  onInput={handleEditorInput}
                  onBlur={() => {
                    if (dirtyPageRef.current) {
                      balancePagesFrom(dirtyPageRef.current);
                      dirtyPageRef.current = null;
                    }
                  }}
                  onCompositionStart={() => { isComposingRef.current = true; }}
                  onCompositionEnd={() => {
                    isComposingRef.current = false;
                    schedulePaginationAfterInput();
                  }}
                  onPaste={handlePaste}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    display: viewHtml ? 'none' : 'flex',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '11pt',
                    lineHeight: '1.5',
                    textAlign: 'justify',
                    color: '#000000',
                    wordWrap: 'break-word',
                    transform: isMobileView ? `scale(${mobileZoom})` : 'none',
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease-out'
                  }}
                />
              </div>
            </div>

            {/* Painel Direito: IA e Variáveis de Automação */}
            <div className="gerador-ia-panel" style={{ width: '380px', backgroundColor: 'var(--secondary-color)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleApplyAllTags}
                  style={{ flex: 1, backgroundColor: '#0f766e', color: 'white', border: '1px solid #14b8a6', padding: '0.55rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
                  title="Substitui todas as tags por dados e blocos visuais reais disponíveis"
                >
                  <Wand2 size={15} /> Aplicar Todas as Tags
                </button>
                <button
                  type="button"
                  onClick={() => setShowVariableModal(true)}
                  style={{ backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <Code size={12} /> Ver Mapeamento
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {/* Tags de Clique Rápido */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', fontWeight: 'bold' }}>
                    ⚡ Clique para Inserir Tag na Carta
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {DEFAULT_VARIABLE_TAGS.map((tag) => {
                      const isVisualTag = tag.code.startsWith('{{IA_');
                      return (
                      <button
                        key={tag.code}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleInsertTag(tag.code)}
                        style={{
                          backgroundColor: isVisualTag ? 'rgba(245, 158, 11, 0.16)' : 'rgba(255,255,255,0.08)',
                          border: isVisualTag ? '1px solid rgba(245, 158, 11, 0.65)' : '1px solid rgba(255,255,255,0.15)',
                          color: isVisualTag ? '#fcd34d' : '#cbd5e1',
                          borderRadius: '6px',
                          padding: '0.35rem 0.55rem',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isVisualTag ? 'rgba(245, 158, 11, 0.28)' : 'rgba(99, 102, 241, 0.3)';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isVisualTag ? 'rgba(245, 158, 11, 0.16)' : 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.color = isVisualTag ? '#fcd34d' : '#cbd5e1';
                        }}
                        title={`${isVisualTag ? 'Inserir bloco visual: ' : 'Inserir '}${tag.description}`}
                      >
                        {isVisualTag ? <ImageIcon size={12} /> : <Plus size={12} />} {tag.code}
                      </button>
                      );
                    })}
                  </div>
                  <p style={{ margin: '0.7rem 0 0', fontSize: '0.7rem', color: '#fcd34d', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ImageIcon size={12} /> Tags douradas inserem conteúdo visual na carta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .editor-btn { background: white; border: 1px solid transparent; border-radius: 4px; padding: 0.4rem; cursor: pointer; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .editor-btn:hover { background: #f1f5f9; color: var(--primary-color); border-color: #cbd5e1; }
        .editor-select { padding: 0.4rem; border: 1px solid var(--border-color); border-radius: 4px; outline: none; color: var(--text-secondary); background: white; font-size: 0.85rem; cursor: pointer; }
        .editor-select:hover { border-color: #cbd5e1; }
        .editor-content, .editor-content * { font-family: Arial, sans-serif !important; }
        .editor-content h1 { font-size: ${estilos.h1.size}pt !important; line-height: 1.5; font-weight: ${estilos.h1.bold ? 'bold' : 'normal'} !important; text-align: center; text-transform: ${estilos.h1.uppercase ? 'uppercase' : 'none'} !important; margin: 15px 0; }
        .editor-content h2 { font-size: ${estilos.h2.size}pt !important; line-height: 1.5; font-weight: ${estilos.h2.bold ? 'bold' : 'normal'} !important; text-transform: ${estilos.h2.uppercase ? 'uppercase' : 'none'} !important; margin: 15px 0 10px; }
        .editor-content h3 { font-size: ${estilos.h3.size}pt !important; line-height: 1.5; font-weight: ${estilos.h3.bold ? 'bold' : 'normal'} !important; text-transform: ${estilos.h3.uppercase ? 'uppercase' : 'none'} !important; margin: 12px 0 8px; }
        .editor-content p { font-size: ${estilos.p.size}pt !important; line-height: 1.5; margin: 0 0 10px; text-align: justify; }
        .editor-content ul { padding-left: ${estilos.list.indent}px !important; list-style-type: disc !important; }
        .editor-content ol { padding-left: ${estilos.list.indent}px !important; list-style-type: decimal !important; }
        .editor-content li { margin-bottom: ${estilos.list.spacing}px !important; display: list-item !important; }

        /* ESTILOS DO PAINEL DE CONFIGURAÇÃO (LATERAL EM DESKTOP, SUPERIOR EM MOBILE/PORTRAIT) */
        .gerador-body-container { display: flex; flex-direction: row; flex: 1; overflow: hidden; position: relative; }
        .gerador-config-panel { width: 310px; min-width: 310px; max-width: 310px; background-color: #1e293b; border-right: 2px solid #334155; padding: 1rem; color: white; overflow-y: auto; display: flex; flex-direction: column; flex-shrink: 0; }
        .config-inner-wrapper { display: flex; flex-direction: column; gap: 1rem; width: 100%; }

        @media (max-width: 1050px), (orientation: portrait) {
          .gerador-modal-container { width: 100vw !important; height: 100vh !important; max-width: 100vw !important; border-radius: 0 !important; }
          .gerador-body-container { flex-direction: column !important; overflow-y: auto !important; }
          .gerador-config-panel {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            border-right: none !important;
            border-bottom: 2px solid #334155 !important;
            padding: 1rem 1.25rem !important;
          }
          .config-inner-wrapper { flex-direction: row !important; flex-wrap: wrap !important; gap: 1rem !important; }
          .config-block-modelos { flex: 1 1 240px !important; min-width: 220px !important; }
          .config-block-data { flex: 0 1 180px !important; min-width: 160px !important; }
          .config-block-clinica { flex: 2 1 340px !important; min-width: 280px !important; }
          .gerador-main-content { flex-direction: column !important; overflow-y: auto !important; }
          .gerador-editor { width: 100% !important; overflow-y: visible !important; }
          .gerador-toolbar { overflow-x: auto !important; flex-wrap: nowrap !important; padding: 0.5rem !important; }
        .editor-content img {
          cursor: pointer !important;
          transition: outline 0.15s ease, border 0.15s ease;
        }
        .editor-content img:hover {
          outline: 3px solid #3b82f6 !important;
          outline-offset: 3px !important;
        }
      `}</style>

      <InlineImageCropperOverlay
        targetImage={selectedEditorImage}
        editorContainer={document.getElementById('editor-scroll-container')}
        onUpdate={() => handleEditorInput()}
        onDeselect={() => setSelectedEditorImage(null)}
      />

      <InteractiveMarginResizer
        showMargins={showMargins}
        editorRef={editorRef}
        onUpdate={() => handleEditorInput()}
        onUpdateMargin={(t, r, b, l) => handleUpdateMargin(t, r, b, l, false)}
        balancePagesFrom={balancePagesFrom}
      />

      <VariableMappingModal
        isOpen={showVariableModal}
        onClose={() => setShowVariableModal(false)}
        selectedProspect={prospeccaoParaEditar}
        diagnosticData={diagnosticData}
        onSelectTag={(tag) => {
          if (editorRef.current) {
            editorRef.current.focus();
            document.execCommand('insertText', false, tag);
            handleEditorInput();
          }
        }}
      />
    </div>
  );
}
