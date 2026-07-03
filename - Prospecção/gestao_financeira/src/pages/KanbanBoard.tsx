import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Swal from 'sweetalert2';
import type { DropResult } from '@hello-pangea/dnd';
import { MoreHorizontal, Plus, X, FileText, Trash2, Download, Upload, Phone, Mail, Save, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


// Tipagens
interface ClientDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  content: string; // Base64
}

interface Client {
  id: string;
  name: string;
  budget: string;
  interest: string;
  propertyType?: string;
  interestLocations?: string[];
  propertyCategories?: string[];
  businessType?: string;
  businessTypes?: string[];
  tag: string;
  phone?: string;
  email?: string;
  notes?: string;
  documents?: ClientDocument[];
  isRegisteredUser?: boolean;
  brokerId?: string;
  brokerName?: string;
}

interface Column {
  id: string;
  title: string;
  clientIds: string[];
}

interface KanbanData {
  clients: Record<string, Client>;
  columns: Record<string, Column>;
  columnOrder: string[];
}

import { initialKanbanData } from '../data/initialData';
import CaixaShareModal from '../components/CaixaShareModal';

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const KanbanBoard = () => {
  const [data, setData] = useState<KanbanData>(initialKanbanData);
  const [isZoomedOut, setIsZoomedOut] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<Client | null>(null);

  // Campos de Edição do Modal
  const [editedName, setEditedName] = useState('');
  const [editedBudget, setEditedBudget] = useState('');
  const [editedInterest, setEditedInterest] = useState('');
  const [editedTag, setEditedTag] = useState('Novo');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [editedDocs, setEditedDocs] = useState<ClientDocument[]>([]);
  const [properties, setProperties] = useState<any[]>([]);

  // Novos campos estruturados
  const [editedLocations, setEditedLocations] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showMatchesPopup, setShowMatchesPopup] = useState(false);
  const [editedCategories, setEditedCategories] = useState<string[]>([]);
  const [editedBusinessTypes, setEditedBusinessTypes] = useState<string[]>([]);
  const [locInput, setLocInput] = useState('');
  const [showLocDropdown, setShowLocDropdown] = useState(false);
  const [selectedCaixaProperty, setSelectedCaixaProperty] = useState<any | null>(null);

  const { user: currentUser, users } = useAuth();
  const [editedBrokerId, setEditedBrokerId] = useState('');
  const [editedBrokerName, setEditedBrokerName] = useState('');

  const CATEGORIES = ['Apartamento', 'Casa', 'Chácara', 'Gleba', 'Kitnet', 'Loft', 'Prédio comercial', 'Sala Comercial', 'Sítio', 'Terreno'];
  const BUSINESS_TYPES = ['Qualquer', 'Venda', 'Aluguel', 'Leilão Caixa', 'Temporada'];

  // Carrega do DB
  useEffect(() => {
    fetch('/api.php?key=ruth_dias_kanban')
      .then(res => res.text())
      .then(text => {
        if (!text || text.trim().startsWith('<')) throw new Error('API não rodando PHP');
        let parsed = JSON.parse(text);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        return parsed;
      })
      .catch(() => {
        const local = localStorage.getItem('kanbanData') || localStorage.getItem('ruth_dias_kanban');
        if (local) {
          let parsed = JSON.parse(local);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          return parsed;
        }
        return null;
      })
      .then(data => {
        if (data && data.columns && data.clients && Object.keys(data.clients).length > 0) {
          setData(data);
        } else {
          setData(initialKanbanData);
        }
      })
      .catch(e => console.error("Falha ao carregar o Kanban:", e));

    // Carrega Imóveis para cálculo de Match do DB
    const fetchWithParse = async (key: string) => {
      try {
        const res = await fetch(`/api.php?key=${key}`);
        const text = await res.text();
        if (!text || text.trim().startsWith('<')) throw new Error('HTML');
        let parsed = JSON.parse(text);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        return parsed;
      } catch (e) {
        const local = localStorage.getItem(key);
        if (local) {
          let parsed = JSON.parse(local);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          return parsed;
        }
        return null;
      }
    };

    Promise.all([
      fetchWithParse('ruth_dias_properties'),
      fetchWithParse('ruth_dias_portfolio')
    ]).then(([propsData, portfolioData]) => {
      const allProps: any[] = [];
      
      if (propsData && propsData.db) {
        Object.values(propsData.db).forEach((list: any) => allProps.push(...list));
      }

      if (portfolioData && Array.isArray(portfolioData)) {
        allProps.push(...portfolioData);
      }
      
      setProperties(allProps);
    });
  }, []);

  // Auto-scroll manual durante o arrasto no celular
  useEffect(() => {
    if (!isDragging) return;

    let animationFrameId: number;
    let scrollSpeed = 0;

    const handleMove = (clientX: number) => {
      const screenWidth = window.innerWidth;
      const edgeSize = 60; // Área sensitiva nas bordas (pixels)
      const maxSpeed = 15;

      if (clientX < edgeSize) {
        scrollSpeed = -maxSpeed; // rola para esquerda
      } else if (clientX > screenWidth - edgeSize) {
        scrollSpeed = maxSpeed; // rola para direita
      } else {
        scrollSpeed = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);

    const scrollLoop = () => {
      if (scrollSpeed !== 0) {
        const board = document.querySelector('.kanban-board');
        if (board) {
          board.scrollLeft += scrollSpeed;
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    animationFrameId = requestAnimationFrame(scrollLoop);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDragging]);

  const getMatches = (businessTypes: string[], locations: string[], categories: string[], budget: string) => {
    const hasVenda = businessTypes.includes('Qualquer') || businessTypes.includes('Venda') || businessTypes.includes('Leilão Caixa') || businessTypes.length === 0;
    if (!hasVenda) return [];
    if (locations.length === 0) return []; // Retorna vazio se não houver local para não puxar todos os imóveis da base
    
    let budgetVal = 0;
    if (budget) {
      budgetVal = parseFloat(budget.replace(/[^\\d,]/g, '').replace(',', '.'));
    }
    
    return properties.filter(p => {
      if (budgetVal > 0) {
        const priceString = String(p.price || '0');
        const priceVal = parseFloat(priceString.replace(/[^0-9,]/g, '').replace(',', '.'));
        if (priceVal > budgetVal) return false;
      }
      
      if (locations.length > 0) {
        const textMatch = locations.some(loc => {
          const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          const l = normalize(loc);
          const city = normalize(String(p.city || ''));
          const neigh = normalize(String(p.neighborhood || ''));
          const pLoc = normalize(String(p.location || ''));
          
          if (loc.includes(' - ')) {
            const parts = loc.split(' - ');
            const n = normalize(parts[0]);
            const c = normalize(parts[1]);
            return neigh === n && city === c;
          }

          return city.includes(l) || neigh.includes(l) || pLoc.includes(l);
        });
        if (!textMatch) return false;
      }

      if (categories.length > 0) {
        const typeStr = String(p.type || '').toLowerCase();
        const pTypes = (p.propertyTypes || []).map((t: string) => t.toLowerCase());
        
        const catMatch = categories.some(cat => {
            const lCat = cat.toLowerCase();
            return typeStr.includes(lCat) || pTypes.includes(lCat);
        });
        if (!catMatch) return false;
      }
      
      return true;
    });
  };

  const saveToDb = (newData: KanbanData) => {
    setData(newData);
    fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ruth_dias_kanban', value: JSON.stringify(newData) })
    }).catch(e => console.error('Erro ao salvar no BD', e));
    
    // Fallback: Salva no localStorage para testes locais
    localStorage.setItem('ruth_dias_kanban', JSON.stringify(newData));
    localStorage.setItem('kanbanData', JSON.stringify(newData));
  };

  const onDragStart = () => {
    setIsDragging(true);
  };

  const onDragEnd = (result: DropResult) => {
    setIsDragging(false);
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const start = data.columns[source.droppableId];
    const finish = data.columns[destination.droppableId];

    // Movendo dentro da mesma coluna
    if (start === finish) {
      const newClientIds = Array.from(start.clientIds);
      newClientIds.splice(source.index, 1);
      newClientIds.splice(destination.index, 0, draggableId);

      const newColumn = {
        ...start,
        clientIds: newClientIds,
      };

      const newData = {
        ...data,
        columns: {
          ...data.columns,
          [newColumn.id]: newColumn,
        },
      };
      saveToDb(newData);
      return;
    }

    // Movendo entre colunas diferentes
    const startClientIds = Array.from(start.clientIds);
    startClientIds.splice(source.index, 1);
    const newStart = {
      ...start,
      clientIds: startClientIds,
    };

    const finishClientIds = Array.from(finish.clientIds);
    finishClientIds.splice(destination.index, 0, draggableId);
    const newFinish = {
      ...finish,
      clientIds: finishClientIds,
    };

    const newData = {
      ...data,
      columns: {
        ...data.columns,
        [newStart.id]: newStart,
        [newFinish.id]: newFinish,
      },
    };
    saveToDb(newData);
  };

  const openClientModal = (client: Client) => {
    setActiveClient(client);
    setEditedName(client.name);
    setEditedBudget(client.budget || '');
    setEditedInterest(client.interest || '');
    setEditedTag(client.tag);
    setEditedPhone(client.phone || '');
    setEditedEmail(client.email || '');
    setEditedNotes(client.notes || '');
    setEditedDocs(client.documents || []);

    setEditedLocations(client.interestLocations || (client.interest ? [client.interest] : []));
    setEditedCategories(client.propertyCategories || []);
    setEditedBusinessTypes(client.businessTypes || (client.businessType ? [client.businessType] : ['Qualquer']));
    setLocInput('');
    setFormError('');
    setMissingFields([]);

    setIsModalOpen(true);
  };

  const openNewClientModal = () => {
    setActiveClient(null);
    setEditedName('');
    setEditedBudget('');
    setEditedInterest('');
    setEditedTag('Novo');
    setEditedPhone('');
    setEditedEmail('');
    setEditedNotes('');
    setEditedDocs([]);

    setEditedLocations([]);
    setEditedCategories([]);
    setEditedBusinessTypes(['Qualquer']);
    setLocInput('');
    setFormError('');
    setMissingFields([]);

    setIsModalOpen(true);
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (!value) {
      setEditedBudget('');
      return;
    }
    const numericValue = parseInt(value, 10) / 100;
    const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numericValue);
    setEditedBudget(formatted);
  };

  const toggleCategory = (cat: string) => {
    if (editedCategories.includes(cat)) {
      setEditedCategories(editedCategories.filter(c => c !== cat));
    } else {
      setEditedCategories([...editedCategories, cat]);
    }
  };

  const toggleBusinessType = (bt: string) => {
    if (editedBusinessTypes.includes(bt)) {
      setEditedBusinessTypes(editedBusinessTypes.filter(c => c !== bt));
    } else {
      setEditedBusinessTypes([...editedBusinessTypes, bt]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Avisa se for maior que 3MB para preservar localStorage
    if (file.size > 3 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Arquivo muito grande',
        text: 'Para garantir um bom desempenho do sistema, envie arquivos de até 3MB.',
        confirmButtonColor: '#8a2346'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newDoc: ClientDocument = {
        id: 'doc_' + Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toLocaleDateString('pt-BR'),
        content: base64
      };
      setEditedDocs(prev => [...prev, newDoc]);
    };
    reader.readAsDataURL(file);
  };

  const downloadFile = (doc: ClientDocument) => {
    const link = document.createElement('a');
    link.href = doc.content;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteFile = (docId: string) => {
    setEditedDocs(prev => prev.filter(d => d.id !== docId));
  };

  const handleSave = () => {
    const missing: string[] = [];
    if (!editedName.trim()) missing.push('name');
    if (!editedTag.trim()) missing.push('tag');
    if (!editedPhone.trim()) missing.push('phone');
    if (editedBusinessTypes.length === 0) missing.push('businessTypes');
    if (!editedBudget.trim()) missing.push('budget');
    if (editedLocations.length === 0) missing.push('locations');

    if (missing.length > 0) {
      setMissingFields(missing);
      setFormError('Por favor, preencha todos os campos obrigatórios marcados em vermelho.');
      
      const modalOverlay = document.getElementById('modal-overlay');
      if (modalOverlay) modalOverlay.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    setMissingFields([]);
    setFormError('');

    const id = activeClient?.id || 'c_' + Math.random().toString(36).substr(2, 9);
    
    const updatedClient: Client = {
      id,
      name: editedName,
      budget: editedBudget,
      interest: editedLocations.join(', ') || editedInterest,
      propertyType: editedBusinessTypes.join(', '),
      interestLocations: editedLocations,
      propertyCategories: editedCategories,
      businessType: editedBusinessTypes.join(', '),
      businessTypes: editedBusinessTypes,
      tag: editedTag,
      phone: editedPhone,
      email: editedEmail,
      notes: editedNotes,
      documents: editedDocs,
      brokerId: editedBrokerId,
      brokerName: editedBrokerName
    };

    const newClients = {
      ...data.clients,
      [id]: updatedClient
    };

    let newColumns = { ...data.columns };
    
    // Se for cliente novo, coloca na primeira coluna
    if (!activeClient) {
      const firstColId = data.columnOrder[0];
      newColumns[firstColId] = {
        ...newColumns[firstColId],
        clientIds: [...newColumns[firstColId].clientIds, id]
      };
    }

    const newData = {
      ...data,
      clients: newClients,
      columns: newColumns
    };

    saveToDb(newData);
    setIsModalOpen(false);
  };

  const handleDeleteClient = () => {
    if (!activeClient) return;

    Swal.fire({
      title: 'Tem certeza?',
      text: `Deseja excluir permanentemente o cliente "${activeClient.name}" do pipeline?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const id = activeClient.id;
        const newClients = { ...data.clients };
        delete newClients[id];

        const newColumns = { ...data.columns };
        Object.keys(newColumns).forEach(colId => {
          newColumns[colId] = {
            ...newColumns[colId],
            clientIds: newColumns[colId].clientIds.filter(cid => cid !== id)
          };
        });

        const newData = { ...data, clients: newClients, columns: newColumns };
        saveToDb(newData);
        setIsModalOpen(false);
        Swal.fire({
          icon: 'success',
          title: 'Excluído!',
          text: 'O cliente foi removido com sucesso.',
          confirmButtonColor: '#8a2346'
        });
      }
    });
  };

  const handleAddColumn = async () => {
    const { value: title } = await Swal.fire({
      title: 'Nova Etapa',
      input: 'text',
      inputLabel: 'Nome da Etapa',
      inputPlaceholder: 'Ex: Visita Agendada',
      showCancelButton: true,
      confirmButtonText: 'Criar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#5c1b33',
    });

    if (title) {
      const newColId = 'col-' + Math.random().toString(36).substr(2, 9);
      const newColumn = {
        id: newColId,
        title: title,
        clientIds: [],
      };

      const newData = {
        ...data,
        columns: { ...data.columns, [newColId]: newColumn },
        columnOrder: [...data.columnOrder, newColId]
      };
      
      saveToDb(newData);
    }
  };

  const handleDeleteColumn = (columnId: string) => {
    const column = data.columns[columnId];
    if (column.clientIds.length > 0) {
      Swal.fire('Erro', 'Não é possível excluir uma etapa que contém clientes. Mova os clientes para outra etapa primeiro.', 'error');
      return;
    }

    Swal.fire({
      title: 'Excluir Etapa?',
      text: `Deseja realmente excluir a etapa "${column.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const newColumns = { ...data.columns };
        delete newColumns[columnId];
        
        const newColumnOrder = data.columnOrder.filter(id => id !== columnId);

        const newData = {
          ...data,
          columns: newColumns,
          columnOrder: newColumnOrder
        };
        
        saveToDb(newData);
      }
    });
  };

  return (
    <div className="animate-fade-in-simple" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="hide-on-mobile">
          <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Pipeline de Clientes</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Arraste os cards para atualizar o status e clique em um card para editar e anexar documentos.</p>
        </div>
        <div className="hide-on-mobile" style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={handleAddColumn} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Nova Etapa
          </button>
          <button className="btn btn-primary" onClick={openNewClientModal}>
            <Plus size={18} /> Novo Cliente
          </button>
        </div>
      </div>

      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="column">
          {(providedBoard) => (
            <div 
              className={`kanban-board ${isZoomedOut ? 'zoomed-out' : ''}`}
              ref={providedBoard.innerRef}
              {...providedBoard.droppableProps}
            >
              {data.columnOrder.map((columnId, index) => {
                const column = data.columns[columnId];
                const clients = column.clientIds.map((clientId) => data.clients[clientId])
                  .filter(Boolean)
                  .filter(client => {
                     if (currentUser?.role === 'corretor') return client.brokerId === currentUser.id;
                     return true;
                  });

                return (
                  <Draggable key={column.id} draggableId={column.id} index={index} isDragDisabled={true}>
                    {(providedCol) => (
                      <div 
                        className="kanban-column"
                        ref={providedCol.innerRef}
                        {...providedCol.draggableProps}
                        {...providedCol.dragHandleProps}
                      >
                        <div className="kanban-column-header" style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="kanban-column-title">{column.title}</span>
                            <span className="kanban-badge">{clients.length}</span>
                          </div>
                          {clients.length === 0 && (
                            <button 
                              onClick={() => handleDeleteColumn(column.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.5 }}
                              title="Excluir Etapa"
                              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      className="kanban-column-content"
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        backgroundColor: snapshot.isDraggingOver ? 'var(--bg-secondary)' : 'transparent',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      {clients.map((client, index) => (
                        <Draggable key={client.id} draggableId={client.id} index={index}>
                          {(provided, snapshot) => {
                            const child = (
                              <div
                                className="kanban-card"
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => openClientModal(client)}
                                style={{
                                  ...provided.draggableProps.style,
                                  opacity: snapshot.isDragging ? 0.9 : 1,
                                  transform: snapshot.isDragging ? `${provided.draggableProps.style?.transform} scale(1.03)` : provided.draggableProps.style?.transform,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div className="kanban-card-title">{client.name}</div>
                                    {client.isRegisteredUser && (!users || users.some(u => u.email === client.email)) && (
                                      <span style={{ fontSize: '0.7rem', backgroundColor: '#dcfce7', color: '#166534', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold', marginTop: '0.2rem', display: 'inline-block', alignSelf: 'flex-start' }}>
                                        ✓ Cadastrado no Site
                                      </span>
                                    )}
                                  </div>
                                  <MoreHorizontal size={16} color="var(--text-secondary)" />
                                </div>
                                <div className="kanban-card-desc">
                                  <div><strong>Interesse:</strong> {client.interest}</div>
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <strong>Tipo:</strong> <span style={{ color: (!client.propertyType || client.propertyType === 'Leilão') ? 'var(--info)' : 'var(--text-secondary)' }}>{client.propertyType || 'Leilão'}</span>
                                    <span>|</span>
                                    <strong>Verba:</strong> {client.budget}
                                  </div>
                                  {client.brokerName && (
                                    <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                      <strong>Corretor:</strong> {client.brokerName}
                                    </div>
                                  )}
                                </div>
                                <div className="kanban-card-footer" style={{ marginTop: '0.2rem' }}>
                                  <span className="kanban-card-tag" style={{
                                    backgroundColor: client.tag === 'Quente' ? 'rgba(239, 68, 68, 0.1)' : 
                                                   client.tag === 'Investidor' ? 'rgba(196, 154, 69, 0.1)' : 'var(--bg-tertiary)',
                                    color: client.tag === 'Quente' ? 'var(--danger)' : 
                                           client.tag === 'Investidor' ? 'var(--accent-color)' : 'var(--text-secondary)'
                                  }}>
                                    {client.tag}
                                  </span>
                                  {client.documents && client.documents.length > 0 && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                      📁 {client.documents.length} doc{client.documents.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Sistema de Match */}
                                {(() => {
                                  const safeBusinessTypes = Array.isArray(client.businessTypes) ? client.businessTypes : (Array.isArray(client.businessType) ? client.businessType : (typeof client.businessType === 'string' ? client.businessType.split(', ') : ['Qualquer']));
                                  const safeLocations = Array.isArray(client.interestLocations) ? client.interestLocations : (Array.isArray(client.interest) ? client.interest : (typeof client.interest === 'string' ? [client.interest] : []));
                                  const safeCategories = Array.isArray(client.propertyCategories) ? client.propertyCategories : [];
                                  
                                  const matches = getMatches(
                                    safeBusinessTypes,
                                    safeLocations,
                                    safeCategories, 
                                    client.budget || ''
                                  );
                                  if (matches.length > 0) {
                                    return (
                                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'white', backgroundColor: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                                        🔥 {matches.length} Match{matches.length > 1 ? 'es' : ''} na Caixa
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            );
                            if (snapshot.isDragging) {
                              return createPortal(child, document.body);
                            }
                            return child;
                          }}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                
                {/* Botão Novo Cliente Mobile */}
                <div className="show-on-mobile" style={{ padding: '0.5rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                  <button className="btn btn-ghost" onClick={openNewClientModal} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <Plus size={16} /> Adicionar Cliente
                  </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {providedBoard.placeholder}
              
              {/* Nova Etapa - Mobile (como o Trello) */}
          <div className="kanban-column show-on-mobile" style={{ backgroundColor: 'transparent', border: '1px dashed var(--border-color)', minWidth: '85vw', width: '85vw', height: 'auto', minHeight: '100px' }}>
            <button className="btn btn-ghost" onClick={handleAddColumn} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <Plus size={18} /> Criar Nova Etapa
            </button>
          </div>
            </div>
          )}
        </Droppable>
        
        {/* Botão de Zoom (Lupa) no Mobile */}
        <div className="show-on-mobile" style={{ position: 'fixed', bottom: '2rem', right: '1.5rem', zIndex: 100 }}>
          <button 
            onClick={() => setIsZoomedOut(!isZoomedOut)}
            style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#6a9c3d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', border: 'none' }}
          >
            {isZoomedOut ? <ZoomIn size={24} /> : <ZoomOut size={24} />}
          </button>
        </div>
      </DragDropContext>

      {/* Modal de Detalhes / Edição de Cliente */}
      {isModalOpen && (
        <div 
          id="modal-overlay"
          style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000,
          overflowY: 'auto', padding: '2rem 1rem'
        }} onClick={() => setIsModalOpen(false)}>
          
          <div 
            className="card animate-fade-in-simple" 
            style={{ 
              width: '100%', maxWidth: '1150px', backgroundColor: 'var(--bg-primary)', 
              padding: 0, margin: '2rem auto' 
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>
                {activeClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button className="btn btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div style={{ padding: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
              
              {/* Coluna Esquerda: Dados do Cliente */}
              <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {formError && (
                <div className="animate-fade-in-simple" style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <X size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>{formError}</div>
                </div>
              )}
              
              {/* Informações Consolidadas (3 Colunas) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: missingFields.includes('name') ? 'var(--danger)' : 'var(--text-secondary)' }}>Nome do Cliente <span style={{color: 'var(--danger)'}}>*</span></label>
                  <input 
                    type="text" 
                    className="input" 
                    style={{ border: missingFields.includes('name') ? '1px solid var(--danger)' : undefined }}
                    value={editedName} 
                    onChange={e => setEditedName(e.target.value)} 
                    placeholder="Ex: João da Silva"
                    required
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Corretor Responsável</label>
                  {((currentUser?.role !== 'CEO' && currentUser?.role !== 'Sócio CFO') || (currentUser?.role === 'CEO' || currentUser?.role === 'Sócio CFO')) ? (
                    <select 
                      className="input" 
                      value={editedBrokerId} 
                      onChange={e => {
                        setEditedBrokerId(e.target.value);
                        const user = users.find(u => u.id === e.target.value);
                        setEditedBrokerName(user ? user.name : '');
                      }}
                    >
                      <option value="">-- Sem Corretor --</option>
                      {users && users.filter(u => ['corretor', 'gerente', 'admin', 'CEO', 'Sócio CFO'].includes(u.role)).map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      className="input" 
                      value={editedBrokerName || 'Não atribuído'} 
                      disabled
                      style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                    />
                  )}
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: missingFields.includes('tag') ? 'var(--danger)' : 'var(--text-secondary)' }}>Status / Tag <span style={{color: 'var(--danger)'}}>*</span></label>
                  <select 
                    className="input" 
                    style={{ border: missingFields.includes('tag') ? '1px solid var(--danger)' : undefined }}
                    value={editedTag} 
                    onChange={e => setEditedTag(e.target.value)}
                  >
                    <option value="Novo">Novo</option>
                    <option value="Quente">Quente (Alta Prioridade)</option>
                    <option value="Morno">Morno</option>
                    <option value="Frio">Frio</option>
                    <option value="Investidor">Investidor</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: missingFields.includes('phone') ? 'var(--danger)' : 'var(--text-secondary)' }}>Telefone / WhatsApp <span style={{color: 'var(--danger)'}}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="tel" 
                      className="input" 
                      style={{ paddingLeft: '2.2rem', border: missingFields.includes('phone') ? '1px solid var(--danger)' : undefined }}
                      value={editedPhone} 
                      onChange={e => setEditedPhone(e.target.value)} 
                      placeholder="Ex: 61999999999"
                    />
                    <Phone size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>E-mail</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="email" 
                      className="input" 
                      style={{ paddingLeft: '2.2rem' }}
                      value={editedEmail} 
                      onChange={e => setEditedEmail(e.target.value)} 
                      placeholder="Ex: cliente@email.com"
                    />
                    <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: missingFields.includes('businessTypes') ? 'var(--danger)' : 'var(--text-secondary)' }}>Tipo de Negócio <span style={{color: 'var(--danger)'}}>*</span></label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.4rem', border: missingFields.includes('businessTypes') ? '1px solid var(--danger)' : '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-primary)' }}>
                    {BUSINESS_TYPES.map(bt => (
                      <label key={bt} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderRadius: '4px', cursor: 'pointer', backgroundColor: editedBusinessTypes.includes(bt) ? 'rgba(16, 185, 129, 0.1)' : 'transparent', border: editedBusinessTypes.includes(bt) ? '1px solid #10b981' : '1px solid transparent' }}>
                        <input type="checkbox" checked={editedBusinessTypes.includes(bt)} onChange={() => toggleBusinessType(bt)} style={{ cursor: 'pointer' }} />
                        {bt}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: missingFields.includes('budget') ? 'var(--danger)' : 'var(--text-secondary)' }}>Verba Disponível (Máxima) <span style={{color: 'var(--danger)'}}>*</span></label>
                  <input 
                    type="text" 
                    className="input" 
                    style={{ border: missingFields.includes('budget') ? '1px solid var(--danger)' : undefined }}
                    value={editedBudget} 
                    onChange={handleBudgetChange} 
                    placeholder="Ex: R$ 350.000,00"
                  />
                </div>
              </div>

              {/* Critérios Avançados de Busca (Para Match) */}
              <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.9rem', margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={16} /> Parâmetros para Busca Ideal
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  {/* Locais */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: missingFields.includes('locations') ? 'var(--danger)' : 'var(--text-secondary)' }}>Localização de Interesse <span style={{color: 'var(--danger)'}}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input 
                          type="text" 
                          className="input" 
                          style={{ border: missingFields.includes('locations') ? '1px solid var(--danger)' : undefined, flex: 1 }} 
                          value={locInput} 
                          onChange={e => { setLocInput(e.target.value); setShowLocDropdown(true); }} 
                          onFocus={() => setShowLocDropdown(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if(locInput.trim() && !editedLocations.includes(locInput.trim())) { 
                                setEditedLocations([...editedLocations, locInput.trim()]); 
                                setLocInput(''); 
                                setShowLocDropdown(false);
                              }
                            }
                          }} 
                          placeholder="Ex: Asa Norte ou Guará - Brasília" 
                        />
                        <button className="btn btn-secondary" onClick={(e) => { e.preventDefault(); if(locInput.trim() && !editedLocations.includes(locInput.trim())) { setEditedLocations([...editedLocations, locInput.trim()]); setLocInput(''); setShowLocDropdown(false); } }}>Add</button>
                      </div>
                      
                      {showLocDropdown && locInput.trim().length > 1 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                          {Array.from(new Set(properties.filter(p => p.neighborhood && p.city).map(p => `${p.neighborhood} - ${p.city}`)))
                            .filter(loc => {
                              const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                              return normalize(loc).includes(normalize(locInput));
                            })
                            .slice(0, 15)
                            .map(loc => (
                              <div 
                                key={loc} 
                                style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}
                                onClick={() => {
                                  if(!editedLocations.includes(loc)) {
                                    setEditedLocations([...editedLocations, loc]);
                                  }
                                  setLocInput('');
                                  setShowLocDropdown(false);
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {loc}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {editedLocations.map(loc => (
                        <span key={loc} style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          {loc} <X size={12} style={{ cursor: 'pointer', color: 'var(--danger)' }} onClick={() => setEditedLocations(editedLocations.filter(l => l !== loc))} />
                        </span>
                      ))}
                      {editedLocations.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Qualquer localidade</span>}
                    </div>
                  </div>

                  {/* Categorias */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Tipos de Imóvel</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-primary)' }}>
                      {CATEGORIES.map(cat => (
                        <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.2rem 0.4rem', borderRadius: '4px', cursor: 'pointer', backgroundColor: editedCategories.includes(cat) ? 'rgba(16, 185, 129, 0.1)' : 'transparent', border: editedCategories.includes(cat) ? '1px solid #10b981' : '1px solid transparent' }}>
                          <input type="checkbox" checked={editedCategories.includes(cat)} onChange={() => toggleCategory(cat)} style={{ cursor: 'pointer' }} />
                          {cat}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Anotações / Notas de Atendimento</label>
                <textarea 
                  className="input" 
                  style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
                  value={editedNotes} 
                  onChange={e => setEditedNotes(e.target.value)} 
                  placeholder="Informações adicionais do cliente, perfil de compra, datas importantes..."
                />
              </div>

              </div> {/* Fim da Coluna Esquerda */}

              {/* Coluna Direita: Anexos e Oportunidades */}
              <div style={{ flex: '0 1 350px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Seção de Documentos e Contratos */}
              <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Documentos e Contratos</label>
                  <label className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', gap: '0.25rem' }}>
                    <Upload size={14} /> Anexar Arquivo
                    <input 
                      type="file" 
                      style={{ display: 'none' }} 
                      onChange={handleFileUpload} 
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                    />
                  </label>
                </div>

                {editedDocs.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}>
                    <FileText size={24} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', opacity: 0.4 }} />
                    <p style={{ fontSize: '0.8rem', margin: 0 }}>Nenhum contrato ou documento anexado ainda.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {editedDocs.map((doc) => (
                      <div 
                        key={doc.id} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-secondary)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', flex: 1 }}>
                          <FileText size={18} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }} title={doc.name}>
                              {doc.name}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {formatBytes(doc.size)} | Anexado em: {doc.uploadedAt}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                          <button className="btn btn-ghost" style={{ padding: '0.3rem' }} onClick={() => downloadFile(doc)} title="Baixar Documento">
                            <Download size={14} />
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '0.3rem', color: 'var(--danger)' }} onClick={() => deleteFile(doc.id)} title="Excluir Documento">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nova Seção: Matches */}
              {(() => {
                const matches = getMatches(editedBusinessTypes, editedLocations, editedCategories, editedBudget);
                if (matches.length > 0) {
                  const displayMatches = matches.slice(0, 10);
                  return (
                    <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid #10b981' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.95rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          🔥 {matches.length} Oportunidade{matches.length > 1 ? 's' : ''} Encontrada{matches.length > 1 ? 's' : ''} na Caixa
                        </label>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {displayMatches.map((m, i) => (
                          <div 
                            key={i} 
                            style={{ padding: '0.75rem', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            onClick={() => setSelectedCaixaProperty(m)}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{m.neighborhood}, {m.city}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Desc: {m.discount} | Avaliação: {m.appraisal || m.appraisalValue}</div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <div style={{ fontWeight: 700, color: '#10b981' }}>{m.price}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {matches.length > 10 && (
                        <button 
                          className="btn btn-outline" 
                          style={{ width: '100%', marginTop: '1rem', borderColor: '#10b981', color: '#10b981', borderStyle: 'dashed' }}
                          onClick={(e) => { e.preventDefault(); setShowMatchesPopup(true); }}
                        >
                          Ver todas as {matches.length} oportunidades
                        </button>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
              
              </div> {/* Fim da Coluna Direita */}

            </div>

            {/* Footer do Modal */}
            <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', borderRadius: '0 0 var(--radius-md) var(--radius-md)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                {activeClient && (
                  <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={handleDeleteClient}>
                    <Trash2 size={16} /> Excluir Cliente
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSave} style={{ gap: '0.5rem' }}>
                  <Save size={16} /> Salvar Cliente
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Popup de Oportunidades (Matches) Completas */}
      {showMatchesPopup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 20000,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '1rem'
        }} onClick={() => setShowMatchesPopup(false)}>
          <div 
            className="card animate-fade-in-simple" 
            style={{ 
              width: '100%', maxWidth: '600px', backgroundColor: 'var(--bg-primary)', 
              padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                🔥 Oportunidades Encontradas na Caixa
              </h3>
              <button className="btn btn-ghost" style={{ padding: '0.2rem' }} onClick={() => setShowMatchesPopup(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(() => {
                const matches = getMatches(editedBusinessTypes, editedLocations, editedCategories, editedBudget);
                return matches.map((m, i) => (
                  <div 
                    key={i} 
                    style={{ padding: '1rem', border: '1px solid #10b981', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setSelectedCaixaProperty(m)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{m.neighborhood}, {m.city}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Desc: {m.discount} | Avaliação: {m.appraisal || m.appraisalValue}</div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div style={{ fontWeight: 700, color: '#10b981', fontSize: '1.1rem' }}>{m.price}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {selectedCaixaProperty && (
        <CaixaShareModal 
          property={selectedCaixaProperty} 
          onClose={() => setSelectedCaixaProperty(null)} 
        />
      )}

      {/* Estilos CSS Locais para Animação e Evitar Bugs no Drag and Drop */}
      <style>{`
        .animate-fade-in-simple {
          animation: fadeInSimple 0.4s ease-out forwards;
        }
        @keyframes fadeInSimple {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        /* Corrigir posições de drop */
        .kanban-column-content {
          min-height: 150px;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .kanban-card {
          user-select: none;
        }
      `}</style>
    </div>
  );
};

export default KanbanBoard;
