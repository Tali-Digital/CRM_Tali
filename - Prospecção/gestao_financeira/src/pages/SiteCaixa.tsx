import { useState, useEffect } from 'react';
import { Search, MapPin, Heart, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ClientLoginModal from '../components/ClientLoginModal';
import PublicHeader from '../components/PublicHeader';
import CaixaShareModal from '../components/CaixaShareModal';
import PropertyMap from './PropertyMap';
import { initialCaixaData } from '../data/initialData';

interface Property {
  id: string;
  uf: string;
  city: string;
  neighborhood: string;
  address: string;
  price: string;
  appraisalValue: string;
  discount: string;
  description: string;
  saleType: string;
  link: string;
}

export default function SiteCaixa() {
  const [propertiesDb, setPropertiesDb] = useState<Record<string, Property[]>>({});
  const [statesList, setStatesList] = useState<string[]>(['DF', 'GO']);
  const [updateDates, setUpdateDates] = useState<Record<string, string>>({
    'DF': '23/06/2026',
    'GO': 'Aguardando atualização'
  });
  const [selectedState, setSelectedState] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'mapa' | 'lista'>('lista');
  const [shareProperty, setShareProperty] = useState<Property | null>(null);
  const [pendingFavId, setPendingFavId] = useState<string | null>(null);
  const { user, toggleFavorite } = useAuth();

  useEffect(() => {
    if (user && user.role === 'cliente' && pendingFavId) {
      if (!user.favorites?.includes(pendingFavId)) {
        toggleFavorite(pendingFavId);
      }
      setPendingFavId(null);
    }
  }, [user, pendingFavId, toggleFavorite]);

  useEffect(() => {
    fetch('/api.php?key=ruth_dias_properties')
      .then(res => res.text())
      .then(text => {
        if (!text || text.trim().startsWith('<')) throw new Error('API não rodando PHP');
        let parsed = JSON.parse(text);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        return parsed;
      })
      .catch(() => {
        const local = localStorage.getItem('ruth_dias_properties');
        if (local) {
          let parsed = JSON.parse(local);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          return parsed;
        }
        return null;
      })
      .then(data => {
        if (data && data.db && Object.keys(data.db).length > 0) {
          setPropertiesDb(data.db || {});
          if (data.states && data.states.length > 0) {
            setStatesList(data.states);
            setSelectedState(data.states[0]);
          }
          if (data.updateDates) {
            setUpdateDates(prev => ({ ...prev, ...data.updateDates }));
          }
        }
        
        // Se ainda estiver vazio, usa os dados default
        if (!data || !data.db || Object.keys(data.db).length === 0) {
          setPropertiesDb(initialCaixaData.db || {});
          setStatesList(initialCaixaData.states || ['DF', 'GO']);
          setSelectedState(initialCaixaData.states[0]);
        }
      })
      .catch(e => console.error('Falha na requisição dos Imóveis da Caixa:', e));
  }, []);

  const currentProperties = propertiesDb[selectedState] || [];
  
  const filtered = currentProperties.filter(p => {
    if (!p) return false;
    const searchLow = searchTerm.toLowerCase();
    const city = p.city ? p.city.toLowerCase() : '';
    const neighborhood = p.neighborhood ? p.neighborhood.toLowerCase() : '';
    const price = p.price ? p.price : '';
    return city.includes(searchLow) || neighborhood.includes(searchLow) || price.includes(searchTerm);
  });

  const handleFavoriteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setPendingFavId(id);
      setIsLoginModalOpen(true);
    } else {
      toggleFavorite(id);
    }
  };

  const handleShareClick = (e: React.MouseEvent, prop: Property) => {
    e.preventDefault();
    e.stopPropagation();
    setShareProperty(prop);
  };


  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', width: '100%' }}>
      {/* Header */}
      <PublicHeader />

      {/* Hero */}
      <div style={{ backgroundColor: '#005ca9', padding: '3rem 2rem', color: 'white', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 'bold', color: 'white' }}>Imóveis de Leilão da Caixa</h1>
        <p style={{ fontSize: '1.2rem', maxWidth: '800px', margin: '0 auto', opacity: 0.9, color: 'white' }}>
          Explore as melhores oportunidades de investimento em imóveis retomados pela Caixa Econômica Federal.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0 -1rem 0' }}>
        <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '8px', padding: '0.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <button 
            onClick={() => setViewMode('lista')}
            style={{ padding: '0.6rem 2rem', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: viewMode === 'lista' ? '#005ca9' : 'transparent', color: viewMode === 'lista' ? 'white' : '#64748b', transition: 'all 0.2s' }}
          >
            Lista de Imóveis
          </button>
          <button 
            onClick={() => setViewMode('mapa')}
            style={{ padding: '0.6rem 2rem', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: viewMode === 'mapa' ? '#005ca9' : 'transparent', color: viewMode === 'mapa' ? 'white' : '#64748b', transition: 'all 0.2s' }}
          >
            Mapa Interativo
          </button>
        </div>
      </div>

      {viewMode === 'mapa' ? (
        <div style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 2rem', height: '800px' }}>
          <PropertyMap />
        </div>
      ) : (
        <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* UFs */}
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', alignItems: 'center' }}>
            {statesList.map(uf => (
              <button 
                key={uf}
                onClick={() => setSelectedState(uf)}
                style={{ 
                  padding: '0.5rem 1.5rem', 
                  borderRadius: '4px', 
                  border: 'none', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  backgroundColor: selectedState === uf ? '#0f172a' : 'white',
                  color: selectedState === uf ? 'white' : '#0f172a',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                {uf}
              </button>
            ))}

            <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', paddingLeft: '1rem' }}>
              {updateDates[selectedState] ? (
                updateDates[selectedState] === 'Aguardando atualização' ? (
                  <span style={{ color: '#ef4444' }}>Aguardando atualização da lista</span>
                ) : (
                  <>Lista atualizada em: <strong>{updateDates[selectedState]}</strong></>
                )
              ) : (
                <span style={{ opacity: 0.7 }}>Data de atualização não informada</span>
              )}
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', color: '#666' }}>
            <strong>{filtered.length}</strong> imóveis encontrados em {selectedState}
          </div>
        </div>

        {/* Busca */}
        <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          <Search size={20} color="#666" style={{ marginLeft: '0.5rem' }} />
          <input 
            type="text" 
            placeholder="Buscar por cidade, bairro ou preço..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', outline: 'none', padding: '0.5rem', flex: 1, fontSize: '1rem' }}
          />
        </div>

        {/* Lista */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', overflowX: 'auto', border: '1px solid #eee' }}>
          <div className="caixa-table-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr auto', minWidth: '800px', padding: '1rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#475569', fontSize: '0.85rem' }}>
            <div>CIDADE / BAIRRO</div>
            <div>TIPO</div>
            <div>PREÇO</div>
            <div>DESCONTO</div>
            <div>MODALIDADE</div>
            <div></div>
          </div>
          
          <div className="caixa-table-body" style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.length > 0 ? filtered.map((prop, index) => (
              <div id={`caixa-row-${prop.id}`} key={index} className="caixa-table-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr auto', minWidth: '800px', padding: '1rem', borderBottom: '1px solid #f1f5f9', alignItems: 'center', fontSize: '0.9rem' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#334155' }}>{prop.city}</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem' }}>
                    <MapPin size={12} /> {prop.neighborhood}
                  </div>
                </div>
                <div style={{ color: '#475569', fontWeight: '500' }}>
                  {prop.description ? prop.description.split(',')[0] : '-'}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#f59e0b' }}>{prop.price}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textDecoration: 'line-through' }}>{prop.appraisalValue}</div>
                </div>
                <div>
                  <span style={{ backgroundColor: '#10b981', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                    {prop.discount}%
                  </span>
                </div>
                <div style={{ color: '#3b82f6', fontSize: '0.85rem' }}>
                  {prop.saleType ? (
                    <span style={{
                      backgroundColor: prop.saleType.includes('Licitação') ? '#eff6ff' : prop.saleType.includes('Venda Direta') ? '#ecfdf5' : '#f1f5f9',
                      color: prop.saleType.includes('Licitação') ? '#3b82f6' : prop.saleType.includes('Venda Direta') ? '#10b981' : '#64748b',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      display: 'inline-block'
                    }}>
                      {prop.saleType}
                    </span>
                  ) : (
                    '-'
                  )}
                </div>
                <div style={{ paddingLeft: '1rem', display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <Share2 size={20} color="#475569" style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={(e) => handleShareClick(e, prop)} />
                  <Heart size={20} color="#f59e0b" fill={user?.favorites?.includes(prop.id) ? '#f59e0b' : 'none'} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={(e) => handleFavoriteClick(e, prop.id)} />
                </div>
              </div>
            )) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                Nenhum imóvel encontrado com esses critérios.
              </div>
            )}
          </div>
        </div>
        </div>
      )}
      <ClientLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      {shareProperty && (
        <CaixaShareModal 
          property={shareProperty} 
          onClose={() => setShareProperty(null)} 
        />
      )}
    </div>
  );
}
