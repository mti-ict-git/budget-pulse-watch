/**
 * Browser-based Navigation Learning System
 * This script runs in the browser to track user navigation
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class BrowserNavigationLearner {
    constructor() {
        this.browser = null;
        this.page = null;
        this.navigationClicks = [];
        this.clickCounter = 1;
        this.isLearning = false;
    }

    async initialize() {
        console.log('🚀 Initializing Browser Navigation Learner...');
        
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Navigate to Pronto Xi
        console.log('🌐 Navigating to Pronto Xi...');
        await this.page.goto('http://192.168.1.100:8080/prontoweb/');
        
        // Wait for page to load
        await this.page.waitForTimeout(2000);
        
        // Check if already logged in or need to login
        await this.handleLogin();
        
        // Start learning mode
        await this.startLearningMode();
    }

    async handleLogin() {
        try {
            // Check if login form exists
            const loginForm = await this.page.$('form[action*="login"]');
            
            if (loginForm) {
                console.log('🔐 Login required, performing authentication...');
                
                // Fill login form
                await this.page.type('input[name="username"]', 'lmt');
                await this.page.type('input[name="password"]', 'lmt');
                
                // Get CSRF token if needed
                const csrfToken = await this.page.$eval('input[name="_token"]', el => el.value).catch(() => null);
                
                // Submit login
                await this.page.click('input[type="submit"], button[type="submit"]');
                
                // Wait for navigation after login
                await this.page.waitForNavigation({ waitUntil: 'networkidle0' });
                
                console.log('✅ Login successful');
            } else {
                console.log('✅ Already logged in');
            }
        } catch (error) {
            console.log('⚠️ Login handling error:', error.message);
        }
    }

    async startLearningMode() {
        console.log('🎯 Starting Navigation Learning Mode');
        console.log('📝 Instructions:');
        console.log('   1. Click through the menus to reach the requisitions page');
        console.log('   2. The system will automatically track your clicks');
        console.log('   3. When you reach the target page, it will be detected automatically');
        console.log('   4. Press Ctrl+C in this terminal to stop learning');
        
        this.isLearning = true;
        
        // Inject learning script into the page
        await this.injectLearningScript();
        
        // Set up click tracking
        await this.setupClickTracking();
        
        // Start target page detection
        this.startTargetPageDetection();
        
        // Keep the process alive
        await this.keepAlive();
    }

    async injectLearningScript() {
        await this.page.evaluateOnNewDocument(() => {
            // Create visual feedback overlay
            function createLearningOverlay() {
                const overlay = document.createElement('div');
                overlay.id = 'navigation-learning-overlay';
                overlay.style.cssText = `
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
                
                overlay.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 8px;">🎯 Navigation Learning</div>
                    <div id="click-count">Clicks recorded: 0</div>
                    <div id="current-url">Current: ${window.location.pathname}</div>
                    <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
                        Click through menus to reach requisitions page
                    </div>
                `;
                
                document.body.appendChild(overlay);
                return overlay;
            }
            
            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', createLearningOverlay);
            } else {
                createLearningOverlay();
            }
        });
    }

    async setupClickTracking() {
        await this.page.evaluateOnNewDocument(() => {
            let clickCounter = 0;
            
            document.addEventListener('click', function(event) {
                const overlay = document.getElementById('navigation-learning-overlay');
                if (overlay && overlay.contains(event.target)) {
                    return; // Skip clicks on our overlay
                }
                
                clickCounter++;
                
                // Update overlay
                const clickCountEl = document.getElementById('click-count');
                const currentUrlEl = document.getElementById('current-url');
                
                if (clickCountEl) {
                    clickCountEl.textContent = `Clicks recorded: ${clickCounter}`;
                }
                
                if (currentUrlEl) {
                    currentUrlEl.textContent = `Current: ${window.location.pathname}`;
                }
                
                // Store click data
                const clickData = {
                    step: clickCounter,
                    timestamp: new Date().toISOString(),
                    element: {
                        tagName: event.target.tagName,
                        id: event.target.id || null,
                        className: event.target.className || null,
                        textContent: event.target.textContent?.trim().substring(0, 100) || null,
                        href: event.target.href || null
                    },
                    coordinates: {
                        x: event.clientX,
                        y: event.clientY
                    },
                    url: window.location.href,
                    pathname: window.location.pathname
                };
                
                // Send to parent process
                window.lastClickData = clickData;
            }, true);
        });
    }

    async startTargetPageDetection() {
        const checkInterval = setInterval(async () => {
            if (!this.isLearning) {
                clearInterval(checkInterval);
                return;
            }
            
            try {
                const isTargetPage = await this.page.evaluate(() => {
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
                });
                
                if (isTargetPage) {
                    console.log('🎉 REQUISITIONS PAGE DETECTED!');
                    await this.onTargetPageReached();
                    clearInterval(checkInterval);
                }
                
                // Collect click data
                const clickData = await this.page.evaluate(() => window.lastClickData);
                if (clickData && !this.navigationClicks.find(c => c.timestamp === clickData.timestamp)) {
                    this.navigationClicks.push(clickData);
                    console.log(`📍 Click ${clickData.step}: ${clickData.element.textContent}`);
                }
                
            } catch (error) {
                console.log('⚠️ Detection error:', error.message);
            }
        }, 1000);
    }

    async onTargetPageReached() {
        console.log('🎉 TARGET PAGE REACHED!');
        
        // Update overlay to show success
        await this.page.evaluate(() => {
            const overlay = document.getElementById('navigation-learning-overlay');
            if (overlay) {
                overlay.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
                overlay.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 8px;">🎉 TARGET REACHED!</div>
                    <div>Requisitions page found!</div>
                    <div>Navigation path saved!</div>
                    <div style="margin-top: 8px; font-size: 12px;">
                        Check the generated files
                    </div>
                `;
            }
        });
        
        // Save navigation path
        await this.saveNavigationPath();
        
        // Take screenshot
        await this.takeScreenshot();
        
        // Extract table data
        await this.extractTableData();
        
        console.log('✅ Navigation learning complete!');
        console.log('📁 Files generated:');
        console.log('   - learned-navigation-path.json');
        console.log('   - requisitions-page-screenshot.png');
        console.log('   - requisitions-table-data.json');
        
        this.isLearning = false;
    }

    async saveNavigationPath() {
        const navigationData = {
            timestamp: new Date().toISOString(),
            startUrl: this.navigationClicks[0]?.url || 'Unknown',
            endUrl: await this.page.url(),
            totalSteps: this.navigationClicks.length,
            navigationPath: this.navigationClicks,
            summary: {
                description: 'Navigation path to requisitions page',
                keySteps: this.navigationClicks.map(click => ({
                    step: click.step,
                    action: `Click on "${click.element.textContent}"`,
                    element: click.element.tagName,
                    url: click.pathname
                }))
            }
        };
        
        const filePath = path.join(__dirname, 'learned-navigation-path.json');
        await fs.writeFile(filePath, JSON.stringify(navigationData, null, 2));
        console.log('💾 Navigation path saved to learned-navigation-path.json');
    }

    async takeScreenshot() {
        const screenshotPath = path.join(__dirname, 'requisitions-page-screenshot.png');
        await this.page.screenshot({ 
            path: screenshotPath,
            fullPage: true 
        });
        console.log('📸 Screenshot saved to requisitions-page-screenshot.png');
    }

    async extractTableData() {
        const tableData = await this.page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            const extractedData = [];
            
            tables.forEach((table, index) => {
                const tableInfo = {
                    tableIndex: index,
                    headers: [],
                    rows: []
                };
                
                // Extract headers
                const headerRows = table.querySelectorAll('thead tr, tr:first-child');
                if (headerRows.length > 0) {
                    const headers = headerRows[0].querySelectorAll('th, td');
                    tableInfo.headers = Array.from(headers).map(h => h.textContent?.trim());
                }
                
                // Extract data rows
                const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
                dataRows.forEach(row => {
                    const cells = row.querySelectorAll('td, th');
                    const rowData = Array.from(cells).map(cell => cell.textContent?.trim());
                    if (rowData.some(cell => cell && cell.length > 0)) {
                        tableInfo.rows.push(rowData);
                    }
                });
                
                if (tableInfo.headers.length > 0 || tableInfo.rows.length > 0) {
                    extractedData.push(tableInfo);
                }
            });
            
            return extractedData;
        });
        
        if (tableData.length > 0) {
            const filePath = path.join(__dirname, 'requisitions-table-data.json');
            await fs.writeFile(filePath, JSON.stringify(tableData, null, 2));
            console.log('📊 Table data saved to requisitions-table-data.json');
        }
    }

    async keepAlive() {
        return new Promise((resolve) => {
            process.on('SIGINT', async () => {
                console.log('\n🛑 Stopping navigation learning...');
                this.isLearning = false;
                if (this.browser) {
                    await this.browser.close();
                }
                resolve();
                process.exit(0);
            });
        });
    }
}

// Start the learning system
async function main() {
    const learner = new BrowserNavigationLearner();
    try {
        await learner.initialize();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();