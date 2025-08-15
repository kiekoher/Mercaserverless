import { render, screen } from '@testing-library/react';
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

// Avoid debounce delays in tests
jest.mock('../hooks/useDebounce', () => ({
  useDebounce: (value) => value,
}));

describe('RutasPage', () => {
  beforeEach(() => {
    fetch.mockClear();
    useAuth.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('renders the route management page for a supervisor', async () => {
    useAuth.mockReturnValue({
      user: { id: 'supervisor-user' },
      profile: { role: 'supervisor' },
    });

    const mockRutas = [
      { id: 1, fecha: '2023-10-27', mercaderista_id: 'merc-1', puntos_de_venta_ids: [101, 102] },
    ];
    const mockPuntos = [
      { id: 101, nombre: 'Punto A', direccion: 'Calle 1', ciudad: 'Bogota' },
      { id: 102, nombre: 'Punto B', direccion: 'Calle 2', ciudad: 'Bogota' },
    ];

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
        return Promise.resolve({ ok: false });
      }
      return Promise.reject(new Error(`Unhandled fetch call: ${url}`));
    });

    render(
      <CsrfProvider>
        <RutasPage />
      </CsrfProvider>
    );

    expect(await screen.findByRole('heading', { name: /gestión y seguimiento de rutas/i })).toBeInTheDocument();
    expect(await screen.findByText('merc-1')).toBeInTheDocument();
  });

  it('shows a permission denied message for a mercaderista', async () => {
    useAuth.mockReturnValue({
      user: { id: 'mercaderista-user' },
      profile: { role: 'mercaderista' },
    });

    render(
      <CsrfProvider>
        <RutasPage />
      </CsrfProvider>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/no tienes permiso para ver esta página/i);
  });
});
