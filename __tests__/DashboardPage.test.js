import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../pages/dashboard.js';
import { AuthProvider } from '../context/Auth.js';

// Mock the API endpoint
global.fetch = jest.fn();

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('../context/Auth', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' } }),
}));

// Mock Chart.js components
jest.mock('react-chartjs-2', () => ({
  Bar: ({ options }) => {
    // A more intelligent mock that renders the chart title if provided, so we can test for it
    const titleText = options?.plugins?.title?.text;
    return (
      <div>
        {titleText && <h3>{titleText}</h3>}
        <canvas />
      </div>
    );
  },
}));


describe('DashboardPage', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it('renders stats and chart after fetching data', async () => {
    const mockStats = {
      total_rutas: 15,
      total_puntos_visitados: 120,
      rutas_por_mercaderista: [
        { mercaderista: 'mercaderista-1', total_rutas: 10 },
        { mercaderista: 'mercaderista-2', total_rutas: 5 },
      ],
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    render(<DashboardPage />);

    // Check for loading state first
    expect(screen.getByText(/cargando dashboard/i)).toBeInTheDocument();

    // Wait for the data to be loaded and rendered
    await waitFor(() => {
      // Check for the main heading
      expect(screen.getByRole('heading', { name: /dashboard de analítica/i })).toBeInTheDocument();
    });

    // Check for the rendered stat cards
    expect(screen.getByText('Total de Rutas')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();

    expect(screen.getByText('Total Puntos Visitados')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();

    // Check that the chart title is there
    expect(screen.getByText(/rendimiento por mercaderista/i)).toBeInTheDocument();
  });

  it('renders an error message if the fetch fails', async () => {
    fetch.mockRejectedValueOnce(new Error('Failed to fetch stats'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/error: failed to fetch stats/i)).toBeInTheDocument();
    });
  });
});
