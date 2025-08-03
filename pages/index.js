import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/Auth';

export default function HomePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If the user is not logged in, redirect to the login page.
    // The check is done in an effect to run on the client side after mount.
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // While the auth state is loading, or if there's no user,
  // we can show a loading message or null to prevent flashing
  // the protected content.
  if (!user) {
    return <div>Cargando...</div>;
  }

  // If the user is logged in, show the protected content.
  return (
    <div style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
        <h1 style={{ margin: 0 }}>Panel Principal</h1>
        <div>
          <span style={{ marginRight: '20px' }}>Hola, <strong>{user.email}</strong></span>
          <button onClick={signOut}>Cerrar Sesión</button>
        </div>
      </div>

      <nav style={{ margin: '20px 0' }}>
        <ul style={{ display: 'flex', gap: '20px', listStyle: 'none', padding: 0 }}>
          <li><a href="/puntos-de-venta" style={{ textDecoration: 'underline', color: 'blue' }}>Gestionar Puntos de Venta</a></li>
          <li><a href="/rutas" style={{ textDecoration: 'underline', color: 'blue' }}>Gestionar Rutas</a></li>
          <li><a href="/dashboard" style={{ textDecoration: 'underline', color: 'blue' }}>Ver Dashboard</a></li>
          <li><a href="/mi-ruta" style={{ textDecoration: 'underline', color: 'blue' }}>Ver Mi Ruta (Mercaderista)</a></li>
        </ul>
      </nav>

      <div>
        <h2>Bienvenido al Optimizador de Rutas</h2>
        <p>Usa los enlaces de navegación de arriba para empezar a gestionar la operación.</p>
      </div>
    </div>
  );
}
