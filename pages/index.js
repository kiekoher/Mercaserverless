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
      <h1>Bienvenido al Optimizador de Rutas</h1>
      <p>Has iniciado sesión como: <strong>{user.email}</strong></p>
      <p>Este es el panel principal. Desde aquí podrás gestionar las rutas.</p>
      <button onClick={signOut} style={{ marginTop: '20px', padding: '10px' }}>
        Cerrar Sesión
      </button>
    </div>
  );
}
