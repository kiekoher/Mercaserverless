import { render, screen } from '@testing-library/react';
import LoginPage from '../pages/login.js';

// Mock the supabase client as it's used in the component
jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
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
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();

    // Check for the submit button
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });
});
