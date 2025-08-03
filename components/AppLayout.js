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
              <Typography sx={{ mr: 2 }}>
                Hola, {profile.role}
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
