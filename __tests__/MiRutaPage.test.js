import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useAuth } from '../context/Auth';
import MiRutaPage from '../pages/mi-ruta';
import { CsrfProvider } from '../context/Csrf';

global.fetch = jest.fn();

jest.mock('../context/Auth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: jest.fn(),
  }),
}));

jest.mock('../lib/fetchWithCsrf', () => ({
  useCsrfFetcher: () => fetch,
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    pathname: '/',
    query: {},
  }),
}));

describe('MiRutaPage', () => {
  beforeEach(() => {
    fetch.mockClear();
    useAuth.mockClear();
  });

  it('renders route and handles check-in', async () => {
    useAuth.mockReturnValue({
      user: { id: 'merc' },
      profile: { role: 'mercaderista' },
    });

    fetch.mockImplementation((url, opts) => {
      if (url === '/api/mi-ruta') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 1, puntos: [{ id: 101, nombre: 'Punto A', direccion: 'Dir A' }] }),
        });
      }
      if (url === '/api/visitas?ruta_id=1&page=1&pageSize=50') {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      if (url === '/api/visitas' && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.reject(new Error(`Unhandled fetch call: ${url}`));
    });

    render(
      <CsrfProvider>
        <MiRutaPage />
      </CsrfProvider>
    );

    expect(await screen.findByText('Tu Ruta para Hoy')).toBeInTheDocument();
    const checkInBtn = await screen.findByRole('button', { name: /check-in/i });
    fireEvent.click(checkInBtn);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/visitas',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('handles check-out with feedback', async () => {
    useAuth.mockReturnValue({
      user: { id: 'merc' },
      profile: { role: 'mercaderista' },
    });

    fetch.mockImplementation((url, opts) => {
      if (url === '/api/mi-ruta') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 1, puntos: [{ id: 101, nombre: 'Punto A', direccion: 'Dir A' }] }),
        });
      }
      if (url === '/api/visitas?ruta_id=1&page=1&pageSize=50') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ id: 55, punto_de_venta_id: 101, estado: 'En Progreso' }] }),
        });
      }
      if (url === '/api/visitas' && opts?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.reject(new Error(`Unhandled fetch call: ${url}`));
    });

    render(
      <CsrfProvider>
        <MiRutaPage />
      </CsrfProvider>
    );

    const checkOutBtn = await screen.findByRole('button', { name: /check-out/i });
    fireEvent.click(checkOutBtn);
    const submitBtn = await screen.findByRole('button', { name: /enviar y finalizar/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/visitas',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  it('shows error when no route is assigned', async () => {
    useAuth.mockReturnValue({
      user: { id: 'merc' },
      profile: { role: 'mercaderista' },
    });

    fetch.mockImplementation((url) => {
      if (url === '/api/mi-ruta') {
        return Promise.resolve({ status: 404, ok: false });
      }
      return Promise.reject(new Error(`Unhandled fetch call: ${url}`));
    });

    render(
      <CsrfProvider>
        <MiRutaPage />
      </CsrfProvider>
    );

    expect(
      await screen.findByText(/no tienes una ruta asignada para hoy/i)
    ).toBeInTheDocument();
  });
});
