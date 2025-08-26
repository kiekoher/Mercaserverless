import { createContext, useContext, useState } from 'react';

const CsrfContext = createContext(null);

export function CsrfProvider({ children }) {
  // Initialize state from a global variable if it exists (for Cypress tests)
  const [csrfToken, setCsrfToken] = useState(() => {
    if (typeof window !== 'undefined' && window.__CSRF_TOKEN__) {
      return window.__CSRF_TOKEN__;
    }
    return null;
  });

  return (
    <CsrfContext.Provider value={{ csrfToken, setCsrfToken }}>
      {children}
    </CsrfContext.Provider>
  );
}

export function useCsrf() {
  const context = useContext(CsrfContext);
  if (!context) {
    throw new Error('useCsrf must be used within a CsrfProvider');
  }
  return context;
}
