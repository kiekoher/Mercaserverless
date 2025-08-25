import { useState } from 'react';
import Link from 'next/link';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Ocurrió un error. Por favor, inténtalo de nuevo.');
    } else {
      setMessage(data.message);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5">
          Recuperar Contraseña
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}
          {message ? (
            <Alert severity="success" sx={{ width: '100%', mb: 2 }}>{message}</Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2, mb: 2 }}>
                Ingresa tu dirección de correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </Typography>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Dirección de Email"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Enviar Enlace de Recuperación'}
              </Button>
            </>
          )}
          <Grid container>
            <Grid item>
              <Link href="/login" variant="body2">
                {"¿Recordaste tu contraseña? Inicia sesión"}
              </Link>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Container>
  );
}
