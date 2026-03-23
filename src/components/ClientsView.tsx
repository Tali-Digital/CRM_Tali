import React, { useState } from 'react';
import { NotesEditor } from './NotesEditor';
import { Client, Tag, CompanyType, CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard, InternalTaskList, InternalTaskCard, UserProfile } from '../types';
import { addClient, updateClient, deleteClient, addTag, updateTag, deleteTag } from '../services/firestoreService';
import { Plus, Edit2, Trash2, Settings, Search, TrendingUp, UserPlus, ExternalLink } from 'lucide-react';
import { playCashSound } from '../utils/audio';
import { Modal } from './Modal';
import { QuickViewCardModal } from './QuickViewCardModal';

interface ClientsViewProps {
  companyId: CompanyType;
  clients: Client[];
  tags: Tag[];
  commercialLists: CommercialList[];
  commercialCards: CommercialCard[];
  financialLists: FinancialList[];
  financialCards: FinancialCard[];
  operationLists: OperationList[];
  operationCards: OperationCard[];
  internalTaskLists: InternalTaskList[];
  internalTaskCards: InternalTaskCard[];
  users: UserProfile[];
  jumpToCard?: { id: string, sector: string } | null;
  onClearJump?: () => void;
  onJumpToCard?: (cardId: string, sector: string) => void;
}

const DriveIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 86.6" width={size} height={(size * 86.6) / 100}>
    <path d="M33.3 0L0 57.7l16.7 28.9L50 28.9z" fill="#0066da"/>
    <path d="M66.7 0L33.3 0l16.7 28.9l50 86.6L100 57.7z" fill="#00ac47"/>
    <path d="M100 57.7L83.3 86.6H16.7l16.7-28.9H100z" fill="#ffba00"/>
  </svg>
);

const isLightColor = (color: string) => {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 180;
};

