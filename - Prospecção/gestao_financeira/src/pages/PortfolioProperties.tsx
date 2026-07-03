import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, MapPin, X, Share2, Building, ChevronLeft, ChevronRight } from 'lucide-react';
import Swal from 'sweetalert2';
import { initialPortfolioProperties } from '../data/initialData';

interface PortfolioProperty {
  id: string;
  title: string;
  type: string; // 'Novo' | 'Usado' fallback
  city: string; // fallback
  neighborhood: string; // fallback
  price: string;
  description: string;
  imageUrl?: string;

  propertyTypes?: string[];
  businessTypes?: string[];
  petRule?: string;
  furniture?: string;
  suites?: string;
  bathrooms?: string;
  rooms?: string;
  garages?: string;
  area?: string;
  hectares?: string;
  location?: string;
  condo?: string;
  iptu?: string;
  fireInsurance?: string;
  serviceFee?: string;
  gallery?: string[];
  videoUrl?: string;
  featured?: boolean;
  isActive?: boolean;
}

const defaultFormData: PortfolioProperty = {
  id: '',
  title: '',
  type: 'Usado', // Padrão
  city: '',
  neighborhood: '',
  price: '',
  description: '',
  garages: '0',
  area: '',
  hectares: '',
  location: '',
  condo: '',
  iptu: '',
  fireInsurance: '',
  serviceFee: '',
  propertyTypes: [],
  businessTypes: [],
  gallery: [],
  videoUrl: '',
  featured: false,
  isActive: true
};

