import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquarePlus, 
  Bug, 
  Lightbulb, 
  Sparkles, 
  X, 
  Paperclip, 
  Image as ImageIcon, 
  FileText, 
  Video, 
  Trash2, 
  Eye, 
  Camera, 
  History, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2,
  Maximize2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { User } from 'firebase/auth';
import { CompanyType, FeedbackAttachment, FeedbackItem, FeedbackStatus, FeedbackType, UserProfile } from '../types';
import { addFeedback, subscribeToFeedbacks, updateFeedbackStatus, deleteFeedback } from '../services/firestoreService';

interface Props {
  user: User | null;
  userProfile?: UserProfile | null;
  companyId: CompanyType;
}

export const FeedbackFloatingButton: React.FC<Props> = ({ user, userProfile, companyId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  
  // Feedback Form State
  const [type, setType] = useState<FeedbackType>('sugestao');
  const [description, setDescription] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [attachments, setAttachments] = useState<FeedbackAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  
  // History State
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [selectedScreenshotModal, setSelectedScreenshotModal] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && companyId) {
      const unsub = subscribeToFeedbacks(companyId, (items) => {
        setFeedbacks(items);
      });
      return () => unsub();
    }
  }, [user, companyId]);

  const captureScreen = async () => {
    setIsCapturing(true);
    try {
      // Temporariamente esconde o botão de feedback para não sair na imagem
      if (buttonRef.current) buttonRef.current.style.display = 'none';
      if (popupRef.current) popupRef.current.style.display = 'none';

      await new Promise((res) => setTimeout(res, 150));

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: window.devicePixelRatio > 1 ? 1.2 : 1,
        ignoreElements: (element) => {
          return element.classList?.contains('feedback-ignore');
        }
      });

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setScreenshotUrl(dataUrl);
    } catch (err) {
      console.error('Erro ao capturar screenshot:', err);
    } finally {
      if (buttonRef.current) buttonRef.current.style.display = 'flex';
      if (popupRef.current) popupRef.current.style.display = 'flex';
      setIsCapturing(false);
    }
  };

  const handleOpenPopup = async () => {
    if (!isOpen) {
      setIsOpen(true);
      setActiveTab('create');
      if (!screenshotUrl) {
        await captureScreen();
      }
    } else {
      setIsOpen(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`O arquivo "${file.name}" excede o limite de 10MB.`);
        return;
      }

      let attachmentType: 'image' | 'pdf' | 'video' | 'other' = 'other';
      if (file.type.startsWith('image/')) attachmentType = 'image';
      else if (file.type === 'application/pdf') attachmentType = 'pdf';
      else if (file.type.startsWith('video/')) attachmentType = 'video';

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              type: attachmentType,
              dataUrl: result,
              size: file.size
            }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!description.trim()) {
      alert('Por favor, descreva o seu feedback.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addFeedback({
        userId: user.uid,
        userName: userProfile?.name || user.displayName || user.email?.split('@')[0] || 'Usuário',
        userEmail: user.email || '',
        type,
        description,
        screenshotUrl: screenshotUrl || undefined,
        attachments,
        companyId,
        pageUrl: window.location.href
      });

      setSuccessMessage(true);
      setDescription('');
      setScreenshotUrl(null);
      setAttachments([]);

      setTimeout(() => {
        setSuccessMessage(false);
        setActiveTab('history');
      }, 1500);
    } catch (err) {
      console.error('Erro ao enviar feedback:', err);
      alert('Erro ao salvar feedback. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadge = (t: FeedbackType) => {
    switch (t) {
      case 'bug':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-600 border border-rose-200">
            <Bug size={14} /> Bug
          </span>
        );
      case 'sugestao':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
            <Lightbulb size={14} /> Sugestão
          </span>
        );
      case 'melhoria':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-600 border border-indigo-200">
            <Sparkles size={14} /> Melhoria
          </span>
        );
    }
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case 'pendente':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600">
            <Clock size={12} /> Pendente
          </span>
        );
      case 'em_analise':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
            <AlertCircle size={12} /> Em Análise
          </span>
        );
      case 'concluido':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 size={12} /> Concluído
          </span>
        );
      case 'rejeitado':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-500 border border-rose-200">
            <X size={12} /> Rejeitado
          </span>
        );
    }
  };

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (statusFilter === 'all') return true;
    return f.status === statusFilter;
  });

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) return null;

  return (
    <>
      {/* Container Flutuante no Canto Inferior Direito (Camada z-[9999] independente) */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end feedback-ignore">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={popupRef}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="mb-4 w-[420px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[82vh] text-stone-900 font-nunito"
            >
              {/* Header do Pop-up */}
              <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-2xl">
                    <MessageSquarePlus size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wide">Central de Feedback & Ideias</h3>
                    <p className="text-[10px] text-stone-400">Reporte bugs ou sugira melhorias</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-stone-400 hover:text-white transition-colors"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navegação por Abas (Novo Registro vs Histórico) */}
              <div className="flex border-b border-stone-100 bg-stone-50 p-1 gap-1">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'create'
                      ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <MessageSquarePlus size={14} />
                  Novo Registro
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'history'
                      ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <History size={14} />
                  Histórico
                  {feedbacks.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] font-black bg-stone-200 text-stone-800 rounded-full">
                      {feedbacks.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Conteúdo do Pop-up */}
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                {activeTab === 'create' ? (
                  successMessage ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-bounce">
                        <CheckCircle2 size={28} />
                      </div>
                      <h4 className="text-base font-black text-stone-900">Feedback enviado com sucesso!</h4>
                      <p className="text-xs text-stone-500 max-w-xs">
                        Sua mensagem e contexto visual foram gravados e estão disponíveis no histórico.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Seleção do Tipo de Registro */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">
                          Tipo de Solicitação
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setType('bug')}
                            className={`p-2.5 rounded-2xl border text-center flex flex-col items-center gap-1 transition-all ${
                              type === 'bug'
                                ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm ring-2 ring-rose-500/20'
                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            <Bug size={18} className={type === 'bug' ? 'text-rose-600' : 'text-stone-400'} />
                            <span className="text-xs font-bold">Bug</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setType('sugestao')}
                            className={`p-2.5 rounded-2xl border text-center flex flex-col items-center gap-1 transition-all ${
                              type === 'sugestao'
                                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-sm ring-2 ring-amber-500/20'
                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            <Lightbulb size={18} className={type === 'sugestao' ? 'text-amber-600' : 'text-stone-400'} />
                            <span className="text-xs font-bold">Sugestão</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setType('melhoria')}
                            className={`p-2.5 rounded-2xl border text-center flex flex-col items-center gap-1 transition-all ${
                              type === 'melhoria'
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm ring-2 ring-indigo-500/20'
                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            <Sparkles size={18} className={type === 'melhoria' ? 'text-indigo-600' : 'text-stone-400'} />
                            <span className="text-xs font-bold">Melhoria</span>
                          </button>
                        </div>
                      </div>

                      {/* Campo de Descrição */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">
                          Descrição
                        </label>
                        <textarea
                          rows={3}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={
                            type === 'bug'
                              ? 'Descreva o erro encontrado e o que aconteceu...'
                              : type === 'sugestao'
                              ? 'Compartilhe sua ideia ou sugestão...'
                              : 'O que pode ser melhorado neste recurso?'
                          }
                          className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all text-stone-800 placeholder-stone-400 font-medium resize-none"
                        />
                      </div>

                      {/* Print de Tela Capturado Automático */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1">
                            <Camera size={12} /> Print Automático da Tela
                          </label>
                          <button
                            type="button"
                            onClick={captureScreen}
                            disabled={isCapturing}
                            className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            {isCapturing ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
                            Recapturar
                          </button>
                        </div>

                        {isCapturing ? (
                          <div className="h-24 bg-stone-50 border border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-stone-400">
                            <Loader2 size={16} className="animate-spin text-stone-600" />
                            <span className="text-[10px] font-bold">Capturando tela atual...</span>
                          </div>
                        ) : screenshotUrl ? (
                          <div className="relative group rounded-2xl overflow-hidden border border-stone-200 bg-stone-900 h-28">
                            <img
                              src={screenshotUrl}
                              alt="Screenshot da Tela"
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-between p-2">
                              <span className="text-[10px] font-bold text-white/90 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                                Contexto Visual Salvo
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedScreenshotModal(screenshotUrl)}
                                  className="p-1 bg-white/20 hover:bg-white/40 text-white rounded-lg backdrop-blur-xs transition-colors"
                                  title="Expandir"
                                >
                                  <Maximize2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setScreenshotUrl(null)}
                                  className="p-1 bg-rose-500/80 hover:bg-rose-600 text-white rounded-lg backdrop-blur-xs transition-colors"
                                  title="Remover print"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={captureScreen}
                            className="w-full py-3 bg-stone-50 border border-dashed border-stone-200 rounded-2xl flex items-center justify-center gap-2 text-stone-500 hover:bg-stone-100 transition-colors text-xs font-bold"
                          >
                            <Camera size={14} /> Anexar Captura de Tela
                          </button>
                        )}
                      </div>

                      {/* Anexos de Arquivos (Imagens, PDFs, Vídeos) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1">
                            <Paperclip size={12} /> Anexar Arquivos (Imagens, PDF, Vídeos)
                          </label>
                          <input
                            type="file"
                            ref={fileInputRef}
                            multiple
                            accept="image/*,application/pdf,video/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            + Adicionar
                          </button>
                        </div>

                        {attachments.length > 0 && (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                            {attachments.map((file, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  {file.type === 'image' && <ImageIcon size={14} className="text-blue-500 shrink-0" />}
                                  {file.type === 'pdf' && <FileText size={14} className="text-rose-500 shrink-0" />}
                                  {file.type === 'video' && <Video size={14} className="text-purple-500 shrink-0" />}
                                  {file.type === 'other' && <Paperclip size={14} className="text-stone-500 shrink-0" />}
                                  <span className="font-bold text-stone-700 truncate max-w-[200px]">{file.name}</span>
                                  <span className="text-[10px] text-stone-400 shrink-0">{formatFileSize(file.size)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAttachment(idx)}
                                  className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botão de Envio */}
                      <button
                        type="submit"
                        disabled={isSubmitting || !description.trim()}
                        className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10 transition-all text-xs cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Enviando...
                          </>
                        ) : (
                          <>
                            <Send size={14} /> Enviar Registro
                          </>
                        )}
                      </button>
                    </form>
                  )
                ) : (
                  /* Aba do Histórico / Registros Enviados */
                  <div className="space-y-3">
                    {/* Filtros de Status */}
                    <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
                      {['all', 'pendente', 'em_analise', 'concluido', 'rejeitado'].map((st) => (
                        <button
                          key={st}
                          onClick={() => setStatusFilter(st)}
                          className={`py-1 px-2.5 rounded-full text-[10px] font-bold capitalize whitespace-nowrap transition-colors ${
                            statusFilter === st
                              ? 'bg-stone-900 text-white'
                              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                          }`}
                        >
                          {st === 'all'
                            ? 'Todos'
                            : st === 'em_analise'
                            ? 'Em Análise'
                            : st}
                        </button>
                      ))}
                    </div>

                    {filteredFeedbacks.length === 0 ? (
                      <div className="py-10 text-center space-y-2">
                        <History size={24} className="mx-auto text-stone-300" />
                        <p className="text-xs text-stone-500 font-bold">Nenhum registro encontrado.</p>
                      </div>
                    ) : (
                      filteredFeedbacks.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 hover:bg-stone-100/50 transition-colors"
                        >
                          {/* Cabeçalho do Card */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {getTypeBadge(item.type)}
                              {getStatusBadge(item.status)}
                            </div>
                            <span className="text-[10px] text-stone-400 font-medium">{formatDate(item.createdAt)}</span>
                          </div>

                          {/* Usuário e Autor */}
                          <div className="text-[10px] text-stone-500 font-semibold">
                            Enviado por: <span className="text-stone-800">{item.userName}</span>
                          </div>

                          {/* Descrição */}
                          <p className="text-xs text-stone-800 font-medium whitespace-pre-line leading-relaxed">
                            {item.description}
                          </p>

                          {/* Screenshot miniatura */}
                          {item.screenshotUrl && (
                            <div className="mt-2">
                              <span className="text-[10px] font-bold uppercase text-stone-400 block mb-1">
                                Captura de Tela:
                              </span>
                              <div
                                onClick={() => setSelectedScreenshotModal(item.screenshotUrl!)}
                                className="relative group w-28 h-16 rounded-xl overflow-hidden border border-stone-300 cursor-pointer bg-stone-900"
                              >
                                <img
                                  src={item.screenshotUrl}
                                  alt="Print"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Eye size={14} />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Anexos */}
                          {item.attachments && item.attachments.length > 0 && (
                            <div className="mt-2">
                              <span className="text-[10px] font-bold uppercase text-stone-400 block mb-1">
                                Anexos ({item.attachments.length}):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {item.attachments.map((att, i) => (
                                  <a
                                    key={i}
                                    href={att.dataUrl}
                                    download={att.name}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 px-2 py-1 bg-white border border-stone-200 rounded-lg text-[10px] font-bold text-stone-700 hover:bg-stone-100 transition-colors max-w-[180px] truncate"
                                  >
                                    <Paperclip size={10} className="shrink-0" />
                                    <span className="truncate">{att.name}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Alteração de Status para Admins */}
                          {userProfile?.role === 'admin' && (
                            <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between">
                              <div className="flex items-center gap-1 text-[10px] text-stone-400 font-bold">
                                Status Admin:
                              </div>
                              <div className="flex items-center gap-1">
                                {(['pendente', 'em_analise', 'concluido', 'rejeitado'] as FeedbackStatus[]).map((st) => (
                                  <button
                                    key={st}
                                    onClick={() => updateFeedbackStatus(item.id, st)}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold capitalize ${
                                      item.status === st
                                        ? 'bg-stone-900 text-white'
                                        : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                                    }`}
                                  >
                                    {st === 'em_analise' ? 'Análise' : st}
                                  </button>
                                ))}
                                <button
                                  onClick={() => {
                                    if (confirm('Deseja excluir este registro de feedback?')) {
                                      deleteFeedback(item.id);
                                    }
                                  }}
                                  className="p-1 text-stone-400 hover:text-rose-600 ml-1"
                                  title="Excluir"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão Flutuante Principal */}
        <motion.button
          ref={buttonRef}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleOpenPopup}
          className="w-13 h-13 rounded-full bg-stone-900 hover:bg-stone-800 text-white shadow-2xl flex items-center justify-center border border-stone-700/50 transition-colors relative group focus:outline-none cursor-pointer"
          title="Feedback & Ideias"
        >
          {isOpen ? (
            <X size={22} className="text-white" />
          ) : (
            <div className="relative">
              <MessageSquarePlus size={22} className="text-amber-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full" />
            </div>
          )}
        </motion.button>
      </div>

      {/* Modal de Visualização em Tela Cheia da Screenshot */}
      <AnimatePresence>
        {selectedScreenshotModal && (
          <div
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 feedback-ignore font-nunito"
            onClick={() => setSelectedScreenshotModal(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] bg-stone-900 rounded-2xl overflow-hidden shadow-2xl border border-stone-800 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 bg-stone-950 flex items-center justify-between border-b border-stone-800">
                <span className="text-xs font-bold text-stone-300">Captura de Tela em Detalhes</span>
                <button
                  onClick={() => setSelectedScreenshotModal(null)}
                  className="p-1.5 text-stone-400 hover:text-white rounded-full hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-2 overflow-auto flex-1 flex items-center justify-center bg-stone-950">
                <img
                  src={selectedScreenshotModal}
                  alt="Captura ampliada"
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
