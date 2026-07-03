import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { MapPin, Building2, Gavel, Home, ArrowRight, Trash2 } from 'lucide-react';

interface Property {
  id: string;
  city: string;
  neighborhood: string;
  price: string;
  title?: string;
  description?: string;
  imageUrl?: string;
}

export default function ClientDashboard() {
  const { user, toggleFavorite } = useAuth();
  const [caixaFavs, setCaixaFavs] = useState<Property[]>([]);
  const [portfolioFavs, setPortfolioFavs] = useState<Property[]>([]);
  const [activeTab, setActiveTab] = useState<'caixa' | 'portfolio'>('portfolio');

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

  useEffect(() => {
    if (!user || !user.favorites) return;

    fetch('/api.php?key=ruth_dias_properties')
      .then(res => res.text())
      .then(text => {
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
        if (data && data.db) {
          const allCaixa: Property[] = [];
          Object.values(data.db).forEach((list: any) => {
            allCaixa.push(...list);
          });
          setCaixaFavs(allCaixa.filter(p => user.favorites?.includes(p.id)));
        }
      })
      .catch(console.error);

    fetch('/api.php?key=ruth_dias_portfolio')
      .then(res => res.text())
      .then(text => {
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
      .then(data => {
        if (data && Array.isArray(data)) {
          setPortfolioFavs(data.filter(p => user.favorites?.includes(p.id)));
        }
      })
      .catch(console.error);
  }, [user]);

  if (!user) return null;

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100%', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header Dashboard */}
        <div style={{ 
          background: 'linear-gradient(135deg, #5c1b33 0%, #8a2346 100%)', 
          borderRadius: '16px', 
          padding: '3rem 2rem', 
          color: 'white', 
          marginBottom: '2rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          boxShadow: '0 10px 25px -5px rgba(92,27,51,0.4)', 
          flexWrap: 'wrap', 
          gap: '2rem' 
        }}>
          <div style={{ flex: '1 1 300px' }}>
            <h1 style={{ fontSize: '2.8rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', letterSpacing: '-0.5px', color: 'white' }}>Olá, {user.name?.split(' ')[0] || ''}! 👋</h1>
            <p style={{ fontSize: '1.15rem', opacity: 0.9, margin: 0, lineHeight: 1.5, maxWidth: '600px', color: 'white' }}>
              Aqui estão as oportunidades que você salvou. Não deixe a casa dos seus sonhos escapar!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '1rem 1.5rem', borderRadius: '12px', textAlign: 'center', minWidth: '120px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{portfolioFavs.length}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Imóveis</div>
            </div>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '1rem 1.5rem', borderRadius: '12px', textAlign: 'center', minWidth: '120px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{caixaFavs.length}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Leilões</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setActiveTab('portfolio')}
            style={{ 
              flex: '1 1 300px', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.75rem', 
              border: activeTab === 'portfolio' ? 'none' : '1px solid #cbd5e1', 
              padding: '1.25rem', 
              fontSize: '1.1rem', 
              fontWeight: 'bold', 
              borderRadius: '12px',
              backgroundColor: activeTab === 'portfolio' ? '#f97316' : '#fff', 
              color: activeTab === 'portfolio' ? 'white' : '#64748b', 
              boxShadow: activeTab === 'portfolio' ? '0 8px 20px rgba(249, 115, 22, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)',
              cursor: 'pointer', 
              transition: 'all 0.3s ease',
              outline: 'none'
            }}
          >
            <Home size={22} /> Novos e Usados (Portfólio)
          </button>
          
          <button 
            onClick={() => setActiveTab('caixa')}
            style={{ 
              flex: '1 1 300px', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.75rem', 
              border: activeTab === 'caixa' ? 'none' : '1px solid #cbd5e1', 
              padding: '1.25rem', 
              fontSize: '1.1rem', 
              fontWeight: 'bold', 
              borderRadius: '12px',
              backgroundColor: activeTab === 'caixa' ? '#005ca9' : '#fff', 
              color: activeTab === 'caixa' ? 'white' : '#64748b', 
              boxShadow: activeTab === 'caixa' ? '0 8px 20px rgba(0, 92, 169, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)',
              cursor: 'pointer', 
              transition: 'all 0.3s ease',
              outline: 'none'
            }}
          >
            <Gavel size={22} /> Imóveis de Leilão (Caixa)
          </button>
        </div>

        {/* Tab Content: Caixa */}
        {activeTab === 'caixa' && (
          <div>
            {caixaFavs.length === 0 ? (
              <div style={{ backgroundColor: 'white', padding: '4rem 2rem', textAlign: 'center', borderRadius: '12px', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                <Gavel size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.5rem', color: '#334155', marginBottom: '0.5rem' }}>Nenhum leilão favoritado</h3>
                <p style={{ marginBottom: '2rem' }}>Você ainda não salvou nenhum imóvel retomado pela Caixa.</p>
                <Link to="/site-caixa" style={{ backgroundColor: '#005ca9', color: 'white', padding: '0.8rem 1.5rem', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>Explorar Leilões <ArrowRight size={18} /></Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                {caixaFavs.map(p => (
                  <div key={p.id} style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'; }}>
                    
                    <div style={{ padding: '1.5rem', backgroundColor: '#005ca9', color: 'white', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '50%', display: 'flex', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.4)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'} onClick={(e) => { e.preventDefault(); toggleFavorite(p.id); }}>
                        <Trash2 size={18} color="white" />
                      </div>
                      <div style={{ display: 'inline-flex', padding: '0.4rem 0.8rem', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '1rem', alignItems: 'center', gap: '0.4rem', color: 'white' }}>
                        <Gavel size={14} /> LEILÃO CAIXA
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', lineHeight: 1.4, color: '#ffd91a' }}>{p.description ? p.description.split(',')[0] : 'Imóvel Retomado'}</h3>
                    </div>

                    <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        <MapPin size={16} color="#005ca9" /> {p.neighborhood}, {p.city}
                      </div>
                      
                      <div style={{ marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.2rem' }}>Valor de Avaliação</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.5px' }}>{formatPrice(p.price)}</div>
                      </div>

                      <Link to="/site-caixa" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', backgroundColor: '#f1f5f9', color: '#005ca9', textDecoration: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#e2e8f0'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}>
                        Mais Informações <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Portfolio */}
        {activeTab === 'portfolio' && (
          <div>
            {portfolioFavs.length === 0 ? (
              <div style={{ backgroundColor: 'white', padding: '4rem 2rem', textAlign: 'center', borderRadius: '12px', color: '#64748b', border: '1px dashed #cbd5e1' }}>
                <Home size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.5rem', color: '#334155', marginBottom: '0.5rem' }}>Nenhum imóvel favoritado</h3>
                <p style={{ marginBottom: '2rem' }}>Você ainda não salvou nenhum imóvel novo ou usado.</p>
                <Link to="/site" style={{ backgroundColor: '#5c1b33', color: 'white', padding: '0.8rem 1.5rem', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>Explorar Imóveis <ArrowRight size={18} /></Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                {portfolioFavs.map(p => (
                  <div key={p.id} style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.1)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'; }}>
                    <div style={{ position: 'relative', height: '220px' }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={40} color="#94a3b8" /></div>
                      )}
                      <div style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'white', borderRadius: '50%', padding: '0.5rem', display: 'flex', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'} onClick={(e) => { e.preventDefault(); toggleFavorite(p.id); }}>
                        <Trash2 size={20} color="#ef4444" />
                      </div>
                      <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', backgroundColor: '#5c1b33', color: 'white', padding: '0.4rem 1rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        PRONTO PARA MORAR
                      </div>
                    </div>
                    <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h3 style={{ margin: '0 0 1rem 0', color: '#1a1e2b', fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                        <MapPin size={16} color="#5c1b33" /> {p.neighborhood}, {p.city}
                      </div>
                      <div style={{ marginTop: 'auto', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.2rem' }}>Valor</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#5c1b33', letterSpacing: '-0.5px' }}>
                          {formatPrice(p.price)}
                        </div>
                      </div>
                      <Link to={`/imovel/${p.id}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', backgroundColor: '#5c1b33', color: 'white', textDecoration: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: 'bold', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#7a2444'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#5c1b33'}>
                        Ver Detalhes <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
