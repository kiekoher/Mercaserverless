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

describe('UsersPage', () => {
  beforeEach(() => {
    fetch.mockClear();
    useAuth.mockClear();
  });

  it('renders the user management page for an admin', async () => {
    // Mock the useAuth hook to return an admin user
    useAuth.mockReturnValue({
      user: { id: 'admin-user' },
      profile: { role: 'admin' },
    });

    // Mock the API response for fetching users
    const mockUsers = [
      { id: 'user-1', full_name: 'John Doe', role: 'mercaderista' },
      { id: 'user-2', full_name: 'Jane Smith', role: 'supervisor' },
    ];
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockUsers, totalCount: 2 }),
    });

    render(
      <CsrfProvider>
        <UsersPage />
      </CsrfProvider>
    );

    // Check that the main heading is rendered
    expect(screen.getByRole('heading', { name: /administración de usuarios/i })).toBeInTheDocument();

    // Wait for the users to be fetched and rendered
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/users?page=1&search=');
    });

    // Check if the mock users are displayed in the table
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(await screen.findByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows a permission denied message for non-admin users', () => {
    // Mock the useAuth hook to return a non-admin user
    useAuth.mockReturnValue({
      user: { id: 'mercaderista-user' },
      profile: { role: 'mercaderista' },
    });

    render(
      <CsrfProvider>
        <UsersPage />
      </CsrfProvider>
    );

    // Check that the permission denied alert is shown
    expect(screen.getByRole('alert')).toHaveTextContent(/no tienes permiso para acceder a esta página/i);
    expect(screen.queryByRole('heading', { name: /administración de usuarios/i })).not.toBeInTheDocument();
  });
});
