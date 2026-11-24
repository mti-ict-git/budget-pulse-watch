import jwt from 'jsonwebtoken';
import { LDAPUserAccess } from '../models/LDAPUserAccess';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

export interface LdapSession {
  token: string;
  user: {
    id: number;
    username: string;
    role: LDAPUserAccess['Role'];
    email: string;
    firstName: string;
    lastName: string;
    department?: string;
    authType: 'ldap';
    createdAt: Date;
  };
}

/**
 * Session for a user on the LDAPUserAccess list, used by both the LDAP password login and
 * Microsoft 365 sign-in. The token has authType "ldap", so the auth middleware re-checks the
 * access list on every request (revoking access logs the user out).
 */
export const issueLdapSession = (access: LDAPUserAccess): LdapSession => ({
  token: jwt.sign({ username: access.Username, authType: 'ldap' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }),
  user: {
    id: access.AccessID,
    username: access.Username,
    role: access.Role,
    email: access.Email,
    firstName: access.DisplayName.split(' ')[0] || access.DisplayName,
    lastName: access.DisplayName.split(' ').slice(1).join(' ') || '',
    department: access.Department,
    authType: 'ldap',
    createdAt: access.CreatedAt,
  },
});
