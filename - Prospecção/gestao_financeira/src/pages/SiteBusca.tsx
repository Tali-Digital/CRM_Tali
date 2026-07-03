import { useState, useEffect } from 'react';
import { Search, MapPin, Bed, Car, Ruler, Heart, XCircle, Share2 } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ClientLoginModal from '../components/ClientLoginModal';
import PublicHeader from '../components/PublicHeader';
import { initialPortfolioProperties } from '../data/initialData';

interface PortfolioProperty {
  id: string;
  title: string;
  type: string;
  city: string;
  neighborhood: string;
  price: string;
  description: string;
  imageUrl: string;
  gallery?: string[];
  featured?: boolean;
  rooms?: string;
  garages?: string;
  area?: string;
  petRule?: string;
  bathrooms?: string;
  suites?: string;
  furniture?: string;
}

export default function SiteBusca() {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  
  const [finalidade, setFinalidade] = useState('');
  const [tipo, setTipo] = useState('');
  const [quartos, setQuartos] = useState('');
  const [vagas, setVagas] = useState('');
  const [pets, setPets] = useState('');
  const [banheiros, setBanheiros] = useState('');
  const [suites, setSuites] = useState('');
  const [mobilia, setMobilia] = useState('');
  const [areaMin, setAreaMin] = useState('0');
  const [areaMax, setAreaMax] = useState('20000');
  const [precoMin, setPrecoMin] = useState('0');
  const [precoMax, setPrecoMax] = useState('5000000');
  const [advancedResults, setAdvancedResults] = useState<PortfolioProperty[] | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const { user, toggleFavorite } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (location.state) {
      setFinalidade(location.state.finalidade || '');
      setTipo(location.state.tipo || '');
      setQuartos(location.state.quartos || '');
      setVagas(location.state.vagas || '');
      setPets(location.state.pets || '');
      setBanheiros(location.state.banheiros || '');
      setSuites(location.state.suites || '');
      setMobilia(location.state.mobilia || '');
      setAreaMin(location.state.areaMin || '0');
      setAreaMax(location.state.areaMax || '20000');
      setPrecoMin(location.state.precoMin || '0');
      setPrecoMax(location.state.precoMax || '5000000');
    }
  }, [location.state]);

  useEffect(() => {
    const loadProps = (data: any) => {
      if (Array.isArray(data)) {
        setProperties(data.filter((p: any) => p.isActive !== false));
      }
    };

    fetch('/api.php?key=ruth_dias_portfolio')
      .then(res => res.text())
      .then(text => {
        try {
          if (!text || text.trim().startsWith('<')) throw new Error('HTML retornado');
          let parsed = JSON.parse(text);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          loadProps(parsed);
        } catch(e) { throw e; }
      })
      .catch((e) => {
        const local = localStorage.getItem('ruth_dias_portfolio');
        if (local) {
          let parsed = JSON.parse(local);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) {
            loadProps(parsed);
            return;
          }
        }
        loadProps(initialPortfolioProperties as PortfolioProperty[]);
        console.error("Falha ao carregar portfólio no buscador via BD:", e.message);
      });
  }, []);

  const handleAdvancedSearch = () => {
    const minP = parseFloat(precoMin.replace(/\D/g, '')) || 0;
    const maxP = parseFloat(precoMax.replace(/\D/g, '')) || 999999999;
    const minA = parseFloat(areaMin) || 0;
    const maxA = parseFloat(areaMax) || 999999;

    const result = properties.filter(p => {
      const pPrice = parseFloat(p.price?.replace(/\D/g, '') || '0') / 100;
      const pArea = parseFloat(p.area || '0');

      if (tipo && tipo !== 'Tipo de Imóvel' && !p.type?.includes(tipo)) return false;
      if (quartos && quartos !== 'Quartos...' && p.rooms !== quartos.charAt(0)) return false;
      if (vagas && vagas !== 'Vagas...' && p.garages !== vagas.charAt(0)) return false;
      if (pets && pets !== 'Regra para pet...' && p.petRule !== pets) return false;
      if (banheiros && banheiros !== 'Banheiros...' && p.bathrooms?.charAt(0) !== banheiros.charAt(0)) return false;
      if (suites && suites !== 'Suítes...' && p.suites?.charAt(0) !== suites.charAt(0)) return false;
      if (mobilia && mobilia !== 'Mobília...' && p.furniture !== mobilia) return false;
      
      if (pPrice < minP || pPrice > maxP) return false;
      if (pArea < minA || pArea > maxA) return false;
      
      return true;
    });

    setAdvancedResults(result);
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

  const clearFilters = () => {
    setFinalidade('');
    setTipo('');
    setQuartos('');
    setVagas('');
    setPets('');
    setBanheiros('');
    setSuites('');
    setMobilia('');
    setAreaMin('0');
    setAreaMax('20000');
    setPrecoMin('0');
    setPrecoMax('5000000');
    setAdvancedResults(properties);
  };

  useEffect(() => {
    if (properties.length > 0) {
      if (location.state) {
        handleAdvancedSearch();
      } else if (!advancedResults) {
        setAdvancedResults(properties);
      }
    }
  }, [properties, location.state]);

  const handleFavoriteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setIsLoginModalOpen(true);
    } else {
      toggleFavorite(id);
    }
  };

  const handleShare = async (e: React.MouseEvent, p: PortfolioProperty) => {
    e.preventDefault();
    e.stopPropagation();
    
    const cardNode = document.getElementById(`property-card-${p.id}`);
    if (!cardNode) {
      console.error("Card não encontrado");
      return;
    }

    try {
      // Adiciona uma classe temporária para evitar que hover effects ou cursores fiquem na imagem
      cardNode.style.transform = 'none';
      
      const blob = await htmlToImage.toBlob(cardNode, { cacheBust: true, pixelRatio: 2 });
      if (!blob) throw new Error("Erro ao gerar imagem");

      const file = new File([blob], `imovel-${p.id}.png`, { type: 'image/png' });
      const shareUrl = `${window.location.origin}/imovel/${p.id}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: p.title,
          text: `Confira este imóvel:\n${shareUrl}`,
          files: [file],
        });
      } else {
        // Fallback: Copiar a imagem para a área de transferência
        if (navigator.clipboard && navigator.clipboard.write) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ [blob.type]: blob })
            ]);
            alert(`Imagem do imóvel copiada com sucesso!\n\nEnvie para quem desejar junto com este link:\n${shareUrl}`);
          } catch(clipboardErr) {
            alert(`Link do imóvel (Imagem não suportada pelo navegador):\n${shareUrl}`);
          }
        } else {
          alert(`Link do imóvel:\n${shareUrl}`);
        }
      }
    } catch (err) {
      console.error("Erro no compartilhamento:", err);
      alert('Erro ao tentar gerar a imagem para compartilhamento.');
    }
  };

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', width: '100%' }}>
      <PublicHeader />

      <ClientLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      <div style={{ backgroundColor: '#5c1b33', padding: '2rem 2rem', color: 'white', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontWeight: 'bold', color: 'white' }}>Busca Avançada</h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.9, color: 'white' }}>Encontre o imóvel exato utilizando nossos filtros detalhados.</p>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '2rem', padding: '2rem', alignItems: 'flex-start' }}>
        <aside style={{ width: '320px', flexShrink: 0, backgroundColor: '#e5e7eb', padding: '1.5rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#5c1b33', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>Filtros</h2>
          
          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Finalidade</label>
            <select style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} value={finalidade} onChange={e => setFinalidade(e.target.value)}>
              <option>Finalidade...</option>
              <option>Venda</option>
              <option>Aluguel</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Tipo de Imóvel</label>
            <select style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} value={tipo} onChange={e => setTipo(e.target.value)}>
              <option>Tipo de Imóvel</option>
              <option>Apartamento</option>
              <option>Casa</option>
              <option>Terreno</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Quartos</label>
            <select style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} value={quartos} onChange={e => setQuartos(e.target.value)}>
              <option>Quartos...</option>
              <option>1 Quarto</option>
              <option>2 Quartos</option>
              <option>3 Quartos</option>
              <option>4+ Quartos</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Vagas</label>
            <select style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} value={vagas} onChange={e => setVagas(e.target.value)}>
              <option>Vagas...</option>
              <option>1 Vaga</option>
              <option>2 Vagas</option>
              <option>3+ Vagas</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Banheiros</label>
            <select style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} value={banheiros} onChange={e => setBanheiros(e.target.value)}>
              <option>Banheiros...</option>
              <option>1 Banheiro</option>
              <option>2 Banheiros</option>
              <option>3+ Banheiros</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Suítes</label>
            <select style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} value={suites} onChange={e => setSuites(e.target.value)}>
              <option>Suítes...</option>
              <option>1 Suíte</option>
              <option>2 Suítes</option>
              <option>3+ Suítes</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Pets</label>
            <select style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} value={pets} onChange={e => setPets(e.target.value)}>
              <option>Regra para pet...</option>
              <option>Permitido</option>
              <option>Não Permitido</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Mobília</label>
            <select style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} value={mobilia} onChange={e => setMobilia(e.target.value)}>
              <option>Mobília...</option>
              <option>Sem Mobília</option>
              <option>Semi-mobiliado</option>
              <option>Mobiliado</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Metragem (m²)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="Mínimo" value={areaMin} onChange={e => setAreaMin(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="text" placeholder="Máximo" value={areaMax} onChange={e => setAreaMax(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#334155', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Preço (R$)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="Mínimo" value={precoMin} onChange={e => setPrecoMin(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="text" placeholder="Máximo" value={precoMax} onChange={e => setPrecoMax(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>
          </div>
          
          <button onClick={handleAdvancedSearch} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#5c1b33', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <Search size={18} /> Buscar Imóveis
          </button>
          <button onClick={clearFilters} style={{ width: '100%', padding: '0.8rem', backgroundColor: 'transparent', color: '#475569', border: '1px solid #94a3b8', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
            <XCircle size={18} /> Limpar Filtros
          </button>
        </aside>

        <main style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#5c1b33', fontSize: '1.5rem', margin: 0 }}>
              {advancedResults ? `${advancedResults.length} Imóveis Encontrados` : 'Carregando...'}
            </h2>
          </div>
          
          {advancedResults && advancedResults.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#e5e7eb', borderRadius: '8px', color: '#666', border: '1px dashed #ccc' }}>
              Nenhum imóvel encontrado com os filtros atuais. <br /> Tente ajustar a busca ou limpar os filtros.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
              {advancedResults?.map(p => (
                <div id={`property-card-${p.id}`} key={p.id} style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                  <Link to={`/imovel/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ position: 'relative' }}>
                      <img src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '1rem', left: '1rem', backgroundColor: '#5c1b33', color: 'white', padding: '0.3rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {p.type}
                      </div>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                      <h3 style={{ margin: '0 0 0.8rem 0', color: '#1a1e2b', fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</h3>
                      <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', width: '100%', justifyContent: 'center' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <MapPin size={14} color="#5c1b33" /> {p.neighborhood}, {p.city}
                      </button>
                      <div style={{ display: 'flex', gap: '1rem', color: '#666', fontSize: '0.85rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Bed size={14} /> {p.rooms || '-'} Quartos</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Car size={14} /> {p.garages || '-'} Vagas</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Ruler size={14} /> {p.area || '-'} m²</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: '#5c1b33', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.5px' }}>{formatPrice(p.price)}</div>
                        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                          <Share2 size={20} color="#475569" style={{ cursor: 'pointer' }} onClick={(e) => handleShare(e, p)} />
                          <Heart size={20} color="#f59e0b" fill={user?.favorites?.includes(p.id) ? '#f59e0b' : 'none'} style={{ cursor: 'pointer' }} onClick={(e) => handleFavoriteClick(e, p.id)} />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
