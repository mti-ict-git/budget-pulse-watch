/**
 * Interactive Navigation Learning System
 * This script learns navigation paths by tracking user clicks
 */

// Navigation tracking state
let clickCounter = 1;
let navigationStarted = false;
window.navigationClicks = [];

// Visual feedback elements
let feedbackOverlay = null;
let statusDisplay = null;

// Initialize the navigation learning system
function initializeNavigationLearning() {
    console.log('🚀 Navigation Learning System Activated');
    console.log('📝 Click through the menus to reach the requisitions page');
    console.log('🎯 The system will automatically detect when you reach the target page');
    
    createVisualFeedback();
    attachClickListeners();
    startTargetPageDetection();
}

// Create visual feedback overlay
function createVisualFeedback() {
    // Create overlay
    feedbackOverlay = document.createElement('div');
    feedbackOverlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        min-width: 250px;
        border: 2px solid #fff;
    `;
    
    // Create status display
    statusDisplay = document.createElement('div');
    statusDisplay.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px;">🎯 Navigation Learning</div>
        <div id="click-count">Clicks recorded: 0</div>
        <div id="current-url">Current: ${window.location.pathname}</div>
        <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
            Click through menus to reach requisitions page
        </div>
    `;
    
    feedbackOverlay.appendChild(statusDisplay);
    document.body.appendChild(feedbackOverlay);
}

// Attach click listeners to track navigation
function attachClickListeners() {
    document.addEventListener('click', function(event) {
        // Skip if navigation hasn't started or if clicking on our overlay
        if (feedbackOverlay && feedbackOverlay.contains(event.target)) {
            return;
        }
        
        const element = event.target;
        const clickInfo = {
            step: clickCounter++,
            timestamp: new Date().toISOString(),
            element: {
                tagName: element.tagName,
                id: element.id || null,
                className: element.className || null,
                textContent: element.textContent?.trim().substring(0, 100) || null,
                href: element.href || null,
                selector: generateSelector(element)
            },
            coordinates: {
                x: event.clientX,
                y: event.clientY
            },
            url: window.location.href,
            pathname: window.location.pathname
        };
        
        window.navigationClicks.push(clickInfo);
        
        console.log(`📍 Click ${clickInfo.step}:`, clickInfo);
        updateVisualFeedback();
        
        // Save progress periodically
        if (clickCounter % 3 === 0) {
            saveNavigationProgress();
        }
    }, true); // Use capture phase to catch all clicks
}

// Generate CSS selector for element
function generateSelector(element) {
    if (element.id) {
        return `#${element.id}`;
    }
    
    let selector = element.tagName.toLowerCase();
    
    if (element.className) {
        const classes = element.className.split(' ').filter(c => c.trim());
        if (classes.length > 0) {
            selector += '.' + classes.slice(0, 2).join('.');
        }
    }
    
    // Add position if needed
    const siblings = Array.from(element.parentNode?.children || [])
        .filter(el => el.tagName === element.tagName);
    
    if (siblings.length > 1) {
        const index = siblings.indexOf(element) + 1;
        selector += `:nth-child(${index})`;
    }
    
    return selector;
}

// Update visual feedback
function updateVisualFeedback() {
    if (statusDisplay) {
        const clickCountEl = statusDisplay.querySelector('#click-count');
        const currentUrlEl = statusDisplay.querySelector('#current-url');
        
        if (clickCountEl) {
            clickCountEl.textContent = `Clicks recorded: ${clickCounter - 1}`;
        }
        
        if (currentUrlEl) {
            currentUrlEl.textContent = `Current: ${window.location.pathname}`;
        }
    }
}

// Detect when we reach the target page
function startTargetPageDetection() {
    const checkInterval = setInterval(() => {
        const hasRequisitionsContent = detectRequisitionsPage();
        
        if (hasRequisitionsContent) {
            console.log('🎉 REQUISITIONS PAGE DETECTED!');
            clearInterval(checkInterval);
            onTargetPageReached();
        }
    }, 1000);
}

