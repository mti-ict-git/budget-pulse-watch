const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Test the import API functionality
async function testImportAPI() {
  const baseURL = 'http://localhost:3001';
  
  console.log('🧪 Testing Import API Functionality');
  console.log('=====================================');
  
  try {
    // Test 1: Health check
    console.log('\n1. Testing API Health Check...');
    const healthResponse = await fetch(`${baseURL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Test 2: Get import template
    console.log('\n2. Testing Import Template Endpoint...');
    const templateResponse = await fetch(`${baseURL}/api/import/prf/template`);
    const templateData = await templateResponse.json();
    console.log('✅ Template data:', JSON.stringify(templateData, null, 2));
    
    // Test 3: Create a test Excel file (CSV format for simplicity)
    console.log('\n3. Creating test CSV file...');
    const csvContent = `No,Budget,Date Submit,Submit By,PRF No,Sum Description Requested,Description,Purchase Cost Code,Amount,Required for,Status in Pronto
1,2024,2024-01-15,John Doe,PRF-2024-0001,IT Equipment Purchase,Laptop for development team,MTIRMRAD496001,15000000,Development Team,Pending
2,2024,2024-01-16,Jane Smith,PRF-2024-0002,Office Supplies,Printer and paper supplies,MTIRMRAD496002,5000000,Admin Office,Approved
3,2024,2024-01-17,Bob Wilson,PRF-2024-0003,Software License,Microsoft Office 365 licenses,MTIRMRAD496003,12000000,All Departments,In Progress
4,2024,2024-01-18,Alice Brown,,Network Equipment,Network equipment upgrade,INVALID_CODE,invalid_amount,IT Department,Pending
5,2025,2024-01-19,Charlie Davis,PRF-2024-0005,Security System,CCTV cameras and monitoring system,MTIRMRAD496005,25000000,Security Department,Pending`;
    
    fs.writeFileSync('test-import.csv', csvContent);
    console.log('✅ Test CSV file created');
    
    // Test 4: Validate the file
    console.log('\n4. Testing File Validation...');
    const validateForm = new FormData();
    validateForm.append('file', fs.createReadStream('test-import.csv'));
    validateForm.append('validateOnly', 'true');
    
    const validateResponse = await fetch(`${baseURL}/api/import/prf/bulk`, {
      method: 'POST',
      body: validateForm
    });
    
    const validateData = await validateResponse.json();
    console.log('✅ Validation result:', JSON.stringify(validateData, null, 2));
    
    // Test 5: Import the file
    console.log('\n5. Testing File Import...');
    const importForm = new FormData();
    importForm.append('file', fs.createReadStream('test-import.csv'));
    importForm.append('validateOnly', 'false');
    importForm.append('skipDuplicates', 'true');
    
    const importResponse = await fetch(`${baseURL}/api/import/prf/bulk`, {
      method: 'POST',
      body: importForm
    });
    
    const importData = await importResponse.json();
    console.log('✅ Import result:', JSON.stringify(importData, null, 2));
    
    // Test 6: Check import history
    console.log('\n6. Testing Import History...');
    const historyResponse = await fetch(`${baseURL}/api/import/prf/history`);
    const historyData = await historyResponse.json();
    console.log('✅ Import history:', JSON.stringify(historyData, null, 2));
    
    // Cleanup
    fs.unlinkSync('test-import.csv');
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testImportAPI();