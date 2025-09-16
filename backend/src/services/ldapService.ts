import { Client } from 'ldapts';

export interface LDAPUser {
  username: string;
  displayName: string;
  email: string;
  department?: string;
  title?: string;
  distinguishedName: string;
}

export interface LDAPAuthResult {
  success: boolean;
  user?: LDAPUser;
  error?: string;
}

class LDAPService {
  private client: Client;
  private bindDN: string;
  private bindPassword: string;
  private baseDN: string;

  constructor() {
    this.client = new Client({
      url: process.env.LDAP_URL || 'ldaps://10.60.10.56:636',
      timeout: parseInt(process.env.LDAP_TIMEOUT || '30000'),
      connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || '15000'),
      tlsOptions: {
        rejectUnauthorized: false
      }
    });
    
    this.bindDN = process.env.LDAP_BIND_DN || '';
    this.bindPassword = process.env.LDAP_BIND_PASSWORD || '';
    this.baseDN = process.env.LDAP_BASE_DN || 'DC=mbma,DC=com';
  }

  /**
   * Authenticate user against Active Directory
   */
  async authenticateUser(username: string, password: string): Promise<LDAPAuthResult> {
    try {
      // First, bind with service account to search for user
      await this.client.bind(this.bindDN, this.bindPassword);
      
      // Search for user by sAMAccountName (username)
      const searchOptions = {
        scope: 'sub' as const,
        filter: `(sAMAccountName=${username})`,
        attributes: [
          'sAMAccountName',
          'displayName', 
          'mail',
          'department',
          'title',
          'distinguishedName'
        ],
        sizeLimit: 10,
        timeLimit: 30
      };
      
      const searchResult = await this.client.search(this.baseDN, searchOptions);
      
      if (!searchResult.searchEntries || searchResult.searchEntries.length === 0) {
        await this.client.unbind();
        return {
          success: false,
          error: 'User not found in Active Directory'
        };
      }
      
      const userEntry = searchResult.searchEntries[0];
      const userDN = userEntry.dn;
      
      // Unbind service account
      await this.client.unbind();
      
      // Try to bind with user credentials to verify password
      const userClient = new Client({
        url: process.env.LDAP_URL || 'ldaps://10.60.10.56:636',
        timeout: parseInt(process.env.LDAP_TIMEOUT || '30000'),
        connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || '15000'),
        tlsOptions: {
          rejectUnauthorized: false
        }
      });
      
      try {
        await userClient.bind(userDN, password);
        await userClient.unbind();
        
        // Authentication successful, return user data
        const ldapUser: LDAPUser = {
          username: userEntry.sAMAccountName as string,
          displayName: userEntry.displayName as string || username,
          email: userEntry.mail as string || '',
          department: userEntry.department as string,
          title: userEntry.title as string,
          distinguishedName: userEntry.dn
        };
        
        return {
          success: true,
          user: ldapUser
        };
        
      } catch (bindError) {
        await userClient.unbind();
        return {
          success: false,
          error: 'Invalid username or password'
        };
      }
      
    } catch (error) {
      console.error('LDAP Authentication Error:', error);
      
      try {
        await this.client.unbind();
      } catch (unbindError) {
        // Ignore unbind errors
      }
      
      return {
        success: false,
        error: 'LDAP connection failed'
      };
    }
  }

  /**
   * Search for users in Active Directory
   */
  async searchUsers(searchTerm: string): Promise<LDAPUser[]> {
    try {
      await this.client.bind(this.bindDN, this.bindPassword);
      
      const searchOptions = {
        scope: 'sub' as const,
        filter: `(|(sAMAccountName=*${searchTerm}*)(displayName=*${searchTerm}*)(mail=*${searchTerm}*))`,
        attributes: [
          'sAMAccountName',
          'displayName',
          'mail',
          'department',
          'title',
          'distinguishedName'
        ],
        sizeLimit: 50,
        timeLimit: 30
      };
      
      const searchResult = await this.client.search(this.baseDN, searchOptions);
      await this.client.unbind();
      
      if (!searchResult.searchEntries) {
        return [];
      }
      
      return searchResult.searchEntries.map(entry => ({
        username: entry.sAMAccountName as string,
        displayName: entry.displayName as string || entry.sAMAccountName as string,
        email: entry.mail as string || '',
        department: entry.department as string,
        title: entry.title as string,
        distinguishedName: entry.dn
      }));
      
    } catch (error) {
      console.error('LDAP Search Error:', error);
      
      try {
        await this.client.unbind();
      } catch (unbindError) {
        // Ignore unbind errors
      }
      
      return [];
    }
  }

  /**
   * Test LDAP connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.bind(this.bindDN, this.bindPassword);
      await this.client.unbind();
      return true;
    } catch (error) {
      console.error('LDAP Connection Test Failed:', error);
      return false;
    }
  }
}

export { LDAPService };
export const ldapService = new LDAPService();
export default ldapService;