import { useState, useEffect } from 'react';
import { X, Edit2, Trash2, FileText, ChevronUp, ChevronDown, GripVertical, Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import { subscribeToModelosProspeccao, updateModeloProspeccao, deleteModeloProspeccao } from '../services/firestoreService';
import { ModeloProspeccao } from '../types';
import GeradorProspeccao from './GeradorProspeccao';

interface Props {
  onClose: () => void;
  onEditModeloInGerador?: (modeloId: string) => void;
}

export default function GerenciadorModelosModal({ onClose }: Props) {
  const [modelos, setModelos] = useState<ModeloProspeccao[]>([]);
  const [editingModeloId, setEditingModeloId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToModelosProspeccao(setModelos);
    return () => unsubscribe();
  }, []);

  // Excluir Modelo
  const handleDelete = async (id: string, nome: string) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Excluir Modelo?',
      text: `Tem certeza que deseja excluir o modelo "${nome}" permanentemente?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar',
      didOpen: () => {
        const swalContainer = document.querySelector('.swal2-container') as HTMLElement;
        if (swalContainer) {
          swalContainer.style.zIndex = '3500';
        }
      }
    });

    if (isConfirmed) {
      await deleteModeloProspeccao(id);
      Swal.fire({
        title: 'Excluído!',
        text: 'O modelo foi removido.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        didOpen: () => {
          const swalContainer = document.querySelector('.swal2-container') as HTMLElement;
          if (swalContainer) {
            swalContainer.style.zIndex = '3500';
          }
        }
      });
    }
  };

  // Reordenar Lista (Move Up / Down)
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modelos.length) return;

    const newModels = [...modelos];
    const temp = newModels[index];
    newModels[index] = newModels[targetIndex];
    newModels[targetIndex] = temp;

    // Atualiza estado local imediatamente para fluidez visual
    setModelos(newModels);

    // Persiste no Firestore a nova ordem
    for (let i = 0; i < newModels.length; i++) {
      await updateModeloProspeccao(newModels[i].id, { ordem: i });
    }
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newModels = [...modelos];
    const [draggedItem] = newModels.splice(draggedIndex, 1);
    newModels.splice(targetIndex, 0, draggedItem);

    setDraggedIndex(null);
    setModelos(newModels);

    for (let i = 0; i < newModels.length; i++) {
      await updateModeloProspeccao(newModels[i].id, { ordem: i });
    }
  };

  if (editingModeloId !== null) {
    return (
      <GeradorProspeccao
        isModeloOnlyMode={true}
        modeloIdParaEditar={editingModeloId === 'new' ? '' : editingModeloId}
        onClose={() => setEditingModeloId(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0d0f19] text-gray-100 w-full max-w-6xl max-h-[88vh] rounded-3xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden transition-all" onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-[#131625] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Gerenciador de Modelos das Cartas</h2>
              <p className="text-xs text-gray-400">Organize a ordem de exibição e edite o conteúdo das cartas visualmente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingModeloId('new')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus size={14} /> Novo Modelo
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* LISTA DE MODELOS COM REORDENAÇÃO */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-800/40 text-xs text-indigo-200">
              <span>💡 <strong>Dica de Reordenação:</strong> Use os botões <strong>▲ ▼</strong> ou arraste para definir a ordem em que os modelos aparecem no sistema.</span>
            </div>

            {modelos.length === 0 ? (
              <div className="py-12 text-center text-gray-500 space-y-3">
                <FileText size={36} className="mx-auto text-gray-600" />
                <p className="text-sm font-bold">Nenhum modelo salvo ainda.</p>
                <button
                  onClick={() => setEditingModeloId('new')}
                  className="bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> Criar Primeiro Modelo
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {modelos.map((m, index) => (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={e => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={e => handleDrop(e, index)}
                    className={`flex items-center justify-between p-4 bg-[#090b13] rounded-2xl border transition-all ${
                      draggedIndex === index ? 'border-indigo-500 bg-indigo-950/20 opacity-60' : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    {/* Lado Esquerdo: Controles de Posição + Nome */}
                    <div className="flex items-start gap-3 min-w-0 flex-1 pr-3">
                      {/* Drag Handle & Up/Down Arrows */}
                      <div className="flex items-center gap-1 text-gray-500 shrink-0 pt-0.5">
                        <span title="Arrastar para reordenar">
                          <GripVertical size={16} className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400" />
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            disabled={index === 0}
                            onClick={() => handleMove(index, 'up')}
                            className="p-1 rounded bg-gray-900 hover:bg-gray-800 disabled:opacity-20 text-gray-300 hover:text-white transition-all border border-gray-800 cursor-pointer"
                            title="Mover para cima"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            disabled={index === modelos.length - 1}
                            onClick={() => handleMove(index, 'down')}
                            className="p-1 rounded bg-gray-900 hover:bg-gray-800 disabled:opacity-20 text-gray-300 hover:text-white transition-all border border-gray-800 cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                      </div>

                      <span className="w-6 h-6 shrink-0 rounded-lg bg-gray-900 text-gray-400 font-mono font-bold text-xs flex items-center justify-center border border-gray-800 mt-0.5">
                        #{index + 1}
                      </span>

                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditingModeloId(m.id)}>
                        <span className="font-bold text-white text-sm block hover:text-indigo-300 transition-colors">
                          {m.nome}
                        </span>
                        {m.descricao && m.descricao.trim() ? (
                          <p className="text-xs text-indigo-300/90 font-medium mt-1 leading-relaxed break-words whitespace-pre-wrap">
                            {m.descricao}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 block truncate mt-0.5">
                            {m.conteudo ? `${m.conteudo.replace(/<[^>]*>/g, '').substring(0, 90)}...` : 'Sem conteúdo'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Lado Direito: Ações de Editar & Excluir */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingModeloId(m.id)}
                        className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-indigo-600 text-gray-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all border border-gray-700 shadow-sm active:scale-95 cursor-pointer"
                        title="Editar Nome e Conteúdo deste Modelo"
                      >
                        <Edit2 size={14} /> Editar
                      </button>

                      <button
                        onClick={() => handleDelete(m.id, m.nome)}
                        className="p-2 rounded-xl bg-gray-800 hover:bg-red-600/80 text-gray-400 hover:text-white transition-all border border-gray-700 active:scale-95 cursor-pointer"
                        title="Excluir Modelo"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
