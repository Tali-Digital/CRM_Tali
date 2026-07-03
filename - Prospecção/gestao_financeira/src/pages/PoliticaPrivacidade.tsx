import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import { Camera, MessageCircle, Phone, Mail, Navigation } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import ClientLoginModal from '../components/ClientLoginModal';
import PublicHeader from '../components/PublicHeader';

export default function PoliticaPrivacidade() {
  useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <PublicHeader />

      {/* Conteúdo Principal */}
      <main style={{ flex: 1, padding: '4rem 2rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', padding: '3rem', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <h1 style={{ color: '#5c1b33', fontSize: '2.5rem', marginBottom: '2rem' }}>Política de Privacidade</h1>
          
          <div style={{ color: '#4b5563', lineHeight: '1.8', fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <p>
              A sua privacidade é importante para nós. É política do nosso portal respeitar a sua privacidade em relação a qualquer informação sua que possamos coletar em nosso site e outros sites que possuímos e operamos.
            </p>

            <h3 style={{ color: '#1a1e2b', marginTop: '1rem' }}>1. Coleta de Dados</h3>
            <p>
              Solicitamos informações pessoais apenas quando realmente precisamos delas para lhe fornecer um serviço, como agendar visitas a imóveis ou entrar em contato. Fazemo-lo por meios justos e legais, com o seu conhecimento e consentimento. Também informamos por que estamos coletando e como será usado.
            </p>

            <h3 style={{ color: '#1a1e2b', marginTop: '1rem' }}>2. Retenção e Segurança</h3>
            <p>
              Apenas retemos as informações coletadas pelo tempo necessário para fornecer o serviço solicitado. Quando armazenamos dados, protegemos dentro de meios comercialmente aceitáveis ​​para evitar perdas e roubos, bem como acesso, divulgação, cópia, uso ou modificação não autorizados.
            </p>

            <h3 style={{ color: '#1a1e2b', marginTop: '1rem' }}>3. Compartilhamento de Dados</h3>
            <p>
              Não compartilhamos informações de identificação pessoal publicamente ou com terceiros, exceto quando exigido por lei ou quando estritamente necessário para a realização do serviço imobiliário contratado.
            </p>

            <h3 style={{ color: '#1a1e2b', marginTop: '1rem' }}>4. Uso de Cookies</h3>
            <p>
              Nosso site pode usar "cookies" para melhorar a experiência do usuário. Você é livre para recusar a nossa solicitação de informações pessoais e cookies através das configurações do seu navegador, entendendo que talvez não possamos fornecer alguns dos serviços desejados.
            </p>

            <h3 style={{ color: '#1a1e2b', marginTop: '1rem' }}>5. Seus Direitos (LGPD)</h3>
            <p>
              De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem o direito de acessar, corrigir, portar ou apagar seus dados pessoais a qualquer momento, bastando entrar em contato conosco através dos nossos canais de atendimento.
            </p>

            <h3 style={{ color: '#1a1e2b', marginTop: '1rem' }}>Mais informações</h3>
            <p>
              Esperemos que esteja esclarecido e, como mencionado anteriormente, se houver algo que você não tem certeza se precisa ou não, geralmente é mais seguro deixar os cookies ativados, caso interaja com um dos recursos que você usa em nosso site.
            </p>
            <p>
              Esta política é efetiva a partir de Janeiro de 2024.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#5c1b33', padding: '3rem 2rem', color: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2rem' }}>

          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column' }}>
            <Link to="/site">
              <img src={logo} alt="Ruth Dias Logo" style={{ height: '60px', filter: 'brightness(0) invert(1)', marginBottom: '1rem' }} />
            </Link>
            <div style={{ width: '40px', height: '2px', backgroundColor: '#f59e0b', marginBottom: '1rem' }}></div>
            <Link to="/politica-privacidade" style={{ color: '#e5e7eb', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = 'white'} onMouseOut={(e) => e.currentTarget.style.color = '#e5e7eb'}>
              Política de Privacidade
            </Link>
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ fontSize: '1.5rem', marginBottom: '0.8rem', color: 'white', fontWeight: 'bold' }}>Menu</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '1.1rem' }}>
              <Link to="/site" style={{ color: 'white', textDecoration: 'none' }}>Imóveis</Link>
              <Link to="/site" style={{ color: 'white', textDecoration: 'none' }}>Venda</Link>
              <Link to="/site" style={{ color: 'white', textDecoration: 'none' }}>Aluguel</Link>
              <Link to="/site" style={{ color: 'white', textDecoration: 'none' }}>Apartamento</Link>
              <Link to="/site" style={{ color: 'white', textDecoration: 'none' }}>Casa</Link>
              <Link to="/site" style={{ color: 'white', textDecoration: 'none' }}>Contato</Link>
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
