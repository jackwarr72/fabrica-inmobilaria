import { Role } from '@prisma/client';

// Mock session/auth helper for pre-MVP phase
// In production, integrate NextAuth / Auth.js
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export function getCurrentUser(): SessionUser {
  // Default mock user for local testing (can be switched via headers or cookies later)
  return {
    id: 'admin-user-id',
    name: 'Admin Centinela',
    email: 'admin@centinela.local',
    role: 'ADMIN',
  };
}

export function authorizeRole(userRole: Role, allowedRoles: Role[]): boolean {
  return allowedRoles.includes(userRole);
}
