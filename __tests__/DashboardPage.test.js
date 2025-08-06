import { render, screen, waitFor } from '@testing-library/react';
import { useSnackbar } from 'notistack';
import DashboardPage from '../pages/dashboard.js';

// Mock the API endpoints
global.fetch = jest.fn();

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('../context/Auth', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com' },
    profile: { role: 'supervisor' },
  }),
}));

jest.mock('notistack', () => ({
  useSnackbar: jest.fn(),
}));

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

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    render(<DashboardPage />);

    // Use findBy queries which automatically wait for elements to appear
    expect(await screen.findByRole('heading', { name: /dashboard de operaciones/i })).toBeInTheDocument();

    // Check for the rendered stat cards
    expect(await screen.findByText('Rutas Totales')).toBeInTheDocument();
    expect(await screen.findByText('15')).toBeInTheDocument();

    expect(await screen.findByText('Puntos de Venta Visitados (Total)')).toBeInTheDocument();
    expect(await screen.findByText('120')).toBeInTheDocument();

    // Check for the AI insights section
    expect(screen.getByRole('heading', { name: /insights de la operación por ia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analizar última ruta/i })).toBeInTheDocument();
  });

  it('renders an error message if the stats fetch fails', async () => {
    // Make the mock more specific to how the component handles it
    fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Database connection error' }),
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith('No se pudieron cargar las estadísticas.', { variant: 'error' });
    });
  });
});
