import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '../context/Auth';
import UsersPage from '../pages/admin/users.js';
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

// Mock useAuthorization instead of useAuth for role-based checks
jest.mock('../hooks/useAuthorization', () => ({
  useAuthorization: jest.fn(),
}));
import { useAuthorization } from '../hooks/useAuthorization';

describe('UsersPage', () => {
  beforeEach(() => {
    fetch.mockClear();
    useAuthorization.mockClear();
    useAuth.mockClear(); // Clear useAuth mock as well
  });

  it('renders the user management page for an admin', async () => {
    useAuthorization.mockReturnValue({
      user: { id: 'admin-user' },
      role: 'admin',
      can: true,
    });
    useAuth.mockReturnValue({
      user: { id: 'admin-user' },
      profile: { role: 'admin', full_name: 'Admin User' },
      signOut: jest.fn(),
    });

    const mockUsers = [
      { id: 'user-1', full_name: 'John Doe', role: 'mercaderista' },
      { id: 'user-2', full_name: 'Jane Smith', role: 'supervisor' },
    ];
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockUsers, totalCount: 2 }),
    });

    render(<CsrfProvider><UsersPage /></CsrfProvider>);

    // Use the new heading text
    expect(screen.getByRole('heading', { name: /gestión de usuarios/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/users?page=1&search=&pageSize=20');
    });

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(await screen.findByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders the user management page for a supervisor', async () => {
    useAuthorization.mockReturnValue({
      user: { id: 'supervisor-user' },
      role: 'supervisor',
      can: true,
    });
    useAuth.mockReturnValue({
      user: { id: 'supervisor-user' },
      profile: { role: 'supervisor', full_name: 'Supervisor User' },
      signOut: jest.fn(),
    });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], totalCount: 0 }) });
    render(<CsrfProvider><UsersPage /></CsrfProvider>);
    expect(screen.getByRole('heading', { name: /gestión de usuarios/i })).toBeInTheDocument();
  });

  it('shows a permission denied message for mercaderista', () => {
    useAuthorization.mockReturnValue({
      user: { id: 'mercaderista-user' },
      role: 'mercaderista',
      can: false,
    });
    useAuth.mockReturnValue({
      user: { id: 'mercaderista-user' },
      profile: { role: 'mercaderista', full_name: 'Mercaderista User' },
      signOut: jest.fn(),
    });

    render(<CsrfProvider><UsersPage /></CsrfProvider>);

    expect(screen.getByRole('alert')).toHaveTextContent(/no tienes permiso para ver esta página/i);
    expect(screen.queryByRole('heading', { name: /gestión de usuarios/i })).not.toBeInTheDocument();
  });
});