export const ClientsView: React.FC<ClientsViewProps> = ({ 
  companyId, 
  clients, 
  tags,
  commercialLists,
  commercialCards,
  financialLists,
  financialCards,
  operationLists,
  operationCards = [],
  internalTaskLists,
  internalTaskCards = [],
  users = [],
  jumpToCard,
  onClearJump,
  onJumpToCard
}) => {
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [selectedCardForQuickView, setSelectedCardForQuickView] = useState<any>(null);
  const [selectedSectorForQuickView, setSelectedSectorForQuickView] = useState<any>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Client Form State
  const [clientName, setClientName] = useState('');
  const [clientTheme, setClientTheme] = useState<'blue' | 'yellow'>('blue');
  const [clientTags, setClientTags] = useState<string[]>([]);
  const [clientNotes, setClientNotes] = useState('');
  const [clientDriveLink, setClientDriveLink] = useState('');

  // Tag Form State
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#5271FF');

  const openNewClientModal = () => {
    setEditingClient(null);
    setClientName('');
    setClientTheme('blue');
    setClientTags([]);
    setClientNotes('');
    setClientDriveLink('');
    setIsClientModalOpen(true);
  };

  const openEditClientModal = (client: Client) => {
    setEditingClient(client);
    setClientName(client.name);
    setClientTheme(client.themeColor);
    setClientTags(client.serviceTags || []);
    setClientNotes(client.notes || '');
    setClientDriveLink(client.driveLink || '');
    setIsClientModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const clientData = {
      name: clientName.trim(),
      themeColor: clientTheme,
      serviceTags: clientTags,
      notes: clientNotes,
      driveLink: clientDriveLink,
      companyId,
      checklist: editingClient?.checklist || []
    };

    if (editingClient) {
      await updateClient(editingClient.id, clientData);
    } else {
      playCashSound();
      await addClient(clientData);
    }
    setIsClientModalOpen(false);
  };

  const handleDeleteClient = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      await deleteClient(id);
    }
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    if (editingTag) {
      await updateTag(editingTag.id, { name: tagName.trim(), color: tagColor });
      setEditingTag(null);
    } else {
      await addTag({ name: tagName.trim(), color: tagColor, companyId });
    }
    setTagName('');
    setTagColor('#5271FF');
  };

  const handleDeleteTag = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta tag?')) {
      await deleteTag(id);
    }
  };

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-900 leading-tight">Clientes</h1>
          <p className="text-stone-500 text-xs md:text-sm mt-1">Base central de clientes e serviços.</p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <button 
            onClick={() => setIsTagsModalOpen(true)}
            className="flex-1 md:flex-none bg-white border border-stone-200 text-stone-700 px-3 md:px-4 py-2 rounded-xl hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 text-[11px] md:text-sm font-bold shadow-sm"
          >
            <Settings size={14} />
            Tags
          </button>
          <button 
            onClick={openNewClientModal}
            className="flex-1 md:flex-none bg-stone-900 text-white px-3 md:px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 text-[11px] md:text-sm font-bold shadow-sm"
          >
            <Plus size={14} />
            Novo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-stone-200 flex items-center gap-2">
          <Search size={18} className="text-stone-400" />
          <input 
            type="text"
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-sm"
          />
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
          {/* Mobile Card Grid */}
          <div className="md:hidden p-4 space-y-4">
            {filteredClients.map(client => {
              const clientCommCards = commercialCards.filter(c => c.clientId === client.id && !c.deleted);
              const commCard = clientCommCards.find(c => c.type === 'client') || clientCommCards[0];
              const commList = commCard ? commercialLists.find(l => l.id === commCard.listId) : null;

              const clientFinCards = financialCards.filter(c => c.clientId === client.id && !c.deleted);
              const finCard = clientFinCards.find(c => c.type === 'client') || clientFinCards[0];
              const finList = finCard ? financialLists.find(l => l.id === finCard.listId) : null;

              const clientOpCards = operationCards.filter(c => c.clientId === client.id && !c.deleted);
              const opCard = clientOpCards.find(c => c.type === 'client') || clientOpCards[0];
              const opList = opCard ? operationLists.find(l => l.id === opCard.listId) : null;

              const handleCardClick = () => {
                const firstCard = commCard || finCard || opCard;
                if (firstCard) {
                  setSelectedCardForQuickView(firstCard);
                  setSelectedSectorForQuickView(
                    commCard ? 'commercial' : (finCard ? 'financial' : 'operation')
                  );
                  setIsQuickViewOpen(true);
                }
              };

              return (
                <div key={client.id} className="bg-stone-50 rounded-2xl p-4 border border-stone-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2" onClick={handleCardClick}>
                      <div className={`w-3 h-3 rounded-full ${client.themeColor === 'blue' ? 'bg-[#5271FF]' : 'bg-[#FFD166]'}`} />
                      <span className="font-bold text-sm text-stone-900">{client.name}</span>
                    </div>
                    <div className="flex gap-2">
                       {client.driveLink && (
                        <a href={client.driveLink} target="_blank" rel="noopener noreferrer">
                          <DriveIcon size={20} />
                        </a>
                      )}
                      <button onClick={() => openEditClientModal(client)} className="text-stone-400">
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {client.serviceTags?.map(tagId => {
                      const tag = tags.find(t => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <span key={tag.id} className="px-2 py-0.5 rounded-md text-[9px] font-bold text-white" style={{ backgroundColor: tag.color }}>
                          {tag.name}
                        </span>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {commList && (
                      <div className="bg-white p-2 rounded-lg border border-stone-200">
                        <span className="text-[8px] uppercase text-stone-400 font-black block">Comercial</span>
                        <span className="text-[10px] font-bold text-stone-700 truncate block">{commList.name}</span>
                      </div>
                    )}
                    {finList && (
                      <div className="bg-white p-2 rounded-lg border border-stone-200">
                        <span className="text-[8px] uppercase text-stone-400 font-black block">Integração</span>
                        <span className="text-[10px] font-bold text-stone-700 truncate block">{finList.name}</span>
                      </div>
                    )}
                    {opList && (
                      <div className="bg-white p-2 rounded-lg border border-stone-200">
                        <span className="text-[8px] uppercase text-stone-400 font-black block">Operação</span>
                        <span className="text-[10px] font-bold text-stone-700 truncate block">{opList.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <table className="hidden md:table w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/50">
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-stone-500">Nome do Cliente</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-stone-500">Setores</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-stone-500">Serviços Atribuídos</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-stone-500 text-center">Drive</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-stone-500 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => {
                // Find any card for this client in each sector
                const clientCommCards = commercialCards.filter(c => c.clientId === client.id && !c.deleted);
                const commCard = clientCommCards.find(c => c.type === 'client') || clientCommCards[0];
                const commList = commCard ? commercialLists.find(l => l.id === commCard.listId) : null;
                
                const clientFinCards = financialCards.filter(c => c.clientId === client.id && !c.deleted);
                const finCard = clientFinCards.find(c => c.type === 'client') || clientFinCards[0];
                const finList = finCard ? financialLists.find(l => l.id === finCard.listId) : null;

                const clientOpCards = operationCards.filter(c => c.clientId === client.id && !c.deleted);
                const opCard = clientOpCards.find(c => c.type === 'client') || clientOpCards[0];
                const opList = opCard ? operationLists.find(l => l.id === opCard.listId) : null;

                const clientInternalTaskCards = internalTaskCards.filter(c => c.clientId === client.id && !c.deleted);
                const internalTaskCard = clientInternalTaskCards.find(c => c.type === 'client') || clientInternalTaskCards[0];
                const internalTaskList = internalTaskCard ? internalTaskLists.find(l => l.id === internalTaskCard.listId) : null;

                const handleRowClick = () => {
                  const firstCard = commCard || finCard || opCard || internalTaskCard;
                  if (firstCard) {
                    setSelectedCardForQuickView(firstCard);
                    setSelectedSectorForQuickView(
                      commCard ? 'commercial' : 
                      (finCard ? 'financial' : 
                      (opCard ? 'operation' : 
                      (internalTaskCard ? 'internal' : null)))
                    );
                    setIsQuickViewOpen(true);
                  }
                };

                return (
                  <tr key={client.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors group">
                    <td className="p-4 cursor-pointer" onClick={handleRowClick}>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${client.themeColor === 'blue' ? 'bg-[#5271FF]' : 'bg-[#FFD166]'}`} />
                        <span className="font-bold text-stone-900 group-hover:text-stone-900 transition-colors">{client.name}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink size={14} className="text-stone-300" />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 cursor-pointer" onClick={handleRowClick}>
                      <div className="flex flex-col gap-1">
                        {commList && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-600">
                            <TrendingUp size={12} className="text-stone-400" />
                            <span className="uppercase tracking-wider">{commList.name}</span>
                          </div>
                        )}
                        {finList && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-600">
                            <UserPlus size={12} className="text-stone-400" />
                            <span className="uppercase tracking-wider">{finList.name}</span>
                          </div>
                        )}
                        {opList && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-600">
                            <UserPlus size={12} className="text-stone-400" />
                            <span className="uppercase tracking-wider">{opList.name}</span>
                          </div>
                        )}
                        {internalTaskList && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-600">
                            <UserPlus size={12} className="text-stone-400" /> {/* Placeholder icon, consider a specific one for internal tasks */}
                            <span className="uppercase tracking-wider">{internalTaskList.name}</span>
                          </div>
                        )}
                        {!commList && !finList && !opList && !internalTaskList && (
                          <span className="text-stone-400 text-[10px] italic">Sem setor ativo</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {client.serviceTags?.map(tagId => {
                          const tag = tags.find(t => t.id === tagId);
                          if (!tag) return null;
                          const light = isLightColor(tag.color);
                          return (
                            <span 
                              key={tag.id} 
                              className={`px-2 py-1 rounded-md text-[10px] font-bold ${light ? 'text-black' : 'text-white'}`}
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          );
                        })}
                        {(!client.serviceTags || client.serviceTags.length === 0) && (
                          <span className="text-stone-400 text-xs italic">Nenhum serviço</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {client.driveLink && (
                        <a 
                          href={client.driveLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-2 hover:bg-stone-100 rounded-lg transition-all hover:scale-110 active:scale-95"
                          title="Abrir Google Drive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DriveIcon size={24} />
                        </a>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditClientModal(client)} className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteClient(client.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-stone-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title={editingClient ? "Editar Cliente" : "Novo Cliente"}>
        <form onSubmit={handleSaveClient} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Nome do Cliente</label>
            <input 
              required
              autoFocus
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              placeholder="Ex: Empresa XYZ"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Identificação por Cor</label>
            <div className="flex gap-4">
              <label className={`flex-1 cursor-pointer border-2 rounded-xl p-3 flex items-center gap-3 transition-all ${clientTheme === 'blue' ? 'border-[#5271FF] bg-[#5271FF]/5' : 'border-stone-200 hover:border-stone-300'}`}>
                <input type="radio" name="theme" value="blue" checked={clientTheme === 'blue'} onChange={() => setClientTheme('blue')} className="hidden" />
                <div className="w-5 h-5 rounded-full bg-[#5271FF]" />
                <span className="font-bold text-sm text-stone-700">Azul Claro</span>
              </label>
              <label className={`flex-1 cursor-pointer border-2 rounded-xl p-3 flex items-center gap-3 transition-all ${clientTheme === 'yellow' ? 'border-[#FFD166] bg-[#FFD166]/5' : 'border-stone-200 hover:border-stone-300'}`}>
                <input type="radio" name="theme" value="yellow" checked={clientTheme === 'yellow'} onChange={() => setClientTheme('yellow')} className="hidden" />
                <div className="w-5 h-5 rounded-full bg-[#FFD166]" />
                <span className="font-bold text-sm text-stone-700">Amarelo Claro</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Serviços (Tags)</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    if (clientTags.includes(tag.id)) {
                      setClientTags(clientTags.filter(id => id !== tag.id));
                    } else {
                      setClientTags([...clientTags, tag.id]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2`}
                  style={{ 
                    backgroundColor: clientTags.includes(tag.id) 
                      ? tag.color 
                      : 'white',
                    borderColor: tag.color,
                    color: clientTags.includes(tag.id) 
                      ? (isLightColor(tag.color) ? 'black' : 'white') 
                      : tag.color
                  }}
                >
                  {tag.name}
                </button>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-stone-400 italic">Nenhuma tag cadastrada.</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Notas Adicionais</label>
            <NotesEditor 
              value={clientNotes}
              onChange={setClientNotes}
              placeholder="Informações adicionais do cliente..."
              minHeight="120px"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Link do Google Drive</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <DriveIcon size={18} />
              </div>
              <input 
                type="url"
                value={clientDriveLink}
                onChange={(e) => setClientDriveLink(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                placeholder="https://drive.google.com/..."
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold">
            {editingClient ? "Salvar Alterações" : "Criar Cliente"}
          </button>
        </form>
      </Modal>

      {/* Tags Modal */}
      <Modal isOpen={isTagsModalOpen} onClose={() => setIsTagsModalOpen(false)} title="Gerenciar Tags">
        <div className="space-y-6">
          <form onSubmit={handleSaveTag} className="flex gap-2">
            <input 
              required
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              placeholder="Nome da tag"
            />
            <input 
              type="color"
              value={tagColor}
              onChange={(e) => setTagColor(e.target.value)}
              className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0"
            />
            <button type="submit" className="bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors text-sm font-bold">
              {editingTag ? "Salvar" : "Adicionar"}
            </button>
            {editingTag && (
              <button type="button" onClick={() => { setEditingTag(null); setTagName(''); setTagColor('#5271FF'); }} className="bg-stone-200 text-stone-700 px-3 py-2 rounded-xl hover:bg-stone-300 transition-colors text-sm font-bold">
                Cancelar
              </button>
            )}
          </form>

          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="font-bold text-sm text-stone-700">{tag.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingTag(tag); setTagName(tag.name); setTagColor(tag.color); }} className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-200 rounded-lg transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteTag(tag.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {tags.length === 0 && (
              <p className="text-center text-stone-500 text-sm py-4">Nenhuma tag cadastrada.</p>
            )}
          </div>
        </div>
      </Modal>

      <QuickViewCardModal 
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
        card={selectedCardForQuickView}
        client={clients.find(c => c.id === selectedCardForQuickView?.clientId)}
        users={users}
        tags={tags}
        sector={selectedSectorForQuickView}
        onEdit={() => {}} // Could be implemented to open specific edit modal
        allCommercialCards={commercialCards}
        allFinancialCards={financialCards}
        allOperationCards={operationCards}
        allInternalTaskCards={internalTaskCards}
        onJumpToCard={(targetTask, targetSector) => {
          setSelectedCardForQuickView(null); // Assuming setQuickViewCard was a typo for setSelectedCardForQuickView
          onJumpToCard?.(targetTask.id, targetSector);
        }}
        commercialLists={commercialLists}
        financialLists={financialLists}
        operationLists={operationLists}
        internalTaskLists={internalTaskLists}
      />
    </div>
  );
};
