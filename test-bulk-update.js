// Test script to reproduce the bulk update "Invalid COA ID" error
import fetch from 'node-fetch';

async function testBulkUpdate() {
  try {
    // First, get some COA records to test with
    console.log('Fetching COA records...');
    const coaResponse = await fetch('http://localhost:3001/api/coa?page=1&limit=5');
    const coaData = await coaResponse.json();
    
    if (!coaData.success || !coaData.data || coaData.data.length === 0) {
      console.error('No COA records found');
      return;
    }
    
    console.log('Found COA records:', coaData.data.map(coa => ({ id: coa.COAID, code: coa.COACode })));
    
    // Test with valid COA IDs
    const accountIds = coaData.data.slice(0, 2).map(coa => coa.COAID);
    console.log('Testing with account IDs:', accountIds);
    
    const bulkUpdatePayload = {
      accountIds: accountIds,
      updates: {
        Department: 'IT',
        ExpenseType: 'OPEX'
      }
    };
    
    console.log('Sending bulk update request:', JSON.stringify(bulkUpdatePayload, null, 2));
    
    const response = await fetch('http://localhost:3001/api/coa/bulk-update', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bulkUpdatePayload)
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (!response.ok) {
      console.error('Bulk update failed:', result);
    } else {
      console.log('Bulk update succeeded:', result);
    }
    
  } catch (error) {
    console.error('Error testing bulk update:', error);
  }
}

testBulkUpdate();