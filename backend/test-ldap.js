import { Client } from 'ldapts';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testLDAPConnection(protocol, port, useTLS = false) {
  console.log(`\n=== Testing ${protocol.toUpperCase()} Connection ===`);
  console.log(`URL: ${protocol}://10.60.10.56:${port}`);
  
  const clientOptions = {
    url: `${protocol}://10.60.10.56:${port}`,
    timeout: 30000,
    connectTimeout: 15000
  };
  
  if (useTLS) {
    clientOptions.tlsOptions = {
      rejectUnauthorized: false
    };
  }
  
  const client = new Client(clientOptions);
  
  try {
    console.log('🔄 Attempting to bind...');
    await client.bind(
      process.env.LDAP_BIND_DN || 'CN=svc_ldap,OU=Service Accounts,DC=mbma,DC=com',
      process.env.LDAP_BIND_PASSWORD || 'your_password'
    );
    console.log('✅ Bind successful!');
    
    console.log('🔍 Testing search...');
    const searchOptions = {
      scope: 'sub',
      filter: '(sAMAccountName=*widji*)',
      attributes: ['sAMAccountName', 'displayName', 'mail'],
      sizeLimit: 5,
      timeLimit: 30
    };
    
    const searchResult = await client.search(
      process.env.LDAP_BASE_DN || 'DC=mbma,DC=com',
      searchOptions
    );
    
    console.log(`✅ Search successful! Found ${searchResult.searchEntries?.length || 0} entries`);
    
    if (searchResult.searchEntries && searchResult.searchEntries.length > 0) {
      console.log('📋 Sample results:');
      searchResult.searchEntries.slice(0, 2).forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.sAMAccountName} - ${entry.displayName}`);
      });
    }
    
    await client.unbind();
    console.log('✅ Connection test PASSED');
    return true;
    
  } catch (error) {
    console.log('❌ Connection test FAILED');
    console.log(`Error: ${error.message}`);
    console.log(`Code: ${error.code || 'N/A'}`);
    console.log(`Errno: ${error.errno || 'N/A'}`);
    
    try {
      await client.unbind();
    } catch (unbindError) {
      // Ignore unbind errors
    }
    
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting LDAP/LDAPS Connection Tests');
  console.log('==========================================');
  
  const results = {
    ldap: false,
    ldaps: false
  };
  
  // Test standard LDAP
  results.ldap = await testLDAPConnection('ldap', 389, false);
  
  // Test LDAPS
  results.ldaps = await testLDAPConnection('ldaps', 636, true);
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`LDAP (port 389):  ${results.ldap ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`LDAPS (port 636): ${results.ldaps ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (results.ldap || results.ldaps) {
    console.log('\n🎉 At least one protocol is working!');
    if (results.ldaps) {
      console.log('💡 Recommendation: Use LDAPS for secure connections');
    } else if (results.ldap) {
      console.log('⚠️  Recommendation: LDAP works but consider security implications');
    }
  } else {
    console.log('\n💥 Both protocols failed. Check:');
    console.log('   - Network connectivity to 10.60.10.56');
    console.log('   - LDAP service status on target server');
    console.log('   - Firewall rules for ports 389/636');
    console.log('   - Credentials in .env file');
  }
}

runTests().catch(console.error);