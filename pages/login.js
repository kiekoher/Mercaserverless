import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // On successful login, you would typically redirect.
      // For this step, an alert is sufficient to confirm functionality.
      alert('Login successful! You would be redirected to the dashboard.');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: '96px auto' }}>
      <h2>Iniciar Sesión</h2>
      <p>Accede a tu panel de control.</p>
      <form onSubmit={handleLogin}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
          />
        </div>
        <div style={{ marginTop: '16px' }}>
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginTop: '4px' }}
          />
        </div>
        <div style={{ marginTop: '24px' }}>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </div>
        {error && <p style={{ color: 'red', marginTop: '16px' }}>{error}</p>}
      </form>
    </div>
  );
}
