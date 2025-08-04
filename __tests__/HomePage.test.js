import { render, screen } from '@testing-library/react';
import HomePage from '../pages/index.js';
import { useAuth } from '../context/Auth.js';

// Mock the supabase client to prevent it from initializing
jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}));

// Mock the router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock the useAuth hook
jest.mock('../context/Auth.js');

describe('HomePage', () => {
  it('renders supervisor links for a supervisor user', () => {
    useAuth.mockReturnValue({
      user: { email: 'supervisor@test.com' },
      profile: { role: 'supervisor' },
      signOut: jest.fn(),
    });

    render(<HomePage />);

    // Check for supervisor links
    expect(screen.getByText(/gestionar puntos de venta/i)).toBeInTheDocument();
    expect(screen.getByText(/gestionar rutas/i)).toBeInTheDocument();
    expect(screen.getByText(/ver dashboard/i)).toBeInTheDocument();

    // Check that merchandiser link is not present
    expect(screen.queryByText(/ver mi ruta/i)).not.toBeInTheDocument();
  });

  it('renders merchandiser links for a merchandiser user', () => {
    useAuth.mockReturnValue({
      user: { email: 'mercaderista@test.com' },
      profile: { role: 'mercaderista' },
      signOut: jest.fn(),
    });

    render(<HomePage />);

    // Check for merchandiser link
    expect(screen.getByText(/ver mi ruta/i)).toBeInTheDocument();

    // Check that supervisor links are not present
    expect(screen.queryByText(/gestionar puntos de venta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gestionar rutas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ver dashboard/i)).not.toBeInTheDocument();
  });

  it('shows a loading spinner when profile is not yet available', () => {
    useAuth.mockReturnValue({
      user: { email: 'test@test.com' },
      profile: null, // Profile is null while loading
      signOut: jest.fn(),
    });

    render(<HomePage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
