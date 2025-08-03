import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/Auth';

export default function HomePage() {
  const { user, profile, signOut } = useAuth(); // Get profile from context
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Show a loading state while the profile is being fetched
  if (!user || !profile) {
    return <div>Cargando...</div>;
  }

  return (
    <div style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
        <h1 style={{ margin: 0 }}>Panel Principal</h1>
        <div>
          <span style={{ marginRight: '10px' }}>
            Hola, <strong>{user.email}</strong> ({profile.role})
          </span>
          <button onClick={signOut}>Cerrar Sesión</button>
        </div>
      </div>

      <nav style={{ margin: '20px 0' }}>
        <ul style={{ display: 'flex', gap: '20px', listStyle: 'none', padding: 0 }}>
          {profile.role === 'supervisor' && (
            <>
              <li><a href="/puntos-de-venta" style={{ textDecoration: 'underline', color: 'blue' }}>Gestionar Puntos de Venta</a></li>
              <li><a href="/rutas" style={{ textDecoration: 'underline', color: 'blue' }}>Gestionar Rutas</a></li>
              <li><a href="/dashboard" style={{ textDecoration: 'underline', color: 'blue' }}>Ver Dashboard</a></li>
            </>
          )}
          {profile.role === 'mercaderista' && (
            <li><a href="/mi-ruta" style={{ textDecoration: 'underline', color: 'blue' }}>Ver Mi Ruta</a></li>
          )}
        </ul>
      </nav>

      <div>
        <h2>Bienvenido al Optimizador de Rutas</h2>
        <p>Usa los enlaces de navegación de arriba para empezar a gestionar la operación.</p>
      </div>
    </div>
  );
}
