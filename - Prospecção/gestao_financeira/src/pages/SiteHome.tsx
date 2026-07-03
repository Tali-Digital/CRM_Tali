import { useState, useEffect } from 'react';
import { Search, MapPin, Bed, Car, Ruler, ChevronLeft, ChevronRight, Heart, Share2, Camera, MessageCircle, Phone, Mail, Navigation } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as htmlToImage from 'html-to-image';
import ClientLoginModal from '../components/ClientLoginModal';
import PublicHeader from '../components/PublicHeader';
import Swal from 'sweetalert2';
import logo from '../assets/logo.png';
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
}

export default function SiteHome() {
  const [properties, setProperties] = useState<PortfolioProperty[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentFeatured, setCurrentFeatured] = useState(0);

  const [showAdvanced, setShowAdvanced] = useState(false);
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [contatoNome, setContatoNome] = useState('');
  const [contatoEmail, setContatoEmail] = useState('');
  const [contatoTelefone, setContatoTelefone] = useState('');
  const [contatoMensagem, setContatoMensagem] = useState('');
  const { user, toggleFavorite } = useAuth();

  useEffect(() => {
    fetch('/api.php?key=ruth_dias_portfolio')
      .then(res => res.text())
      .then(text => {
        try {
          if (!text || text.trim().startsWith('<')) throw new Error('HTML retornado (API não configurada localmente)');
          let parsed = JSON.parse(text);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) {
            setProperties(parsed.filter((p: any) => p.isActive !== false));
            return;
          }
        } catch (e) {
          throw e; // Passa para o bloco catch
        }
      })
      .catch((e) => {
        const local = localStorage.getItem('ruth_dias_portfolio');
        if (local) {
          let parsed = JSON.parse(local);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) {
            setProperties(parsed.filter((p: any) => p.isActive !== false));
            return;
          }
        }
        setProperties(initialPortfolioProperties as PortfolioProperty[]);
        console.error("Falha ao carregar imóveis do portfólio via BD.", e.message);
      });
  }, []);

  const featuredProperties = properties.filter(p => p.featured);

  useEffect(() => {
    if (featuredProperties.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentFeatured(prev => (prev + 1) % featuredProperties.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [featuredProperties.length]);

  const searchResults = searchTerm.length > 0
    ? properties.filter(p =>
      (p.city && p.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.neighborhood && p.neighborhood.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.title && p.title.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 5)
    : [];

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

  const navigate = useNavigate();

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

  const handleAdvancedSearch = () => {
    navigate('/site-busca', {
      state: { finalidade, tipo, quartos, vagas, pets, banheiros, suites, mobilia, areaMin, areaMax, precoMin, precoMax }
    });
  };

  const handleContatoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contatoNome || !contatoTelefone || !contatoMensagem) {
      Swal.fire('Atenção', 'Por favor, preencha pelo menos Nome, Telefone e Mensagem.', 'warning');
      return;
    }
    
    const newMessage = {
      id: 'msg_' + Date.now().toString(36),
      propertyId: 'contato_site',
      brokerId: 'admin',
      name: contatoNome,
      email: contatoEmail,
      phone: contatoTelefone,
      message: contatoMensagem,
      date: new Date().toISOString()
    };

    fetch('/api.php?key=ruth_dias_messages')
      .then(res => res.text())
      .then(text => {
         let parsed = JSON.parse(text);
         if (typeof parsed === 'string') parsed = JSON.parse(parsed);
         const messages = Array.isArray(parsed) ? parsed : [];
         messages.push(newMessage);
         
         return fetch('/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'ruth_dias_messages', value: JSON.stringify(messages), send_email: true, email_data: newMessage })
         });
      })
      .catch(() => {
         const local = localStorage.getItem('ruth_dias_messages');
         let messages = [];
         if (local) {
           let parsed = JSON.parse(local);
           if (typeof parsed === 'string') parsed = JSON.parse(parsed);
           messages = Array.isArray(parsed) ? parsed : [];
         }
         messages.push(newMessage);
         localStorage.setItem('ruth_dias_messages', JSON.stringify(messages));
      })
      .finally(() => {
        Swal.fire({
          title: 'Mensagem Enviada!',
          text: 'Sua mensagem foi enviada com sucesso. Em breve entraremos em contato.',
          icon: 'success',
          confirmButtonColor: '#5c1b33'
        });
        setContatoNome('');
        setContatoEmail('');
        setContatoTelefone('');
        setContatoMensagem('');
      });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 9) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }
    
    setContatoTelefone(value);
  };

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', width: '100%' }}>
      {/* Top Header */}
      <PublicHeader />

      {/* Hero Section */}
      <section className="hero-section" style={{ backgroundColor: '#f3f4f6', display: 'flex', padding: '4rem 2rem', maxWidth: '1200px', margin: '0 auto', alignItems: 'center', gap: '2rem' }}>
        <div style={{ flex: 1 }}>
          <img src="/Foto-Principal-Ruth.webp" alt="Prédio Moderno" fetchPriority="high" width="800" height="906" style={{ width: '100%', height: 'auto', borderRadius: '8px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="hero-title" style={{ color: '#5c1b33', lineHeight: 1.1, marginBottom: '1rem', fontWeight: 800 }}>
            O imóvel ideal para viver ou investir!
          </h1>
          <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '2rem' }}>
            <b>Muito além da compra: </b>aqui você descobre o lar certo, pelo preço certo, no lugar certo. Seja no DF ou por meio de leilão nacional.
          </p>

          <div className="hero-stats" style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#5c1b33', fontSize: '1.5rem', fontWeight: 'bold' }}>+1.000</div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>Imóveis vendidos</div>
            </div>
            <div>
              <div style={{ color: '#5c1b33', fontSize: '1.5rem', fontWeight: 'bold' }}>+1.000</div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>Clientes</div>
            </div>
            <div>
              <div style={{ color: '#5c1b33', fontSize: '1.5rem', fontWeight: 'bold' }}>+500</div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>Imóveis</div>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', backgroundColor: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc' }}>
              <input
                type="text"
                placeholder="Busque por bairro ou cidade..."
                style={{ flex: 1, border: 'none', outline: 'none', padding: '0.5rem' }}
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(e.target.value.length > 0);
                }}
                onFocus={() => setIsDropdownOpen(searchTerm.length > 0)}
              />
            </div>
            {isDropdownOpen && searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', marginTop: '0.5rem', zIndex: 10, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #eee', color: '#666', fontSize: '0.85rem' }}>
                  {searchResults.length} Resultados
                </div>
                {searchResults.map(p => (
                  <div key={p.id} style={{ display: 'flex', padding: '1rem', borderBottom: '1px solid #eee', gap: '1rem', cursor: 'pointer' }} onClick={() => setIsDropdownOpen(false)}>
                    <img src={p.imageUrl} alt={p.title} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                    <div>
                      <h4 style={{ margin: 0, color: '#5c1b33' }}>{p.title} - {p.neighborhood}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                        {p.description ? p.description.substring(0, 60) + '...' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', marginTop: '1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <Search size={18} /> Busca Avançada
            </button>
          </div>
        </div>
      </section>

      {/* Advanced Search Panel */}
      {showAdvanced && (
        <div style={{ backgroundColor: '#f3f4f6', padding: '0 2rem 4rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', backgroundColor: '#d1d5db', padding: '2rem', borderRadius: '8px', position: 'relative', zIndex: 10, marginTop: '-2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Finalidade</label>
                <select style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: 'none' }} value={finalidade} onChange={e => setFinalidade(e.target.value)}>
                  <option>Finalidade...</option>
                  <option>Venda</option>
                  <option>Aluguel</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Tipo de Imóvel</label>
                <select style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: 'none' }} value={tipo} onChange={e => setTipo(e.target.value)}>
                  <option>Tipo de Imóvel</option>
                  <option>Apartamento</option>
                  <option>Casa</option>
                  <option>Terreno</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Quartos</label>
                <select style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: 'none' }} value={quartos} onChange={e => setQuartos(e.target.value)}>
                  <option>Quartos...</option>
                  <option>1 Quarto</option>
                  <option>2 Quartos</option>
                  <option>3 Quartos</option>
                  <option>4+ Quartos</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Vagas</label>
                <select style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: 'none' }} value={vagas} onChange={e => setVagas(e.target.value)}>
                  <option>Vagas...</option>
                  <option>1 Vaga</option>
                  <option>2 Vagas</option>
                  <option>3+ Vagas</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Pets</label>
                <select style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: 'none' }} value={pets} onChange={e => setPets(e.target.value)}>
                  <option>Regra para pet...</option>
                  <option>Permitido</option>
                  <option>Não Permitido</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Banheiros</label>
                <select style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: 'none' }} value={banheiros} onChange={e => setBanheiros(e.target.value)}>
                  <option>Banheiros...</option>
                  <option>1 Banheiro</option>
                  <option>2 Banheiros</option>
                  <option>3+ Banheiros</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Suítes</label>
                <select style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: 'none' }} value={suites} onChange={e => setSuites(e.target.value)}>
                  <option>Suítes...</option>
                  <option>1 Suíte</option>
                  <option>2 Suítes</option>
                  <option>3+ Suítes</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Mobília</label>
                <select style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: 'none' }} value={mobilia} onChange={e => setMobilia(e.target.value)}>
                  <option>Mobília...</option>
                  <option>Sem Mobília</option>
                  <option>Semi-mobiliado</option>
                  <option>Mobiliado</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Metragem</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flex: 1, backgroundColor: 'white', borderRadius: '4px', overflow: 'hidden' }}>
                    <span style={{ backgroundColor: '#e5e7eb', padding: '0.8rem', color: '#666' }}>M²</span>
                    <input type="text" value={areaMin} onChange={e => setAreaMin(e.target.value)} style={{ width: '100%', border: 'none', padding: '0.8rem', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flex: 1, backgroundColor: 'white', borderRadius: '4px', overflow: 'hidden' }}>
                    <span style={{ backgroundColor: '#e5e7eb', padding: '0.8rem', color: '#666' }}>M²</span>
                    <input type="text" value={areaMax} onChange={e => setAreaMax(e.target.value)} style={{ width: '100%', border: 'none', padding: '0.8rem', outline: 'none' }} />
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', color: '#5c1b33', fontWeight: 'bold', marginBottom: '0.5rem' }}>Preço</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flex: 1, backgroundColor: 'white', borderRadius: '4px', overflow: 'hidden' }}>
                    <span style={{ backgroundColor: '#e5e7eb', padding: '0.8rem', color: '#666' }}>R$</span>
                    <input type="text" value={precoMin} onChange={e => setPrecoMin(e.target.value)} style={{ width: '100%', border: 'none', padding: '0.8rem', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flex: 1, backgroundColor: 'white', borderRadius: '4px', overflow: 'hidden' }}>
                    <span style={{ backgroundColor: '#e5e7eb', padding: '0.8rem', color: '#666' }}>R$</span>
                    <input type="text" value={precoMax} onChange={e => setPrecoMax(e.target.value)} style={{ width: '100%', border: 'none', padding: '0.8rem', outline: 'none' }} />
                  </div>
                </div>
              </div>
            </div>

            <button onClick={handleAdvancedSearch} style={{ width: '100%', padding: '1rem', backgroundColor: '#5c1b33', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
              <Search size={20} /> Buscar Imóveis
            </button>
          </div>
        </div>
      )}

      {/* Destaques Section (Carrossel) */}
      {featuredProperties.length > 0 && (
        <section style={{ backgroundColor: '#e5e7eb', padding: '4rem 2rem' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 className="destaque-title" style={{ color: '#5c1b33', marginBottom: '0.5rem', fontWeight: 800 }}>Oportunidades que se destacam</h2>
              <p style={{ color: '#666', fontSize: '1.3rem', marginBottom: '2rem' }}>Imóveis selecionados com sofisticação, alto potencial de valorização e localização estratégica.</p>
            </div>

            <div style={{ position: 'relative', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', height: '450px' }}>

              {/* Trilha do Carrossel */}
              <div style={{ display: 'flex', height: '100%', transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)', transform: `translateX(-${currentFeatured * 100}%)` }}>
                {featuredProperties.map((p) => (
                  <div key={p.id} style={{ minWidth: '100%', height: '100%' }}>
                    <Link to={`/imovel/${p.id}`} className="carousel-card" style={{ display: 'flex', flexDirection: 'row', height: '100%', textDecoration: 'none', color: 'inherit' }}>
                      {/* Imagem Grande Esquerda */}
                      <div style={{ flex: '0 0 60%', position: 'relative', height: '100%' }}>
                        <img src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', backgroundColor: '#5c1b33', color: 'white', padding: '0.4rem 1rem', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {p.type}
                        </div>
                      </div>

                      {/* Info Direita */}
                      <div style={{ flex: '1', padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#1a1e2b', fontSize: '1.8rem', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.5px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.title}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontSize: '1rem', marginBottom: '1.5rem' }}>
                          <MapPin size={18} color="#5c1b33" /> {p.neighborhood}, {p.city}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', color: '#666', fontSize: '0.95rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                          {p.rooms && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f3f4f6', padding: '0.4rem 0.8rem', borderRadius: '4px' }}><Bed size={16} /> {p.rooms} Quartos</span>}
                          {p.garages && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f3f4f6', padding: '0.4rem 0.8rem', borderRadius: '4px' }}><Car size={16} /> {p.garages} Vagas</span>}
                          {p.area && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f3f4f6', padding: '0.4rem 0.8rem', borderRadius: '4px' }}><Ruler size={16} /> {p.area} m²</span>}
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
                          <div style={{ color: '#5c1b33', fontWeight: 900, fontSize: '2.2rem', letterSpacing: '-1px' }}>{formatPrice(p.price)}</div>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Share2 size={24} color="#475569" style={{ cursor: 'pointer' }} onClick={(e) => handleShare(e, p)} />
                            <Heart size={24} color="#f59e0b" fill={user?.favorites?.includes(p.id) ? '#f59e0b' : 'none'} style={{ cursor: 'pointer' }} onClick={(e) => handleFavoriteClick(e, p.id)} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>

              {/* Controles do Carrossel */}
              {featuredProperties.length > 1 && (
                <>
                  <button onClick={() => setCurrentFeatured(prev => (prev === 0 ? featuredProperties.length - 1 : prev - 1))} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                    <ChevronLeft size={24} color="#5c1b33" />
                  </button>
                  <button onClick={() => setCurrentFeatured(prev => (prev + 1) % featuredProperties.length)} style={{ position: 'absolute', top: '50%', left: 'calc(60% - 2.5rem)', transform: 'translateY(-50%)', backgroundColor: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                    <ChevronRight size={24} color="#5c1b33" />
                  </button>

                  <div style={{ position: 'absolute', bottom: '1rem', left: '30%', transform: 'translateX(-50%)', display: 'flex', gap: '0.5rem' }}>
                    {featuredProperties.map((_, idx) => (
                      <div key={idx} style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: currentFeatured === idx ? '#f59e0b' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'background-color 0.3s' }} onClick={() => setCurrentFeatured(idx)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Caixa Banner Section */}
      <section style={{ backgroundColor: '#005ca9', padding: '4rem 2rem', color: 'white', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 'bold', color: 'white' }}>Imóveis de Leilão da Caixa</h2>
          <p style={{ fontSize: '1.2rem', marginBottom: '2rem', opacity: 0.9, color: 'white' }}>
            Aproveite oportunidades únicas de investimento com imóveis retomados pela Caixa Econômica Federal. Preços abaixo do valor de mercado!
          </p>
          <Link to="/site-caixa" style={{ display: 'inline-block', backgroundColor: '#f59e0b', color: 'white', padding: '1rem 2rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', textDecoration: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            Saiba Mais
          </Link>
        </div>
      </section>

      {/* Todas Oportunidades Section */}
      <section style={{ padding: '4rem 2rem', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: '#5c1b33', fontSize: '2.5rem', marginBottom: '0.5rem' }}>Navegue por todas as oportunidades disponíveis</h2>
          <p style={{ color: '#666', fontSize: '1.3rem', marginBottom: '2rem' }}>Encontre imóveis residenciais, rurais e comerciais. Ideais para viver, investir ou transformar.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem', textAlign: 'left' }}>
            {properties.map(p => (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      <MapPin size={14} color="#5c1b33" /> {p.neighborhood}, {p.city}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', color: '#666', fontSize: '0.85rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Bed size={14} /> {p.rooms || '-'} Quartos</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Car size={14} /> {p.garages || '-'} Vagas</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Ruler size={14} /> {p.area || '-'} m²</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#5c1b33', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.5px' }}>{formatPrice(p.price)}</div>
                      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                        <Share2 size={18} color="#475569" style={{ cursor: 'pointer' }} onClick={(e) => handleShare(e, p)} />
                        <Heart size={18} color="#f59e0b" fill={user?.favorites?.includes(p.id) ? '#f59e0b' : 'none'} style={{ cursor: 'pointer' }} onClick={(e) => handleFavoriteClick(e, p.id)} />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contato Section */}
      <section style={{ backgroundColor: 'white', padding: '4rem 2rem' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: '#5c1b33', fontSize: '2rem', marginBottom: '1rem' }}>Fale Conosco</h2>
          <form onSubmit={handleContatoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <input type="text" placeholder="Seu Nome" value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} required style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc', outline: 'none' }} />
            <input type="email" placeholder="Seu E-mail" value={contatoEmail} onChange={(e) => setContatoEmail(e.target.value)} required style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc', outline: 'none' }} />
            <input type="tel" placeholder="Seu Telefone (Ex: 61 99999-9999)" value={contatoTelefone} onChange={handlePhoneChange} maxLength={15} required style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc', outline: 'none' }} />
            <textarea placeholder="Mensagem" rows={5} value={contatoMensagem} onChange={(e) => setContatoMensagem(e.target.value)} required style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc', outline: 'none' }}></textarea>
            <button type="submit" style={{ padding: '0.8rem', backgroundColor: '#5c1b33', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Enviar Mensagem</button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: '#5c1b33', padding: '3rem 2rem', color: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2rem' }}>

          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column' }}>
            <Link to="/site">
              <img src={logo} alt="Ruth Dias Logo" width="168" height="60" loading="lazy" style={{ height: '60px', width: 'auto', filter: 'brightness(0) invert(1)', marginBottom: '1rem' }} />
            </Link>
            <div style={{ width: '40px', height: '2px', backgroundColor: '#f59e0b', marginBottom: '1rem' }}></div>
            <Link to="/politica-privacidade" style={{ color: '#e5e7eb', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = 'white'} onMouseOut={(e) => e.currentTarget.style.color = '#e5e7eb'}>
              Política de Privacidade
            </Link>
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ fontSize: '1.5rem', marginBottom: '0.8rem', color: 'white', fontWeight: 'bold' }}>Menu</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '1.1rem' }}>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Imóveis</a>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Venda</a>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Aluguel</a>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Apartamento</a>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Casa</a>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Contato</a>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '250px' }}>
            <h4 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'white', fontWeight: 'bold' }}>Contatos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '1rem', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Phone size={20} color="#f59e0b" /> (61) 99695-21795
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Mail size={20} color="#f59e0b" /> ruth.dias@gmail.com
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Navigation size={20} color="#f59e0b" /> Avenida Monumental - Brasília
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'white', fontWeight: 'bold' }}>Social</h4>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '1.5rem' }}>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}><Camera size={24} /></a>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}><MessageCircle size={24} /></a>
            </div>
          </div>

        </div>

        <div style={{ maxWidth: '1200px', margin: '2rem auto 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', opacity: 0.9 }}>
          <div>
            © RUTH DIAS IMÓVEIS 2025<br />
            TODOS OS DIREITOS RESERVADOS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Feito por</span>
            <img src="/Tali-Logo-Arroba-Deitado-branco.svg" alt="Tali Agência Digital" style={{ height: '24px' }} />
          </div>
        </div>
      </footer>
      <ClientLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
