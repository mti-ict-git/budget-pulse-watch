import { Client } from 'ldapts';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function testSearchFunction() {
  console.log('🔍 Testing LDAP Search Function');
  console.log('================================');
  
  const client = new Client({
    url: process.env.LDAP_URL || 'ldaps://10.60.10.56:636',
    timeout: parseInt(process.env.LDAP_TIMEOUT || '30000'),
    connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || '15000'),
    tlsOptions: {
      rejectUnauthorized: false
    }
  });
  
  try {
    console.log('🔄 Binding to LDAP server...');
    await client.bind(
      process.env.LDAP_BIND_DN || 'CN=svc_ldap,OU=Service Accounts,DC=mbma,DC=com',
      process.env.LDAP_BIND_PASSWORD || 'your_password'
    );
    console.log('✅ Bind successful!');
    
    // Test 1: Simple search with minimal attributes
    console.log('\n📋 Test 1: Simple search (minimal attributes)');
    const simpleSearch = {
      scope: 'sub',
      filter: '(objectClass=user)',
      attributes: ['sAMAccountName'],
      sizeLimit: 3,
      timeLimit: 10
    };
    
    try {
      const result1 = await client.search(
        process.env.LDAP_BASE_DN || 'DC=mbma,DC=com',
        simpleSearch
      );
      console.log(`✅ Simple search: Found ${result1.searchEntries?.length || 0} entries`);
    } catch (error) {
      console.log(`❌ Simple search failed: ${error.message}`);
    }
    
    // Test 2: Specific user search
    console.log('\n📋 Test 2: Specific user search');
    const userSearch = {
      scope: 'sub',
      filter: '(sAMAccountName=widji*)',
      attributes: ['sAMAccountName', 'displayName', 'mail'],
      sizeLimit: 5,
      timeLimit: 15
    };
    
    try {
      const result2 = await client.search(
        process.env.LDAP_BASE_DN || 'DC=mbma,DC=com',
        userSearch
      );
      console.log(`✅ User search: Found ${result2.searchEntries?.length || 0} entries`);
      if (result2.searchEntries && result2.searchEntries.length > 0) {
        result2.searchEntries.forEach((entry, index) => {
          console.log(`  ${index + 1}. ${entry.sAMAccountName} - ${entry.displayName}`);
        });
      }
    } catch (error) {
      console.log(`❌ User search failed: ${error.message}`);
    }
    
    // Test 3: Search with different time limits
    console.log('\n📋 Test 3: Testing different time limits');
    const timeLimits = [5, 10, 20, 30];
    
    for (const timeLimit of timeLimits) {
      console.log(`\n⏱️  Testing with ${timeLimit}s time limit...`);
      const timedSearch = {
        scope: 'sub',
        filter: '(objectClass=user)',
        attributes: ['sAMAccountName'],
        sizeLimit: 10,
        timeLimit: timeLimit
      };
      
      try {
        const startTime = Date.now();
        const result = await client.search(
          process.env.LDAP_BASE_DN || 'DC=mbma,DC=com',
          timedSearch
        );
        const duration = Date.now() - startTime;
        console.log(`✅ ${timeLimit}s limit: Found ${result.searchEntries?.length || 0} entries in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`❌ ${timeLimit}s limit failed after ${duration}ms: ${error.message}`);
      }
    }
    
    // Test 4: Test different base DNs
    console.log('\n📋 Test 4: Testing different base DNs');
    const baseDNs = [
      'DC=mbma,DC=com',
      'CN=Users,DC=mbma,DC=com',
      'OU=Users,DC=mbma,DC=com'
    ];
    
    for (const baseDN of baseDNs) {
      console.log(`\n🎯 Testing base DN: ${baseDN}`);
      const baseSearch = {
        scope: 'sub',
        filter: '(objectClass=user)',
        attributes: ['sAMAccountName'],
        sizeLimit: 3,
        timeLimit: 10
      };
      
      try {
        const result = await client.search(baseDN, baseSearch);
        console.log(`✅ Base DN ${baseDN}: Found ${result.searchEntries?.length || 0} entries`);
      } catch (error) {
        console.log(`❌ Base DN ${baseDN} failed: ${error.message}`);
      }
    }
    
    await client.unbind();
    console.log('\n🎉 Search function testing completed!');
    
  } catch (error) {
    console.log('❌ Connection failed:');
    console.log(`Error: ${error.message}`);
    console.log(`Code: ${error.code || 'N/A'}`);
    console.log(`Errno: ${error.errno || 'N/A'}`);
    
    try {
      await client.unbind();
    } catch (unbindError) {
      // Ignore unbind errors
    }
  }
}

testSearchFunction().catch(console.error);