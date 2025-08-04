import { useAuth } from '../context/Auth';

// Mapa de jerarquía de roles. Un admin puede hacer todo lo de un supervisor.
const ROLES_HIERARCHY = {
  admin: ['admin', 'supervisor', 'mercaderista'],
  supervisor: ['supervisor', 'mercaderista'],
  mercaderista: ['mercaderista'],
};

export function useAuthorization() {
  const { profile } = useAuth();

  const can = (allowedRoles) => {
    if (!profile || !profile.role) {
      return false;
    }
    
    const userRoles = ROLES_HIERARCHY[profile.role] || [];
    
    // Si allowedRoles es un array, verifica si algún rol está permitido
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.some(role => userRoles.includes(role));
    }
    
    // Si es un solo string
    return userRoles.includes(allowedRoles);
  };

  return { can, role: profile?.role };
}
