import { useState } from 'react';
import PublicHeader from '../components/PublicHeader';
import { Mail, MapPin, Phone } from 'lucide-react';
import logo from '../assets/logo.png';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function SiteContato() {
  const [contatoNome, setContatoNome] = useState('');
  const [contatoEmail, setContatoEmail] = useState('');
  const [contatoTelefone, setContatoTelefone] = useState('');
  const [contatoMensagem, setContatoMensagem] = useState('');

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
      value = `${value.slice(0, 9)}-${value.slice(9)}`;
    }
    setContatoTelefone(value);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />

      <main style={{ flex: 1 }}>
        {/* Banner */}
        <div style={{ backgroundColor: '#5c1b33', color: 'white', padding: '4rem 2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#FFC350' }}>Fale Conosco</h1>
          <p style={{ fontSize: '1.2rem', opacity: 0.9, color: '#fff', maxWidth: '600px', margin: '0 auto' }}>
            Estamos prontos para te ajudar a encontrar o imóvel dos seus sonhos ou fechar o melhor negócio.
          </p>
        </div>

        {/* Informações e Formulário */}
        <div style={{ maxWidth: '1200px', margin: '-3rem auto 4rem', padding: '0 2rem', display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>

          {/* Card de Informações */}
          <div style={{ flex: '1 1 400px', backgroundColor: 'white', borderRadius: '12px', padding: '3rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', zIndex: 10 }}>
            <h2 style={{ fontSize: '1.8rem', color: '#1a1e2b', marginBottom: '2rem' }}>Informações de Contato</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ backgroundColor: '#fff3cd', padding: '1rem', borderRadius: '50%', color: '#f59e0b' }}>
                  <Phone size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#4b5563', marginBottom: '0.5rem' }}>Telefone / WhatsApp</h3>
                  <p style={{ fontSize: '1.2rem', color: '#1a1e2b', fontWeight: 'bold' }}>(61) 99695-2795</p>
                  <a href="https://wa.me/5561996952795" target="_blank" rel="noreferrer" style={{ color: '#005ca9', textDecoration: 'none', fontSize: '0.9rem', marginTop: '0.5rem', display: 'inline-block' }}>Enviar mensagem no WhatsApp</a>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ backgroundColor: '#fff3cd', padding: '1rem', borderRadius: '50%', color: '#f59e0b' }}>
                  <Mail size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#4b5563', marginBottom: '0.5rem' }}>E-mail</h3>
                  <p style={{ fontSize: '1.1rem', color: '#1a1e2b', fontWeight: 'bold' }}>ruth.dias@gmail.com</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ backgroundColor: '#fff3cd', padding: '1rem', borderRadius: '50%', color: '#f59e0b' }}>
                  <MapPin size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#4b5563', marginBottom: '0.5rem' }}>Localização</h3>
                  <p style={{ fontSize: '1.1rem', color: '#1a1e2b', lineHeight: '1.5' }}>Avenida Monumental<br />Brasília - DF</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulário */}
          <div style={{ flex: '2 1 500px', backgroundColor: 'white', borderRadius: '12px', padding: '3rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', zIndex: 10 }}>
            <h2 style={{ fontSize: '1.8rem', color: '#1a1e2b', marginBottom: '1rem' }}>Envie uma Mensagem</h2>
            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>Preencha o formulário abaixo e retornaremos o mais breve possível.</p>

            <form onSubmit={handleContatoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Seu Nome</label>
                <input
                  type="text"
                  value={contatoNome}
                  onChange={(e) => setContatoNome(e.target.value)}
                  style={{ width: '100%', padding: '1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>E-mail</label>
                  <input
                    type="email"
                    value={contatoEmail}
                    onChange={(e) => setContatoEmail(e.target.value)}
                    style={{ width: '100%', padding: '1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Telefone</label>
                  <input
                    type="tel"
                    value={contatoTelefone}
                    onChange={handlePhoneChange}
                    style={{ width: '100%', padding: '1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem' }}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151' }}>Mensagem</label>
                <textarea
                  rows={5}
                  value={contatoMensagem}
                  onChange={(e) => setContatoMensagem(e.target.value)}
                  style={{ width: '100%', padding: '1rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '1rem', resize: 'vertical' }}
                  placeholder="Como podemos te ajudar?"
                  required
                ></textarea>
              </div>
              <button type="submit" style={{ backgroundColor: '#5c1b33', color: 'white', border: 'none', padding: '1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', transition: 'background-color 0.2s', marginTop: '1rem' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#4a1529'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#5c1b33'}>
                Enviar Mensagem
              </button>
            </form>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#5c1b33', padding: '3rem 2rem', color: 'white', marginTop: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2rem' }}>

          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column' }}>
            <Link to="/site">
              <img src={logo} alt="Ruth Dias Logo" style={{ height: '60px', filter: 'brightness(0) invert(1)', marginBottom: '1rem', alignSelf: 'flex-start' }} />
            </Link>
            <div style={{ width: '40px', height: '2px', backgroundColor: '#f59e0b', marginBottom: '1rem' }}></div>
            <Link to="/politica-privacidade" style={{ color: '#e5e7eb', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s', width: 'fit-content' }} onMouseOver={(e) => e.currentTarget.style.color = 'white'} onMouseOut={(e) => e.currentTarget.style.color = '#e5e7eb'}>
              Política de Privacidade
            </Link>
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ fontSize: '1.5rem', marginBottom: '0.8rem', color: 'white', fontWeight: 'bold' }}>Menu</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '1.1rem' }}>
              <Link to="/site-busca" style={{ color: 'white', textDecoration: 'none' }}>Imóveis</Link>
              <Link to="/site-busca" state={{ finalidade: 'Venda' }} style={{ color: 'white', textDecoration: 'none' }}>Venda</Link>
              <Link to="/site-busca" state={{ finalidade: 'Aluguel' }} style={{ color: 'white', textDecoration: 'none' }}>Aluguel</Link>
              <Link to="/contato" style={{ color: 'white', textDecoration: 'none' }}>Contato</Link>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '250px' }}>
            <h4 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'white', fontWeight: 'bold' }}>Contatos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '1rem', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Phone size={20} color="#f59e0b" /> (61) 99695-2795
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Mail size={20} color="#f59e0b" /> ruth.dias@gmail.com
              </div>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}
