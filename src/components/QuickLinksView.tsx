import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  ExternalLink, 
  Trash2, 
  Edit2, 
  Grid,
  List as ListIcon,
  Tag,
  Link as LinkIcon,
  LayoutGrid,
  Layers,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { QuickLink } from '../types';
import { addQuickLink, updateQuickLink, deleteQuickLink } from '../services/firestoreService';
import { Modal } from './Modal';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  links: QuickLink[];
  companyId: string;
}

interface SortableItemProps {
  link: QuickLink;
  viewMode: 'grid' | 'list';
  onEdit: (link: QuickLink) => void;
  onDelete: (id: string) => void;
}

const SortableLink = ({ link, viewMode, onEdit, onDelete }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`group relative bg-white border border-stone-200 transition-all hover:shadow-xl hover:border-stone-300 cursor-pointer ${
        viewMode === 'grid' 
          ? 'rounded-3xl p-6 flex flex-col h-full min-h-[200px]' 
          : 'rounded-2xl p-5 flex items-center gap-5'
      }`}
    >
      <div className={`shrink-0 rounded-2xl flex items-center justify-center ${
        viewMode === 'grid' 
          ? 'w-14 h-14 mb-5 bg-stone-50 text-stone-900 group-hover:bg-stone-900 group-hover:text-white transition-colors' 
          : 'w-12 h-12 bg-stone-50 text-stone-900'
      }`}>
        <LinkIcon size={viewMode === 'grid' ? 28 : 24} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-stone-900 uppercase tracking-tight truncate leading-tight text-lg">
              {link.name}
            </h3>
            {link.category && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Tag size={12} className="text-stone-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                  {link.category}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onEdit(link);
              }}
              className="p-3 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-all shadow-sm border border-stone-100"
              title="Editar Link"
            >
              <Edit2 size={20} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(link.id);
              }}
              className="p-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-all shadow-sm border border-red-100"
              title="Excluir Link"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        {viewMode === 'list' && (
          <p className="text-xs text-stone-400 truncate mt-2 max-w-md font-medium">
            {link.url}
          </p>
        )}
      </div>

      {viewMode === 'grid' && (
        <div className="mt-auto pt-6">
           <div className="flex items-center justify-between">
              <span className="text-xs text-stone-400 font-medium truncate max-w-[150px]">
                {link.url.replace(/^https?:\/\//, '')}
              </span>
              <ExternalLink size={18} className="text-stone-300 group-hover:text-stone-900 transition-colors" />
           </div>
        </div>
      )}
    </div>
  );
};