// Detect if current page is the requisitions page
function detectRequisitionsPage() {
    const bodyText = document.body.innerHTML.toLowerCase();
    const urlPath = window.location.pathname.toLowerCase();
    
    // Check for requisitions-related content
    const requisitionsKeywords = [
        'approve/review requisitions',
        'immediate action',
        'requisition',
        'purchase request',
        'approval workflow',
        'pending approvals'
    ];
    
    const hasKeywords = requisitionsKeywords.some(keyword => 
        bodyText.includes(keyword.toLowerCase())
    );
    
    const hasRequisitionsUrl = urlPath.includes('requisition') || 
                              urlPath.includes('approval') ||
                              urlPath.includes('review');
    
    // Check for table headers that might indicate requisitions
    const tables = document.querySelectorAll('table');
    let hasRequisitionsTable = false;
    
    tables.forEach(table => {
        const tableText = table.innerHTML.toLowerCase();
        if (tableText.includes('requisition') || 
            tableText.includes('request') || 
            tableText.includes('approval')) {
            hasRequisitionsTable = true;
        }
    });
    
    return hasKeywords || hasRequisitionsUrl || hasRequisitionsTable;
}

// Handle reaching the target page
function onTargetPageReached() {
    // Update visual feedback
    if (feedbackOverlay) {
        feedbackOverlay.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
        statusDisplay.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">🎉 TARGET REACHED!</div>
            <div>Requisitions page found!</div>
            <div>Total clicks: ${clickCounter - 1}</div>
            <div style="margin-top: 8px; font-size: 12px;">
                Navigation path saved successfully
            </div>
        `;
    }
    
    // Save final navigation path
    saveNavigationPath();
    
    // Take screenshot
    takePageScreenshot();
    
    // Extract table data if available
    extractRequisitionsData();
    
    console.log('✅ Navigation learning complete!');
    console.log('📁 Files saved:');
    console.log('   - learned-navigation-path.json');
    console.log('   - target-requisitions-page.png');
    console.log('   - requisitions-table-data.json');
}

// Save navigation progress
function saveNavigationProgress() {
    const progressData = {
        timestamp: new Date().toISOString(),
        totalClicks: clickCounter - 1,
        currentUrl: window.location.href,
        clicks: window.navigationClicks
    };
    
    // Save to localStorage as backup
    localStorage.setItem('navigationProgress', JSON.stringify(progressData));
}

// Save complete navigation path
function saveNavigationPath() {
    const navigationData = {
        timestamp: new Date().toISOString(),
        startUrl: window.navigationClicks[0]?.url || 'Unknown',
        endUrl: window.location.href,
        totalSteps: clickCounter - 1,
        navigationPath: window.navigationClicks,
        summary: {
            description: 'Navigation path to requisitions page',
            keySteps: window.navigationClicks.map(click => ({
                step: click.step,
                action: `Click on "${click.element.textContent}"`,
                element: click.element.selector,
                url: click.pathname
            }))
        }
    };
    
    // Convert to downloadable file
    const blob = new Blob([JSON.stringify(navigationData, null, 2)], {
        type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'learned-navigation-path.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('💾 Navigation path saved to learned-navigation-path.json');
}

// Take screenshot of the target page
function takePageScreenshot() {
    // Use html2canvas if available, otherwise provide instructions
    if (typeof html2canvas !== 'undefined') {
        html2canvas(document.body).then(canvas => {
            const link = document.createElement('a');
            link.download = 'target-requisitions-page.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    } else {
        console.log('📸 To capture screenshot, install html2canvas library');
        console.log('   Or manually take screenshot of current page');
    }
}

// Extract requisitions table data
function extractRequisitionsData() {
    const tables = document.querySelectorAll('table');
    const extractedData = [];
    
    tables.forEach((table, index) => {
        const tableData = {
            tableIndex: index,
            headers: [],
            rows: []
        };
        
        // Extract headers
        const headerRows = table.querySelectorAll('thead tr, tr:first-child');
        if (headerRows.length > 0) {
            const headers = headerRows[0].querySelectorAll('th, td');
            tableData.headers = Array.from(headers).map(h => h.textContent?.trim());
        }
        
        // Extract data rows
        const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
        dataRows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            const rowData = Array.from(cells).map(cell => cell.textContent?.trim());
            if (rowData.some(cell => cell && cell.length > 0)) {
                tableData.rows.push(rowData);
            }
        });
        
        if (tableData.headers.length > 0 || tableData.rows.length > 0) {
            extractedData.push(tableData);
        }
    });
    
    if (extractedData.length > 0) {
        const blob = new Blob([JSON.stringify(extractedData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'requisitions-table-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📊 Table data extracted to requisitions-table-data.json');
    }
}

// Auto-start the system
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavigationLearning);
} else {
    initializeNavigationLearning();
}

// Expose functions globally for manual control
window.navigationLearning = {
    start: initializeNavigationLearning,
    stop: () => {
        if (feedbackOverlay) {
            feedbackOverlay.remove();
        }
        console.log('🛑 Navigation learning stopped');
    },
    getClicks: () => window.navigationClicks,
    saveProgress: saveNavigationProgress
};