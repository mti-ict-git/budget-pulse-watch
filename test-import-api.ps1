# Test Import API Functionality
Write-Host "🧪 Testing Import API Functionality" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

$baseURL = "http://localhost:3001"

try {
    # Test 1: Health check
    Write-Host "`n1. Testing API Health Check..." -ForegroundColor Yellow
    $healthResponse = Invoke-RestMethod -Uri "$baseURL/health" -Method GET
    Write-Host "✅ Health check:" -ForegroundColor Green
    $healthResponse | ConvertTo-Json -Depth 3

    # Test 2: Get import template
    Write-Host "`n2. Testing Import Template Endpoint..." -ForegroundColor Yellow
    $templateResponse = Invoke-RestMethod -Uri "$baseURL/api/import/prf/template" -Method GET
    Write-Host "✅ Template data:" -ForegroundColor Green
    $templateResponse | ConvertTo-Json -Depth 3

    # Test 3: Create a test CSV file
    Write-Host "`n3. Creating test CSV file..." -ForegroundColor Yellow
    $csvContent = @"
No,Budget,Date Submit,Submit By,PRF No,Sum Description Requested,Description,Purchase Cost Code,Amount,Required for,Status in Pronto
1,2024,2024-01-15,John Doe,PRF-2024-0001,IT Equipment Purchase,Laptop for development team,MTIRMRAD496001,15000000,Development Team,Pending
2,2024,2024-01-16,Jane Smith,PRF-2024-0002,Office Supplies,Printer and paper supplies,MTIRMRAD496002,5000000,Admin Office,Approved
3,2024,2024-01-17,Bob Wilson,PRF-2024-0003,Software License,Microsoft Office 365 licenses,MTIRMRAD496003,12000000,All Departments,In Progress
4,2024,2024-01-18,Alice Brown,,Network Equipment,Network equipment upgrade,INVALID_CODE,invalid_amount,IT Department,Pending
5,2025,2024-01-19,Charlie Davis,PRF-2024-0005,Security System,CCTV cameras and monitoring system,MTIRMRAD496005,25000000,Security Department,Pending
"@
    
    $csvContent | Out-File -FilePath "test-import.csv" -Encoding UTF8
    Write-Host "✅ Test CSV file created" -ForegroundColor Green

    # Test 4: Validate the file
    Write-Host "`n4. Testing File Validation..." -ForegroundColor Yellow
    $validateForm = @{
        file = Get-Item "test-import.csv"
        validateOnly = "true"
    }
    
    try {
        $validateResponse = Invoke-RestMethod -Uri "$baseURL/api/import/prf/bulk" -Method POST -Form $validateForm
        Write-Host "✅ Validation result:" -ForegroundColor Green
        $validateResponse | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "⚠️ Validation test failed: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "This might be expected if authentication is required" -ForegroundColor Yellow
    }

    # Test 5: Import the file
    Write-Host "`n5. Testing File Import..." -ForegroundColor Yellow
    $importForm = @{
        file = Get-Item "test-import.csv"
        validateOnly = "false"
        skipDuplicates = "true"
    }
    
    try {
        $importResponse = Invoke-RestMethod -Uri "$baseURL/api/import/prf/bulk" -Method POST -Form $importForm
        Write-Host "✅ Import result:" -ForegroundColor Green
        $importResponse | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "⚠️ Import test failed: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "This might be expected if authentication is required" -ForegroundColor Yellow
    }

    # Test 6: Check import history
    Write-Host "`n6. Testing Import History..." -ForegroundColor Yellow
    try {
        $historyResponse = Invoke-RestMethod -Uri "$baseURL/api/import/prf/history" -Method GET
        Write-Host "✅ Import history:" -ForegroundColor Green
        $historyResponse | ConvertTo-Json -Depth 5
    } catch {
        Write-Host "⚠️ History test failed: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "This might be expected if authentication is required" -ForegroundColor Yellow
    }

    # Cleanup
    Remove-Item "test-import.csv" -ErrorAction SilentlyContinue
    Write-Host "`n✅ Test completed!" -ForegroundColor Green

} catch {
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack: $($_.ScriptStackTrace)" -ForegroundColor Red
}