export const QuickLinksView: React.FC<Props> = ({ links, companyId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [displayMode, setDisplayMode] = useState<'all' | 'category'>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Form states
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCategory, setLinkCategory] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredLinks = links
    .filter(link => 
      link.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.url.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const categories = Array.from(new Set(links.map(l => l.category).filter(Boolean))) as string[];

  const categorizedLinks = categories.reduce((acc, cat) => {
    const catLinks = filteredLinks.filter(l => l.category === cat);
    if (catLinks.length > 0) {
      acc[cat] = catLinks;
    }
    return acc;
  }, {} as Record<string, QuickLink[]>);

  const uncategorizedLinks = filteredLinks.filter(l => !l.category);
  if (uncategorizedLinks.length > 0) {
    categorizedLinks['Sem Categoria'] = uncategorizedLinks;
  }

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category);
    } else {
      newCollapsed.add(category);
    }
    setCollapsedCategories(newCollapsed);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = links.findIndex((l) => l.id === active.id);
      const newIndex = links.findIndex((l) => l.id === over.id);
      
      const newOrder = arrayMove(links, oldIndex, newIndex);
      
      newOrder.forEach((link, index) => {
        if (link.order !== index) {
          updateQuickLink(link.id, { order: index });
        }
      });
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkName.trim() || !linkUrl.trim()) return;

    let formattedUrl = linkUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    await addQuickLink({
      name: linkName,
      url: formattedUrl,
      companyId: companyId as any,
      order: links.length,
      category: linkCategory
    });

    setLinkName('');
    setLinkUrl('');
    setLinkCategory('');
    setIsAddModalOpen(false);
  };

  const handleUpdateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !linkName.trim() || !linkUrl.trim()) return;

    let formattedUrl = linkUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    await updateQuickLink(editingLink.id, {
      name: linkName,
      url: formattedUrl,
      category: linkCategory
    });

    setEditingLink(null);
    setIsEditModalOpen(false);
  };

  const handleDeleteLink = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este link?')) {
      await deleteQuickLink(id);
    }
  };

  const openEditModal = (link: QuickLink) => {
    setEditingLink(link);
    setLinkName(link.name);
    setLinkUrl(link.url);
    setLinkCategory(link.category || '');
    setIsEditModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden bg-stone-50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Links Rápidos</h2>
          <p className="text-sm text-stone-500 font-medium">Acesse as ferramentas que você mais utiliza em um só lugar.</p>
        </div>
        
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
        >
          <Plus size={20} />
          Novo Link
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text"
            placeholder="Filtrar links por nome, categoria ou URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all font-medium text-stone-900"
          />
        </div>
        
        <div className="flex gap-4">
          <div className="flex bg-white p-1 rounded-2xl border border-stone-200 shadow-sm shrink-0">
            <button 
              onClick={() => setDisplayMode('all')}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${displayMode === 'all' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
            >
              <LayoutGrid size={14} />
              Geral
            </button>
            <button 
              onClick={() => setDisplayMode('category')}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${displayMode === 'category' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
            >
              <Layers size={14} />
              Categorias
            </button>
          </div>

          <div className="flex bg-white p-1 rounded-2xl border border-stone-200 shadow-sm shrink-0">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
            >
              <Grid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
            >
              <ListIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {filteredLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-stone-400 bg-white rounded-3xl border-2 border-dashed border-stone-200">
            <LinkIcon size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-bold">Nenhum link encontrado</p>
            <p className="text-sm">Tente outro termo ou adicione um novo link.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {displayMode === 'all' ? (
              <SortableContext
                items={filteredLinks.map(l => l.id)}
                strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
              >
                <div className={viewMode === 'grid' 
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                  : "flex flex-col gap-4"
                }>
                  <AnimatePresence mode="popLayout">
                    {filteredLinks.map((link) => (
                      <SortableLink
                        key={link.id}
                        link={link}
                        viewMode={viewMode}
                        onEdit={openEditModal}
                        onDelete={handleDeleteLink}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SortableContext>
            ) : (
              <div className="space-y-12 pb-20">
                {Object.entries(categorizedLinks).map(([category, catLinks]) => {
                  const isCollapsed = collapsedCategories.has(category);
                  return (
                    <div key={category} className="space-y-6">
                      <div 
                        onClick={() => toggleCategory(category)}
                        className="flex items-center gap-4 cursor-pointer group/header"
                      >
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-900 transition-colors group-hover/header:bg-blue-100">
                           {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </div>
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-900 shrink-0">
                          {category}
                        </h3>
                        <div className="h-px bg-blue-900/20 flex-1" />
                        <span className="text-[10px] font-black text-blue-900/40 uppercase tracking-widest">
                          {catLinks.length} {catLinks.length === 1 ? 'LINK' : 'LINKS'}
                        </span>
                      </div>

                      {!isCollapsed && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <SortableContext
                            items={catLinks.map(l => l.id)}
                            strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
                          >
                            <div className={viewMode === 'grid' 
                              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                              : "flex flex-col gap-4"
                            }>
                              <AnimatePresence mode="popLayout">
                                {catLinks.map((link) => (
                                  <SortableLink
                                    key={link.id}
                                    link={link}
                                    viewMode={viewMode}
                                    onEdit={openEditModal}
                                    onDelete={handleDeleteLink}
                                  />
                                ))}
                              </AnimatePresence>
                            </div>
                          </SortableContext>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DndContext>
        )}
      </div>

      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        title="Adicionar Novo Link"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddLink} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Nome do Link</label>
            <input 
              autoFocus
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all font-medium text-stone-900"
              placeholder="Ex: Google Drive, Canva, Slack..."
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">URL</label>
            <input 
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all font-medium text-stone-900"
              placeholder="https://exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Categoria (Opcional)</label>
            <input 
              type="text"
              value={linkCategory}
              onChange={(e) => setLinkCategory(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all font-medium text-stone-900"
              placeholder="Ex: Ferramentas, Design, Comunicação..."
              list="categories-list"
            />
            <datalist id="categories-list">
              {categories.map(cat => <option key={cat} value={cat} />)}
            </datalist>
          </div>

          <button 
            type="submit"
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 mt-2"
          >
            Criar Link
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        title="Editar Link"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateLink} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Nome do Link</label>
            <input 
              autoFocus
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all font-medium text-stone-900"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">URL</label>
            <input 
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all font-medium text-stone-900"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Categoria (Opcional)</label>
            <input 
              type="text"
              value={linkCategory}
              onChange={(e) => setLinkCategory(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all font-medium text-stone-900"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 mt-2"
          >
            Salvar Alterações
          </button>
        </form>
      </Modal>
    </div>
  );
};
