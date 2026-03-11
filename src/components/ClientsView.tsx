import React, { useState } from 'react';
import { Client, Tag, CompanyType, CommercialList, CommercialCard, FinancialList, FinancialCard, OperationList, OperationCard } from '../types';
import { addClient, updateClient, deleteClient, addTag, updateTag, deleteTag } from '../services/firestoreService';
import { Plus, Edit2, Trash2, Settings, Search, TrendingUp, UserPlus } from 'lucide-react';
import { Modal } from './Modal';

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
}

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
  operationCards
}) => {
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Client Form State
  const [clientName, setClientName] = useState('');
  const [clientTheme, setClientTheme] = useState<'blue' | 'yellow'>('blue');
  const [clientTags, setClientTags] = useState<string[]>([]);
  const [clientNotes, setClientNotes] = useState('');

  // Tag Form State
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#5271FF');

  const openNewClientModal = () => {
    setEditingClient(null);
    setClientName('');
    setClientTheme('blue');
    setClientTags([]);
    setClientNotes('');
    setIsClientModalOpen(true);
  };

  const openEditClientModal = (client: Client) => {
    setEditingClient(client);
    setClientName(client.name);
    setClientTheme(client.themeColor);
    setClientTags(client.serviceTags || []);
    setClientNotes(client.notes || '');
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
      companyId,
      checklist: editingClient?.checklist || []
    };

    if (editingClient) {
      await updateClient(editingClient.id, clientData);
    } else {
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Clientes</h1>
          <p className="text-stone-500 text-sm mt-1">Base central de clientes e serviços.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsTagsModalOpen(true)}
            className="bg-white border border-stone-200 text-stone-700 px-4 py-2 rounded-xl hover:bg-stone-50 transition-colors flex items-center gap-2 text-sm font-bold shadow-sm"
          >
            <Settings size={16} />
            Gerenciar Tags
          </button>
          <button 
            onClick={openNewClientModal}
            className="bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-stone-800 transition-colors flex items-center gap-2 text-sm font-bold"
          >
            <Plus size={16} />
            Novo Cliente
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/50">
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-stone-500">Nome do Cliente</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-stone-500">Setores</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-stone-500">Serviços Atribuídos</th>
                <th className="p-4 text-xs font-bold uppercase tracking-widest text-stone-500 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => {
                const commCard = commercialCards.find(c => c.clientId === client.id && !c.deleted);
                const commList = commCard ? commercialLists.find(l => l.id === commCard.listId) : null;
                
                const finCard = financialCards.find(c => c.clientId === client.id && !c.deleted);
                const finList = finCard ? financialLists.find(l => l.id === finCard.listId) : null;

                const opCard = operationCards.find(c => c.clientId === client.id && !c.deleted);
                const opList = opCard ? operationLists.find(l => l.id === opCard.listId) : null;

                return (
                  <tr key={client.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${client.themeColor === 'blue' ? 'bg-[#5271FF]' : 'bg-[#FFD166]'}`} />
                        <span className="font-bold text-stone-900">{client.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
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
                        {!commList && !finList && !opList && (
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
                    <td className="p-4">
                      <div className="flex items-center gap-2">
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
                  <td colSpan={4} className="p-8 text-center text-stone-500">
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
                    backgroundColor: clientTags.includes(tag.id) ? tag.color : 'white',
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
            <textarea 
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 min-h-[100px] resize-none"
              placeholder="Informações adicionais do cliente..."
            />
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
    </div>
  );
};
