import { render, screen, waitFor } from '@testing-library/react';
import { useSnackbar, SnackbarProvider } from 'notistack';

// Polyfill for ResizeObserver for this test file only
global.ResizeObserver = class ResizeObserver {
  observe() {
    // do nothing
  }
  unobserve() {
    // do nothing
  }
  disconnect() {
    // do nothing
  }
};
import DashboardPage from '../pages/dashboard.js';
import { AuthProvider } from '../context/Auth';
import { CsrfProvider } from '../context/Csrf';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../components/theme';

// Mock the API endpoints
global.fetch = jest.fn();

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// We will provide a mock AuthContext, but we can still mock the hook if needed for specific scenarios
jest.mock('../context/Auth', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com' },
    profile: { role: 'supervisor' },
  }),
  AuthProvider: ({ children }) => <div>{children}</div>, // Simple passthrough for the test
}));

jest.mock('notistack', () => ({
  ...jest.requireActual('notistack'), // Import actual notistack for SnackbarProvider
  useSnackbar: jest.fn(),
}));

// A custom render function that wraps components with necessary providers
const renderWithProviders = (ui, { providerProps, ...renderOptions } = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <SnackbarProvider>
        <AuthProvider>
          <CsrfProvider>
            {ui}
          </CsrfProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>,
    renderOptions
  );
};


describe('DashboardPage', () => {
  let enqueueSnackbar;

  beforeEach(() => {
    fetch.mockClear();
    enqueueSnackbar = jest.fn();
    useSnackbar.mockImplementation(() => ({ enqueueSnackbar }));
  });

  it('renders stats and AI section after fetching data', async () => {
    const mockStats = {
      total_rutas: 15,
      total_puntos_visitados: 120,
    };

    const mockProjections = {
      workload: [{ mercaderista: 'test', hours: 30 }],
      frequency: { planned: 1, required: 2, percentage: '50.0' }
    };

    fetch.mockImplementation((url) => {
      if (url === '/api/dashboard-stats') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStats),
        });
      }
      if (url === '/api/dashboard-projections') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProjections),
        });
      }
      if (url === '/api/csrf') {
         return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: 'test-token' }),
        });
      }
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });

    renderWithProviders(<DashboardPage />);

    // Wait for the heading to ensure the page is loaded
    expect(await screen.findByRole('heading', { name: /dashboard de operaciones/i })).toBeInTheDocument();

    // Check that the stats fetch was called
    expect(fetch).toHaveBeenCalledWith('/api/dashboard-stats');

    // Check for the AI insights section
    expect(screen.getByRole('heading', { name: /insights de la operación por ia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analizar última ruta/i })).toBeInTheDocument();
  });

  it('renders an error message if the stats fetch fails', async () => {
    // Mock for the stats fetch failing
    fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Database connection error' }),
    });
    // Mock for the CSRF token fetch succeeding
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ csrfToken: 'test-token' }),
    });


    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith('No se pudieron cargar las estadísticas.', { variant: 'error' });
    });
  });
});
