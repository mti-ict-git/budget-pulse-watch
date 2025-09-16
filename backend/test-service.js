import dotenv from 'dotenv';
import { Client } from 'ldapts';
dotenv.config({ path: './.env' });

// Simulate the LDAPService class with our fixes
class TestLDAPService {
  constructor() {
    this.client = new Client({
      url: process.env.LDAP_URL || 'ldaps://10.60.10.56:636',
      timeout: parseInt(process.env.LDAP_TIMEOUT || '30000'),
      connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || '15000'),
      tlsOptions: {
        rejectUnauthorized: false
      }
    });
    
    this.bindDN = process.env.LDAP_BIND_DN || 'CN=svc_ldap,OU=Service Accounts,DC=mbma,DC=com';
    this.bindPassword = process.env.LDAP_BIND_PASSWORD || 'your_password';
    this.baseDN = process.env.LDAP_BASE_DN || 'DC=mbma,DC=com';
  }

  async searchUsers(searchTerm) {
    try {
      await this.client.bind(this.bindDN, this.bindPassword);
      
      const searchOptions = {
        scope: 'sub',
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
      
      console.log('🔍 Searching with options:', {
        filter: searchOptions.filter,
        sizeLimit: searchOptions.sizeLimit,
        timeLimit: searchOptions.timeLimit
      });
      
      const searchResult = await this.client.search(this.baseDN, searchOptions);
      await this.client.unbind();
      
      if (!searchResult.searchEntries) {
        return [];
      }
      
      return searchResult.searchEntries.map(entry => ({
        username: entry.sAMAccountName,
        displayName: entry.displayName || entry.sAMAccountName,
        email: entry.mail || '',
        department: entry.department,
        title: entry.title,
        distinguishedName: entry.dn
      }));
      
    } catch (error) {
      console.error('❌ LDAP Search Error:', error.message);
      console.error('Error details:', {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall
      });
      
      try {
        await this.client.unbind();
      } catch (unbindError) {
        // Ignore unbind errors
      }
      
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.client.bind(this.bindDN, this.bindPassword);
      await this.client.unbind();
      return { success: true, message: 'LDAP connection successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

async function testLDAPService() {
  console.log('🧪 Testing LDAP Service with Timeout Fixes');
  console.log('============================================');
  
  const service = new TestLDAPService();
  
  // Test 1: Connection test
  console.log('\n📡 Test 1: Connection Test');
  try {
    const connectionResult = await service.testConnection();
    if (connectionResult.success) {
      console.log('✅ Connection test passed:', connectionResult.message);
    } else {
      console.log('❌ Connection test failed:', connectionResult.error);
      return;
    }
  } catch (error) {
    console.log('❌ Connection test error:', error.message);
    return;
  }
  
  // Test 2: User search
  console.log('\n🔍 Test 2: User Search');
  try {
    const users = await service.searchUsers('widji');
    console.log(`✅ Search successful: Found ${users.length} users`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} - ${user.displayName}`);
    });
  } catch (error) {
    console.log('❌ Search failed:', error.message);
  }
  
  // Test 3: Broader search
  console.log('\n🔍 Test 3: Broader Search (first 5 users)');
  try {
    const users = await service.searchUsers('*');
    console.log(`✅ Broad search successful: Found ${users.length} users`);
    users.slice(0, 5).forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} - ${user.displayName}`);
    });
  } catch (error) {
    console.log('❌ Broad search failed:', error.message);
  }
  
  console.log('\n🎉 LDAP Service testing completed!');
}

testLDAPService().catch(console.error);