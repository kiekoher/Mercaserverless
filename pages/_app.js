import * as React from 'react';
import PropTypes from 'prop-types';
import Head from 'next/head';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import theme from '../components/theme';
import createEmotionCache from '../components/createEmotionCache';
import { AuthProvider } from '../context/Auth';
import { CsrfProvider, useCsrf } from '../context/Csrf';
import { SnackbarProvider, useSnackbar } from 'notistack';
import { useEffect } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import logger from '../lib/logger';

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

function CsrfInitializer({ children }) {
  const { setCsrfToken } = useCsrf();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    const initCsrf = async () => {
      try {
        const res = await fetch('/api/csrf');
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await res.json();
        setCsrfToken(data.csrfToken);
      } catch (err) {
        logger.error({ err }, 'Failed to fetch CSRF token');
        enqueueSnackbar('Error de seguridad. No se pueden procesar formularios. Por favor, recargue la página.', {
          variant: 'error',
          persist: true,
        });
      }
    };
    initCsrf();
  }, [setCsrfToken, enqueueSnackbar]);

  return <>{children}</>;
}

export default function MyApp(props) {
  const { Component, emotionCache = clientSideEmotionCache, pageProps } = props;

  return (
    <CacheProvider value={emotionCache}>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <ThemeProvider theme={theme}>
        <SnackbarProvider maxSnack={5} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <AuthProvider>
            <CsrfProvider>
              <ErrorBoundary>
                <CsrfInitializer>
                  <CssBaseline />
                  <Component {...pageProps} />
                </CsrfInitializer>
              </ErrorBoundary>
            </CsrfProvider>
          </AuthProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

MyApp.propTypes = {
  Component: PropTypes.elementType.isRequired,
  emotionCache: PropTypes.object,
  pageProps: PropTypes.object.isRequired,
};
