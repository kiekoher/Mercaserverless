import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import Link from 'next/link';
import { useAuth } from '../context/Auth';

export default function AppLayout({ children }) {
  const { profile, signOut } = useAuth();

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Link href="/" passHref style={{ color: 'inherit', textDecoration: 'none', flexGrow: 1 }}>
            <Typography variant="h6" component="div">
              Optimizador de Rutas
            </Typography>
          </Link>
          {profile && (
            <>
              {profile.role === 'admin' && (
                <Box sx={{ borderRight: '1px solid rgba(255,255,255,0.2)', mr: 2, pr: 2 }}>
                  <Link href="/dashboard" passHref style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Button color="inherit">Dashboard</Button>
                  </Link>
                  <Link href="/admin/users" passHref style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Button color="inherit">Usuarios</Button>
                  </Link>
                  <Link href="/admin/beta" passHref style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Button color="inherit">Beta</Button>
                  </Link>
                </Box>
              )}
               {profile.role === 'supervisor' && (
                <Box sx={{ borderRight: '1px solid rgba(255,255,255,0.2)', mr: 2, pr: 2 }}>
                  <Link href="/dashboard" passHref style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Button color="inherit">Dashboard</Button>
                  </Link>
                   <Link href="/rutas" passHref style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Button color="inherit">Rutas</Button>
                  </Link>
                </Box>
              )}
              <Typography sx={{ mr: 2 }}>
                Hola, <strong>{profile.full_name || profile.role}</strong>
              </Typography>
              <Button color="inherit" onClick={signOut}>Cerrar Sesión</Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
