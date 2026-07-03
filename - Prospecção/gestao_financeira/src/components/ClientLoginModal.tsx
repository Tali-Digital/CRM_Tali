import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';

export default function ClientLoginModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { login, register, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      let u;
      if (isLogin) {
        u = await login(email, password);
      } else {
        if (!name.trim()) throw new Error('Preencha seu nome');
        u = await register({ name, email, role: 'cliente', favorites: [] }, password);
      }
      onClose(); // Fechar ao sucesso
      
      if (u && (u.role === 'admin' || u.role === 'corretor' || u.role === 'parceiro')) {
        window.location.href = '/painel';
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '400px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>
          <X size={24} />
        </button>
        <h2 style={{ color: '#5c1b33', marginBottom: '0.5rem', textAlign: 'center' }}>
          {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
        </h2>
        <p style={{ color: '#666', textAlign: 'center', marginBottom: '2rem', fontSize: '0.9rem' }}>
          {isLogin ? 'Faça login para salvar seus imóveis favoritos.' : 'Cadastre-se para salvar os imóveis que você amou.'}
        </p>

        {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isLogin && (
            <input 
              type="text" 
              placeholder="Seu Nome Completo" 
              required 
              value={name} 
              onChange={e => setName(e.target.value)} 
              style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          )}
          <input 
            type="email" 
            placeholder="Seu melhor E-mail" 
            required 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="password" 
            placeholder="Sua Senha" 
            required 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '0.8rem', backgroundColor: '#5c1b33', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '1rem' }}>
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
          <span style={{ margin: '0 1rem', color: '#64748b', fontSize: '0.9rem' }}>OU</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
        </div>

        <button 
          type="button"
          onClick={async () => { try { await loginWithGoogle(); onClose(); window.location.href = '/painel'; } catch(e:any) { setError(e.message); } }}
          style={{ width: '100%', padding: '0.8rem', backgroundColor: '#ffffff', color: '#333', border: '1px solid #ddd', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{width: 20, height: 20}} />
          Entrar com o Google
        </button>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          {isLogin ? (
            <span>Ainda não tem conta? <button onClick={() => setIsLogin(false)} style={{ background: 'none', border: 'none', color: '#5c1b33', fontWeight: 'bold', cursor: 'pointer' }}>Cadastre-se grátis</button></span>
          ) : (
            <span>Já tem uma conta? <button onClick={() => setIsLogin(true)} style={{ background: 'none', border: 'none', color: '#5c1b33', fontWeight: 'bold', cursor: 'pointer' }}>Faça login</button></span>
          )}
        </div>
      </div>
    </div>
  );
}
