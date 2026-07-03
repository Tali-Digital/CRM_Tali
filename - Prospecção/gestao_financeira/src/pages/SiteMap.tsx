import { Link } from 'react-router-dom';
import { Home, Search, Building2, ArrowRight } from 'lucide-react';

export default function SiteMap() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#5c1b33', fontSize: '2rem', marginBottom: '0.5rem' }}>Mapa do Site Público</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Abaixo estão listadas as páginas públicas do seu site. Clique em qualquer card para ser redirecionado para a respectiva página.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
        
        {/* Raiz */}
        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '2px solid #5c1b33', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', width: '350px', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={{ backgroundColor: '#5c1b33', color: 'white', padding: '1rem', borderRadius: '50%' }}>
              <Home size={28} />
            </div>
          </div>
          <h2 style={{ fontSize: '1.3rem', color: '#5c1b33', marginBottom: '0.5rem' }}>Página Inicial</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            A porta de entrada do seu site, contendo a busca inteligente, destaques e formulário de contato.
          </p>
          <Link to="/site" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f59e0b', color: 'white', padding: '0.6rem 1.5rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>
            Acessar <ArrowRight size={16} />
          </Link>
          
          {/* Linha conectora descendo */}
          <div style={{ position: 'absolute', bottom: '-2rem', left: '50%', transform: 'translateX(-50%)', width: '2px', height: '2rem', backgroundColor: '#cbd5e1' }}></div>
        </div>

        {/* Galhos */}
        <div style={{ display: 'flex', gap: '4rem', position: 'relative', marginTop: '1rem' }}>
          {/* Linha conectora horizontal */}
          <div style={{ position: 'absolute', top: '-1rem', left: '20%', right: '20%', height: '2px', backgroundColor: '#cbd5e1' }}></div>
          
          {/* Filha 1 */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '300px', textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-1rem', left: '50%', transform: 'translateX(-50%)', width: '2px', height: '1rem', backgroundColor: '#cbd5e1' }}></div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#f59e0b', color: 'white', padding: '0.8rem', borderRadius: '50%' }}>
                <Search size={24} />
              </div>
            </div>
            <h2 style={{ fontSize: '1.2rem', color: '#334155', marginBottom: '0.5rem' }}>Busca Avançada</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Página exclusiva com o filtro detalhado para agilizar a pesquisa do cliente.
            </p>
            <Link to="/site-busca" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #f59e0b', color: '#f59e0b', padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}>
              Acessar Página <ArrowRight size={14} />
            </Link>
          </div>

          {/* Filha 2 */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '300px', textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-1rem', left: '50%', transform: 'translateX(-50%)', width: '2px', height: '1rem', backgroundColor: '#cbd5e1' }}></div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <div style={{ backgroundColor: '#10b981', color: 'white', padding: '0.8rem', borderRadius: '50%' }}>
                <Building2 size={24} />
              </div>
            </div>
            <h2 style={{ fontSize: '1.2rem', color: '#334155', marginBottom: '0.5rem' }}>Leilões da Caixa</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Página exclusiva com a listagem de imóveis de leilão, otimizada para o cliente final.
            </p>
            <Link to="/site-caixa" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #10b981', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}>
              Acessar Página <ArrowRight size={14} />
            </Link>
          </div>
          
        </div>

      </div>
    </div>
  );
}
