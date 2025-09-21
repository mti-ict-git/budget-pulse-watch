const axios = require('axios');

async function testUpdatedEndpoint() {
  try {
    console.log('Testing updated cost code budget endpoint...\n');
    
    // Test the updated endpoint
    const response = await axios.get('http://localhost:3001/api/budgets/cost-codes', {
      params: {
        search: 'AMPLME05.6250'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Number of results:', response.data.length);
    console.log('\nResults:');
    
    response.data.forEach((item, index) => {
      console.log(`${index + 1}. Cost Code: ${item.PurchaseCostCode}`);
      console.log(`   COA Code: ${item.COACode}`);
      console.log(`   COA Name: ${item.COAName}`);
      console.log(`   Department: ${item.Department}`);
      console.log(`   Total Allocated: ${item.GrandTotalAllocated}`);
      console.log(`   Budget Status: ${item.BudgetStatus}`);
      console.log('');
    });
    
    // Check if we have the NO_COST_CODE entry
    const noCostCodeEntry = response.data.find(item => 
      item.PurchaseCostCode && item.PurchaseCostCode.startsWith('NO_COST_CODE_')
    );
    
    if (noCostCodeEntry) {
      console.log('✅ Found budget without cost code mapping:');
      console.log('   Cost Code:', noCostCodeEntry.PurchaseCostCode);
      console.log('   COA Code:', noCostCodeEntry.COACode);
      console.log('   Total Allocated:', noCostCodeEntry.GrandTotalAllocated);
    } else {
      console.log('❌ No budget without cost code mapping found');
    }
    
  } catch (error) {
    console.error('Error testing endpoint:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testUpdatedEndpoint();