const formatPrice = (price?: string | number) => {
  if (!price) return 'Sob Consulta';
  const strPrice = String(price).trim();
  if (strPrice.toLowerCase().includes('r$') && strPrice.includes(',')) return strPrice;
  const numericString = strPrice.replace(/\D/g, '');
  if (!numericString) return strPrice;
  let numValue = 0;
  if (strPrice.includes(',')) {
    numValue = parseInt(numericString, 10) / 100;
  } else {
    numValue = parseInt(numericString, 10);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
};

const PropertyCard = ({ prop, openEditModal, deleteProperty, toggleActiveStatus }: any) => {
  const allImages = [prop.imageUrl, ...(prop.gallery || [])].filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allImages.length <= 1) return;
    setImgIdx(i => i === 0 ? allImages.length - 1 : i - 1);
  };

  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allImages.length <= 1) return;
    setImgIdx(i => i === allImages.length - 1 ? 0 : i + 1);
  };

  return (
    <div className="card" onClick={() => openEditModal(prop)} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', opacity: prop.isActive === false ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      <div style={{ position: 'relative', height: '200px', backgroundColor: 'var(--bg-tertiary)' }}>
        {allImages.length > 0 ? (
          <img src={allImages[imgIdx]} alt={prop.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Building size={48} color="var(--text-secondary)" opacity={0.3} />
          </div>
        )}
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', backgroundColor: prop.type === 'Novo' ? 'var(--info)' : 'var(--warning)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600 }}>
          {prop.type}
        </div>
        
        {allImages.length > 1 && (
          <>
            <div onClick={prevImg} style={{ position: 'absolute', top: '50%', left: '0.5rem', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
              <ChevronLeft size={18} color="#5c1b33" />
            </div>
            <div onClick={nextImg} style={{ position: 'absolute', top: '50%', right: '0.5rem', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
              <ChevronRight size={18} color="#5c1b33" />
            </div>
            <div style={{ position: 'absolute', bottom: '0.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.3rem', zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>
              {allImages.map((_, i) => (
                <div key={i} onClick={(e) => { e.stopPropagation(); setImgIdx(i); }} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: imgIdx === i ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }} />
              ))}
            </div>
          </>
        )}
      </div>
      
      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{prop.title}</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); openEditModal(prop); }}>
              Editar
            </button>
            <button type="button" className="btn btn-ghost" style={{ padding: '0.2rem', color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); deleteProperty(prop.id); }}>
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <MapPin size={14} />
          <span>{prop.neighborhood}, {prop.city}</span>
        </div>
        
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', flex: 1 }}>
          {prop.description.substring(0, 100)}{prop.description.length > 100 ? '...' : ''}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c49a45', letterSpacing: '-0.5px', lineHeight: 1 }}>
            {formatPrice(prop.price)}
          </span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={(e) => toggleActiveStatus(e, prop)}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{prop.isActive === false ? 'Inativo' : 'Ativo'}</span>
              <div style={{ width: '40px', height: '24px', backgroundColor: prop.isActive === false ? '#cbd5e1' : '#3b82f6', borderRadius: '20px', position: 'relative', transition: 'background-color 0.2s' }}>
                <div style={{ width: '18px', height: '18px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: prop.isActive === false ? '3px' : '19px', transition: 'left 0.2s' }}></div>
              </div>
            </label>
            <button type="button" className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={(e) => { e.stopPropagation(); /* compartihar - lógica ficaria aqui */ }}>
              <Share2 size={14} /> Compartilhar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PortfolioProperties = () => {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState(defaultFormData);
  const [formError, setFormError] = useState('');
  const [missingFields, setMissingFields] = useState<string[]>([]);
  
  // Opções para categorias
  const CATEGORIES = ['Apartamento', 'Casa', 'Chácara', 'Gleba', 'Kitnet', 'Loft', 'Prédio comercial', 'Sala Comercial', 'Sítio', 'Terreno'];
  const BUSINESS_TYPES = ['ALUGADO!', 'Aluguel', 'Locação', 'Salão de Festas', 'Temporada', 'Venda', 'VENDIDO!'];

  // Categoria lateral
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');

  useEffect(() => {
    fetch('/api.php?key=ruth_dias_portfolio')
      .then(res => res.text())
      .then(text => {
        if (!text || text.trim().startsWith('<')) throw new Error('API não rodando PHP');
        let parsed = JSON.parse(text);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        return parsed;
      })
      .catch(() => {
        const local = localStorage.getItem('ruth_dias_portfolio');
        if (local) {
          let parsed = JSON.parse(local);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          return parsed;
        }
        return null;
      })
      .then(parsed => {
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          setProperties(parsed);
        } else {
          setProperties(initialPortfolioProperties as PortfolioProperty[]);
        }
      })
      .catch(e => console.error('Falha ao carregar portfólio do BD', e));
  }, []);

  const syncDb = (newProps: PortfolioProperty[]) => {
    setProperties(newProps);
    fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ruth_dias_portfolio', value: JSON.stringify(newProps) })
    }).catch(console.error);
    localStorage.setItem('ruth_dias_portfolio', JSON.stringify(newProps));
  };

  const saveProperty = () => {
    const missing: string[] = [];
    if (!formData.title?.trim()) missing.push('title');
    if (!formData.price?.trim()) missing.push('price');
    if (!formData.location?.trim()) missing.push('location');
    if (!formData.propertyTypes || formData.propertyTypes.length === 0) missing.push('propertyTypes');
    if (!formData.businessTypes || formData.businessTypes.length === 0) missing.push('businessTypes');

    if (missing.length > 0) {
      setMissingFields(missing);
      setFormError('Por favor, preencha todos os campos obrigatórios marcados com asterisco (*).');
      const modalOverlay = document.getElementById('prop-modal-overlay');
      if (modalOverlay) modalOverlay.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setFormError('');
    setMissingFields([]);
    
    // Tentar extrair cidade e bairro da localização para retrocompatibilidade
    let city = formData.city;
    let neighborhood = formData.neighborhood;
    if (formData.location && (!city || !neighborhood)) {
      const parts = formData.location.split(',');
      if (parts.length >= 2) {
        neighborhood = parts[0].trim();
        city = parts[1].trim();
      } else {
        city = formData.location;
      }
    }

    const newProp: PortfolioProperty = {
      ...formData,
      id: formData.id || 'p_' + Math.random().toString(36).substr(2, 9),
      city,
      neighborhood,
      imageUrl: formData.imageUrl || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80'
    };

    const newProps = formData.id 
      ? properties.map(p => p.id === formData.id ? newProp : p)
      : [newProp, ...properties];
      
    syncDb(newProps);
    setIsModalOpen(false);

    Swal.fire({
      icon: 'success',
      title: formData.id ? 'Imóvel Atualizado!' : 'Imóvel Cadastrado!',
      text: formData.id ? 'As alterações foram salvas com sucesso.' : 'O novo imóvel foi cadastrado com sucesso.',
      confirmButtonColor: '#8a2346'
    });
  };

  const openNewModal = () => {
    setFormData(defaultFormData);
    setFormError('');
    setMissingFields([]);
    setIsModalOpen(true);
  };

  const openEditModal = (prop: PortfolioProperty) => {
    setFormData({
      ...defaultFormData,
      ...prop,
      propertyTypes: prop.propertyTypes || [],
      businessTypes: prop.businessTypes || [],
      gallery: prop.gallery || []
    });
    setFormError('');
    setMissingFields([]);
    setIsModalOpen(true);
  };

  const updateForm = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800; // max dimension

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // compress to 70% JPEG
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isGallery: boolean = false) => {
    const files = e.target.files;
    if (!files) return;

    if (!isGallery) {
      const file = files[0];
      if (file) {
        if (file.size > 8 * 1024 * 1024) { 
          Swal.fire({
            icon: 'warning',
            title: 'Arquivo muito grande',
            text: 'Por favor, envie arquivos de no máximo 8MB.',
            confirmButtonColor: '#8a2346'
          });
          return; 
        }
        const compressed = await compressImage(file);
        updateForm('imageUrl', compressed);
      }
    } else {
      const newImages: string[] = [];
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > 8 * 1024 * 1024) continue;
        const compressed = await compressImage(files[i]);
        newImages.push(compressed);
      }
      if (newImages.length > 0) {
        updateForm('gallery', [...(formData.gallery || []), ...newImages]);
      }
    }
  };

  const deleteProperty = (id: string) => {
    Swal.fire({
      title: 'Excluir Imóvel?',
      text: "Deseja realmente excluir este imóvel do seu portfólio?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const newList = properties.filter(p => p.id !== id);
        syncDb(newList);
        Swal.fire({
          icon: 'success',
          title: 'Excluído!',
          text: 'O imóvel foi removido com sucesso.',
          confirmButtonColor: '#8a2346'
        });
      }
    });
  };

  const toggleActiveStatus = (e: React.MouseEvent, prop: PortfolioProperty) => {
    e.stopPropagation(); // prevent modal opening
    const newProps = properties.map(p => p.id === prop.id ? { ...p, isActive: p.isActive === false ? true : false } : p);
    syncDb(newProps);
  };

  const filtered = properties.filter(p => 
    p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: '0.5rem' }}>Portfólio de Imóveis (Novos e Usados)</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Gerencie seus imóveis de terceiros e lançamentos que estão divulgados em ruthdiasimoveis.com.br.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNewModal}>
          <Plus size={18} /> Novo Imóvel
        </button>
      </div>

      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            className="input" 
            placeholder="Buscar por nome, bairro ou tipo..." 
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '1.5rem',
        paddingBottom: '2rem'
      }}>
        {filtered.map(prop => (
          <PropertyCard 
            key={prop.id} 
            prop={prop} 
            openEditModal={openEditModal} 
            deleteProperty={deleteProperty} 
            toggleActiveStatus={toggleActiveStatus} 
          />
        ))}
      </div>

      {isModalOpen && createPortal(
        <div 
          id="prop-modal-overlay"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 99999, overflowY: 'auto', padding: '2rem' }}
          onClick={() => setIsModalOpen(false)}
        >
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '800px', backgroundColor: 'white', margin: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{formData.id ? 'Editar Imóvel' : 'Cadastrar Novo Imóvel'}</h2>
              <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)} style={{ padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

              {formError && (
                <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <X size={18} /> {formError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Linha 1: Nome */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: missingFields.includes('title') ? 'var(--danger)' : 'var(--text-primary)' }}>Nome do imóvel*</label>
                  <input className="input" style={{ border: missingFields.includes('title') ? '1px solid var(--danger)' : undefined }} value={formData.title} onChange={e => updateForm('title', e.target.value)} />
                </div>

                {/* Linha 2: Tipos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.8rem', color: missingFields.includes('propertyTypes') ? 'var(--danger)' : 'var(--text-primary)' }}>Tipo de Imóvel*</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', border: missingFields.includes('propertyTypes') ? '1px solid var(--danger)' : 'none' }}>
                      {CATEGORIES.map(cat => {
                        const types = formData.propertyTypes || [];
                        return (
                        <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={types.includes(cat)} onChange={() => {
                            const newArr = types.includes(cat) ? types.filter(c => c !== cat) : [...types, cat];
                            updateForm('propertyTypes', newArr);
                          }} /> {cat}
                        </label>
                      )})}
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.8rem', color: missingFields.includes('businessTypes') ? 'var(--danger)' : 'var(--text-primary)' }}>Tipo de Negócio*</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', border: missingFields.includes('businessTypes') ? '1px solid var(--danger)' : 'none' }}>
                      {BUSINESS_TYPES.map(bt => {
                        const bTypes = formData.businessTypes || [];
                        return (
                        <label key={bt} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={bTypes.includes(bt)} onChange={() => {
                            const newArr = bTypes.includes(bt) ? bTypes.filter(c => c !== bt) : [...bTypes, bt];
                            updateForm('businessTypes', newArr);
                          }} /> {bt}
                        </label>
                      )})}
                    </div>
                  </div>
                </div>

                {/* Linha 3: Descrição */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Descrição do imóvel</label>
                  <textarea className="input" style={{ minHeight: '80px', resize: 'vertical' }} value={formData.description} onChange={e => updateForm('description', e.target.value)} />
                </div>

                {/* Linha 4: Selects */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                  <select className="input" value={formData.petRule} onChange={e => updateForm('petRule', e.target.value)}>
                    <option value="">Regra pet</option>
                    <option value="Permitido">Permitido</option>
                    <option value="Não Permitido">Não Permitido</option>
                  </select>
                  <select className="input" value={formData.furniture} onChange={e => updateForm('furniture', e.target.value)}>
                    <option value="Sem Mobília">Sem Mobília</option>
                    <option value="Semi-mobiliado">Semi-mobiliado</option>
                    <option value="Mobiliado">Mobiliado</option>
                  </select>
                  <select className="input" value={formData.suites} onChange={e => updateForm('suites', e.target.value)}>
                    <option value="0 Suítes">0 Suítes</option>
                    <option value="1 Suíte">1 Suíte</option>
                    <option value="2 Suítes">2 Suítes</option>
                    <option value="3 Suítes">3 Suítes</option>
                    <option value="4+ Suítes">4+ Suítes</option>
                  </select>
                  <select className="input" value={formData.bathrooms} onChange={e => updateForm('bathrooms', e.target.value)}>
                    <option value="1 Banheiro">1 Banheiro</option>
                    <option value="2 Banheiros">2 Banheiros</option>
                    <option value="3 Banheiros">3 Banheiros</option>
                    <option value="4+ Banheiros">4+ Banheiros</option>
                  </select>
                </div>

                {/* Linha 5: Inputs numéricos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Quartos</label>
                    <input type="number" className="input" value={formData.rooms} onChange={e => updateForm('rooms', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Vagas</label>
                    <input type="number" className="input" value={formData.garages} onChange={e => updateForm('garages', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Metragem</label>
                    <input type="text" className="input" value={formData.area} onChange={e => updateForm('area', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Hectares</label>
                    <input type="text" className="input" value={formData.hectares} onChange={e => updateForm('hectares', e.target.value)} />
                  </div>
                </div>

                {/* Linha 6: Localização e Preço */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div style={{ flex: 2, minWidth: '300px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: missingFields.includes('location') ? 'var(--danger)' : 'var(--text-primary)' }}>Localização*</label>
                    <input type="text" className="input" style={{ border: missingFields.includes('location') ? '1px solid var(--danger)' : undefined }} value={formData.location} onChange={e => updateForm('location', e.target.value)} placeholder="Bairro, Cidade" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: missingFields.includes('price') ? 'var(--danger)' : 'var(--text-primary)' }}>Preço do imóvel*</label>
                    <input type="text" className="input" style={{ border: missingFields.includes('price') ? '1px solid var(--danger)' : undefined }} value={formData.price} onChange={e => updateForm('price', e.target.value)} placeholder="R$ 0,00" />
                  </div>
                </div>

                {/* Linha 7: Taxas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Condomínio</label>
                    <input type="text" className="input" value={formData.condo} onChange={e => updateForm('condo', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>IPTU</label>
                    <input type="text" className="input" value={formData.iptu} onChange={e => updateForm('iptu', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Seguro incendio</label>
                    <input type="text" className="input" value={formData.fireInsurance} onChange={e => updateForm('fireInsurance', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Taxa de serviço</label>
                    <input type="text" className="input" value={formData.serviceFee} onChange={e => updateForm('serviceFee', e.target.value)} />
                  </div>
                </div>

                {/* Linha 8: Fotos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#e5e7eb', padding: '1rem', borderRadius: '8px', minHeight: '150px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem', color: '#7a1b3c' }}>Foto do imóvel</label>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', border: '1px solid #ccc', padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>
                        Escolher arquivos
                        <input type="file" style={{ display: 'none' }} onChange={e => handleFileUpload(e, false)} accept="image/*" />
                      </label>
                      <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
                        {formData.imageUrl ? '1 arquivo escolhido' : 'Nenhum arquivo escolhido'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.2rem' }}>Maximum file size: 2 MB</div>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem', color: '#7a1b3c' }}>Galeria de Fotos</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', border: '1px solid #ccc', padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>
                        Escolher arquivos
                        <input type="file" multiple style={{ display: 'none' }} onChange={e => handleFileUpload(e, true)} accept="image/*" />
                      </label>
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>
                        {(formData.gallery || []).length > 0 ? `${(formData.gallery || []).length} arquivos escolhidos` : 'Nenhum arquivo escolhido'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.2rem' }}>Maximum file size: 2 MB</div>
                    {(formData.gallery || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                         {(formData.gallery || []).map((img, idx) => (
                            <img key={idx} src={img} alt="galeria" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ccc' }} />
                         ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Linha 9: Video e Destaque */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#7a1b3c' }}>Vídeo do imóvel</label>
                  <input type="text" className="input" value={formData.videoUrl} onChange={e => updateForm('videoUrl', e.target.value)} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#7a1b3c' }}>Destaque*</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="radio" name="featured" checked={formData.featured === true} onChange={() => updateForm('featured', true)} /> Em destaque
                    </label>
                    <label style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="radio" name="featured" checked={formData.featured === false} onChange={() => updateForm('featured', false)} /> Sem destaque
                    </label>
                  </div>
                </div>

                {/* Cadastrar Categoria integrado no form */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#7a1b3c', marginTop: 0, marginBottom: '1rem', textTransform: 'uppercase' }}>Cadastrar Nova Categoria</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#7a1b3c' }}>Informe o Nome</label>
                      <input type="text" className="input" value={catName} onChange={e => setCatName(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: '#7a1b3c' }}>Slug da Categoria*</label>
                      <select className="input" value={catSlug} onChange={e => setCatSlug(e.target.value)}>
                        <option value="">Selecione uma Taxonomia</option>
                        <option value="banheiros">Banheiros</option>
                        <option value="suites">Suítes</option>
                        <option value="regra-pet">Regra pet</option>
                        <option value="mobilia">Mobília</option>
                        <option value="tipo-imovel">Tipo de Imóvel</option>
                        <option value="tipo-negocio">Tipo de Negócio</option>
                      </select>
                    </div>
                    <div>
                      <button className="btn" style={{ backgroundColor: '#8a2346', color: 'white', fontWeight: 600, width: '100%', border: 'none' }} onClick={() => {
                        Swal.fire({
                          icon: 'success',
                          title: 'Sucesso',
                          text: 'Categoria salva com sucesso! (Apenas demonstração estrutural)',
                          confirmButtonColor: '#8a2346'
                        });
                        setCatName('');
                        setCatSlug('');
                      }}>
                        Adicionar Categoria
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn" style={{ backgroundColor: '#8a2346', color: 'white', fontWeight: 600, padding: '0.7rem 1.5rem', border: 'none' }} onClick={saveProperty}>
                    {formData.id ? 'Salvar Alterações' : 'Cadastrar Imóvel'}
                  </button>
                </div>

              </div>
            </div>
          </div>,
        document.body
      )}
    </div>
  );
};

export default PortfolioProperties;
