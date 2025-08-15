import { render, screen, waitFor, act } from '@testing-library/react';
import { useAuth } from '../context/Auth';
import RutasPage from '../pages/rutas.js';
import { CsrfProvider } from '../context/Csrf';

// Mock the fetch API
global.fetch = jest.fn();

// Mock the dependencies
jest.mock('../context/Auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: jest.fn(),
  }),
}));

// Mock the Map component since it's loaded dynamically and requires a browser environment
jest.mock('../components/RutaMap', () => () => <div data-testid="mock-map"></div>);

describe.skip('RutasPage', () => {
  beforeEach(() => {
    fetch.mockClear();
    useAuth.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the route management page for a supervisor', async () => {
    // Mock the useAuth hook to return a supervisor user
    useAuth.mockReturnValue({
      user: { id: 'supervisor-user' },
      profile: { role: 'supervisor' },
    });

    // Mock the API response for fetching routes
    const mockRutas = [
      { id: 1, fecha: '2023-10-27', mercaderista_id: 'merc-1', puntos_de_venta_ids: [101, 102] },
    ];
    // Mock the API response for fetching points of sale
    const mockPuntos = [
      { id: 101, nombre: 'Punto A', direccion: 'Calle 1', ciudad: 'Bogota' },
      { id: 102, nombre: 'Punto B', direccion: 'Calle 2', ciudad: 'Bogota' },
    ];
    // Mock the API response for fetching visits (can be empty for this test)
    const mockVisitas = [];

    // Set up fetch mocks for each API call
    fetch.mockImplementation((url) => {
      if (url.startsWith('/api/rutas')) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'X-Total-Count': '1' }),
          json: async () => mockRutas,
        });
      }
      if (url.startsWith('/api/puntos-de-venta')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPuntos,
        });
      }
      if (url.startsWith('/api/visitas')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockVisitas,
        });
      }
      return Promise.reject(new Error(`Unhandled fetch call: ${url}`));
    });

    await act(async () => {
      render(
        <CsrfProvider>
          <RutasPage />
        </CsrfProvider>
      );
    });
    // Flush debounced effects
    await act(async () => {
      jest.runAllTimers();
    });

    // Check that the main heading is rendered
    expect(screen.getByRole('heading', { name: /gestión y seguimiento de rutas/i })).toBeInTheDocument();

    // Wait for the routes to be fetched and rendered
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/rutas?page=1&search=');
      expect(fetch).toHaveBeenCalledWith('/api/puntos-de-venta?search=');
    });

    // Check if the mock route is displayed in the table
    // The mercaderista ID is used in the table
    expect(await screen.findByText('merc-1')).toBeInTheDocument();
  });

  it('shows a permission denied message for a mercaderista', () => {
    // Mock the useAuth hook to return a non-privileged user
    useAuth.mockReturnValue({
      user: { id: 'mercaderista-user' },
      profile: { role: 'mercaderista' },
    });

    render(
      <CsrfProvider>
        <RutasPage />
      </CsrfProvider>
    );
    act(() => {
      jest.runAllTimers();
    });

    // Check that the permission denied alert is shown
    expect(screen.getByRole('alert')).toHaveTextContent(/no tienes permiso para ver esta página/i);
  });
});
