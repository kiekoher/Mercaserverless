import { render, screen } from '@testing-library/react';
import LoginPage from '../pages/login.js';

const mockSupabase = {
  auth: {
    signInWithPassword: jest.fn(),
  },
};

// Mock the supabase client as it's used in the component
jest.mock('../lib/supabaseClient', () => ({
  getSupabaseClient: () => mockSupabase,
}));

// Mock the router as it's used for redirection (if any)
// Although not used in this component, it's good practice for pages
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('LoginPage', () => {
  it('renders the login form correctly', () => {
    render(<LoginPage />);

    // Check for the main heading
    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();

    // Check for form fields by their labels
    expect(screen.getByLabelText(/correo electr/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();

    // Check for the submit button
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('shows a friendly message on network error', async () => {
    mockSupabase.auth.signInWithPassword.mockRejectedValueOnce(new Error('Failed to fetch'));
    render(<LoginPage />);
    await screen.getByRole('button', { name: /iniciar sesión/i }).click();
    expect(await screen.findByText(/no se pudo conectar/i)).toBeInTheDocument();
  });
});
