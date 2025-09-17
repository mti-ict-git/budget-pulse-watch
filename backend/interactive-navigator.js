/**
 * Interactive Browser Learning Navigator
 * 
 * This system observes user interactions with web pages, learns patterns,
 * and creates automated navigation strategies based on user behavior.
 * 
 * Features:
 * - Records user clicks, form inputs, and navigation patterns
 * - Analyzes DOM elements and their characteristics
 * - Creates reusable automation scripts based on learned patterns
 * - Provides intelligent suggestions for element selection
 * - Handles dynamic content and changing page structures
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');

puppeteer.use(StealthPlugin());

class BrowserLearningSystem {
    constructor() {
        this.browser = null;
        this.page = null;
        this.learningData = {
            interactions: [],
            patterns: [],
            selectors: {},
            workflows: []
        };
        this.isLearning = false;
        this.currentWorkflow = null;
    }

    /**
     * Initialize the browser with learning capabilities
     */
    async initialize() {
        console.log('🚀 Initializing Browser Learning System...');
        
        this.browser = await puppeteer.launch({
            headless: false,
            devtools: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Set viewport
        await this.page.setViewport({ width: 1366, height: 768 });
        
        // Load existing learning data
        await this.loadLearningData();
        
        // Setup learning listeners
        await this.setupLearningListeners();
        
        console.log('✅ Browser Learning System initialized');
        return this.page;
    }

    /**
     * Setup event listeners to learn from user interactions
     */
    async setupLearningListeners() {
        // Inject learning script into the page
        await this.page.evaluateOnNewDocument(() => {
            window.learningData = {
                interactions: [],
                currentWorkflow: null
            };

            // Track clicks
            document.addEventListener('click', (event) => {
                if (window.isLearning) {
                    const element = event.target;
                    const interaction = {
                        type: 'click',
                        timestamp: Date.now(),
                        element: {
                            tagName: element.tagName,
                            id: element.id,
                            className: element.className,
                            textContent: element.textContent?.trim().substring(0, 100),
                            attributes: Array.from(element.attributes).reduce((acc, attr) => {
                                acc[attr.name] = attr.value;
                                return acc;
                            }, {}),
                            xpath: window.getXPath(element),
                            cssSelector: window.getCSSSelector(element)
                        },
                        context: {
                            url: window.location.href,
                            title: document.title,
                            viewport: {
                                width: window.innerWidth,
                                height: window.innerHeight
                            }
                        }
                    };
                    
                    window.learningData.interactions.push(interaction);
                    console.log('📝 Recorded click interaction:', interaction);
                }
            });

            // Track form inputs
            document.addEventListener('input', (event) => {
                if (window.isLearning) {
                    const element = event.target;
                    const interaction = {
                        type: 'input',
                        timestamp: Date.now(),
                        element: {
                            tagName: element.tagName,
                            id: element.id,
                            className: element.className,
                            name: element.name,
                            type: element.type,
                            value: element.value?.substring(0, 50), // Limit for privacy
                            xpath: window.getXPath(element),
                            cssSelector: window.getCSSSelector(element)
                        },
                        context: {
                            url: window.location.href,
                            title: document.title
                        }
                    };
                    
                    window.learningData.interactions.push(interaction);
                    console.log('📝 Recorded input interaction:', interaction);
                }
            });

            // Utility function to get XPath
            window.getXPath = (element) => {
                if (element.id) {
                    return `//*[@id="${element.id}"]`;
                }
                
                const parts = [];
                while (element && element.nodeType === Node.ELEMENT_NODE) {
                    let nbOfPreviousSiblings = 0;
                    let hasNextSiblings = false;
                    let sibling = element.previousSibling;
                    
                    while (sibling) {
                        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
                            nbOfPreviousSiblings++;
                        }
                        sibling = sibling.previousSibling;
                    }
                    
                    sibling = element.nextSibling;
                    while (sibling) {
                        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === element.nodeName) {
                            hasNextSiblings = true;
                            break;
                        }
                        sibling = sibling.nextSibling;
                    }
                    
                    const prefix = element.nodeName.toLowerCase();
                    const nth = nbOfPreviousSiblings || hasNextSiblings ? `[${nbOfPreviousSiblings + 1}]` : '';
                    parts.push(prefix + nth);
                    element = element.parentNode;
                }
                
                return parts.length ? '/' + parts.reverse().join('/') : '';
            };

            // Utility function to get CSS selector
            window.getCSSSelector = (element) => {
                if (element.id) {
                    return `#${element.id}`;
                }
                
                const path = [];
                while (element && element.nodeType === Node.ELEMENT_NODE) {
                    let selector = element.nodeName.toLowerCase();
                    
                    if (element.className) {
                        selector += '.' + element.className.split(' ').join('.');
                    }
                    
                    path.unshift(selector);
                    element = element.parentNode;
                }
                
                return path.join(' > ');
            };
        });
    }

    /**
     * Start learning mode
     */
    async startLearning(workflowName = 'default') {
        console.log(`🎓 Starting learning mode for workflow: ${workflowName}`);
        this.isLearning = true;
        this.currentWorkflow = {
            name: workflowName,
            startTime: Date.now(),
            interactions: []
        };

        await this.page.evaluate(() => {
            window.isLearning = true;
            window.learningData.currentWorkflow = arguments[0];
        }, this.currentWorkflow);

        // Add visual indicator
        await this.page.evaluate(() => {
            const indicator = document.createElement('div');
            indicator.id = 'learning-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #ff4444;
                color: white;
                padding: 10px;
                border-radius: 5px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            indicator.textContent = '🎓 LEARNING MODE ACTIVE';
            document.body.appendChild(indicator);
        });
    }

    /**
     * Stop learning mode and analyze patterns
     */
    async stopLearning() {
        console.log('🛑 Stopping learning mode...');
        this.isLearning = false;

        // Get interactions from the page
        const pageInteractions = await this.page.evaluate(() => {
            return window.learningData.interactions;
        });

        if (this.currentWorkflow) {
            this.currentWorkflow.interactions = pageInteractions;
            this.currentWorkflow.endTime = Date.now();
            this.currentWorkflow.duration = this.currentWorkflow.endTime - this.currentWorkflow.startTime;
            
            this.learningData.workflows.push(this.currentWorkflow);
        }

        // Remove visual indicator
        await this.page.evaluate(() => {
            window.isLearning = false;
            const indicator = document.getElementById('learning-indicator');
            if (indicator) {
                indicator.remove();
            }
        });

        // Analyze patterns
        await this.analyzePatterns();
        
        // Save learning data
        await this.saveLearningData();
        
        console.log('✅ Learning session completed and analyzed');
        return this.currentWorkflow;
    }

    /**
     * Analyze interaction patterns to create automation strategies
     */
    async analyzePatterns() {
        console.log('🔍 Analyzing interaction patterns...');
        
        if (!this.currentWorkflow || !this.currentWorkflow.interactions.length) {
            console.log('⚠️ No interactions to analyze');
            return;
        }

        const interactions = this.currentWorkflow.interactions;
        const patterns = {
            commonSelectors: {},
            sequentialActions: [],
            formFillPatterns: [],
            navigationPatterns: []
        };

        // Analyze common selectors
        interactions.forEach(interaction => {
            const { element } = interaction;
            
            // Count selector usage
            if (element.id) {
                patterns.commonSelectors[`#${element.id}`] = (patterns.commonSelectors[`#${element.id}`] || 0) + 1;
            }
            
            if (element.className) {
                const classSelector = `.${element.className.split(' ').join('.')}`;
                patterns.commonSelectors[classSelector] = (patterns.commonSelectors[classSelector] || 0) + 1;
            }
        });

        // Analyze sequential actions
        for (let i = 0; i < interactions.length - 1; i++) {
            const current = interactions[i];
            const next = interactions[i + 1];
            
            patterns.sequentialActions.push({
                action1: {
                    type: current.type,
                    selector: current.element.cssSelector,
                    text: current.element.textContent
                },
                action2: {
                    type: next.type,
                    selector: next.element.cssSelector,
                    text: next.element.textContent
                },
                timeDiff: next.timestamp - current.timestamp
            });
        }

        // Analyze form filling patterns
        const formInputs = interactions.filter(i => i.type === 'input');
        if (formInputs.length > 0) {
            patterns.formFillPatterns = formInputs.map(input => ({
                selector: input.element.cssSelector,
                name: input.element.name,
                type: input.element.type,
                placeholder: input.element.attributes?.placeholder
            }));
        }

        this.learningData.patterns.push({
            workflowName: this.currentWorkflow.name,
            timestamp: Date.now(),
            patterns
        });

        console.log('📊 Pattern analysis completed:', patterns);
    }

    /**
     * Generate automation script based on learned patterns
     */
    async generateAutomationScript(workflowName) {
        const workflow = this.learningData.workflows.find(w => w.name === workflowName);
        if (!workflow) {
            throw new Error(`Workflow '${workflowName}' not found`);
        }

        const script = {
            name: workflowName,
            description: `Auto-generated script for ${workflowName} workflow`,
            steps: []
        };

        workflow.interactions.forEach((interaction, index) => {
            const step = {
                stepNumber: index + 1,
                action: interaction.type,
                selector: this.getBestSelector(interaction.element),
                fallbackSelectors: this.getFallbackSelectors(interaction.element),
                waitConditions: this.generateWaitConditions(interaction),
                description: this.generateStepDescription(interaction)
            };

            if (interaction.type === 'input' && interaction.element.value) {
                step.value = interaction.element.value;
            }

            script.steps.push(step);
        });

        // Save the generated script
        const scriptPath = path.join(__dirname, 'generated-scripts', `${workflowName}-automation.json`);
        await fs.mkdir(path.dirname(scriptPath), { recursive: true });
        await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));

        console.log(`📜 Generated automation script: ${scriptPath}`);
        return script;
    }

    /**
     * Get the best selector for an element
     */
    getBestSelector(element) {
        // Priority: ID > unique class > xpath > css selector
        if (element.id) {
            return { type: 'id', value: element.id };
        }
        
        if (element.className && element.className.split(' ').length === 1) {
            return { type: 'class', value: element.className };
        }
        
        if (element.textContent && element.textContent.length < 50) {
            return { type: 'text', value: element.textContent.trim() };
        }
        
        return { type: 'xpath', value: element.xpath };
    }

    /**
     * Get fallback selectors for robust element finding
     */
    getFallbackSelectors(element) {
        const fallbacks = [];
        
        if (element.id) fallbacks.push({ type: 'id', value: element.id });
        if (element.className) fallbacks.push({ type: 'class', value: element.className });
        if (element.textContent) fallbacks.push({ type: 'text', value: element.textContent.trim() });
        fallbacks.push({ type: 'xpath', value: element.xpath });
        fallbacks.push({ type: 'css', value: element.cssSelector });
        
        return fallbacks;
    }

    /**
     * Generate wait conditions for reliable automation
     */
    generateWaitConditions(interaction) {
        return {
            waitForSelector: true,
            waitForVisible: true,
            timeout: 5000,
            retryCount: 3
        };
    }

    /**
     * Generate human-readable step description
     */
    generateStepDescription(interaction) {
        const { type, element } = interaction;
        
        switch (type) {
            case 'click':
                if (element.textContent) {
                    return `Click on "${element.textContent.trim()}"`;
                }
                return `Click on ${element.tagName.toLowerCase()} element`;
            
            case 'input':
                if (element.name) {
                    return `Enter text in ${element.name} field`;
                }
                return `Enter text in ${element.type || 'input'} field`;
            
            default:
                return `Perform ${type} action`;
        }
    }

    /**
     * Execute a learned workflow
     */
    async executeWorkflow(workflowName, customData = {}) {
        console.log(`🤖 Executing learned workflow: ${workflowName}`);
        
        const workflow = this.learningData.workflows.find(w => w.name === workflowName);
        if (!workflow) {
            throw new Error(`Workflow '${workflowName}' not found`);
        }

        for (const interaction of workflow.interactions) {
            try {
                await this.executeInteraction(interaction, customData);
                await this.page.waitForTimeout(500); // Small delay between actions
            } catch (error) {
                console.error(`❌ Failed to execute interaction:`, error);
                // Try fallback selectors
                await this.executeInteractionWithFallback(interaction, customData);
            }
        }

        console.log('✅ Workflow execution completed');
    }

    /**
     * Execute a single interaction
     */
    async executeInteraction(interaction, customData) {
        const { type, element } = interaction;
        
        switch (type) {
            case 'click':
                await this.clickElement(element);
                break;
            
            case 'input':
                const value = customData[element.name] || element.value;
                await this.inputText(element, value);
                break;
            
            default:
                console.warn(`Unknown interaction type: ${type}`);
        }
    }

    /**
     * Click an element using learned selectors
     */
    async clickElement(element) {
        const selectors = this.getFallbackSelectors(element);
        
        for (const selector of selectors) {
            try {
                switch (selector.type) {
                    case 'id':
                        await this.page.click(`#${selector.value}`);
                        return;
                    
                    case 'class':
                        await this.page.click(`.${selector.value}`);
                        return;
                    
                    case 'text':
                        await this.page.click(`text=${selector.value}`);
                        return;
                    
                    case 'xpath':
                        const [element] = await this.page.$x(selector.value);
                        if (element) {
                            await element.click();
                            return;
                        }
                        break;
                    
                    case 'css':
                        await this.page.click(selector.value);
                        return;
                }
            } catch (error) {
                console.warn(`Failed with selector ${selector.type}:${selector.value}`, error.message);
                continue;
            }
        }
        
        throw new Error('All selectors failed for click action');
    }

    /**
     * Input text using learned selectors
     */
    async inputText(element, text) {
        const selectors = this.getFallbackSelectors(element);
        
        for (const selector of selectors) {
            try {
                switch (selector.type) {
                    case 'id':
                        await this.page.type(`#${selector.value}`, text);
                        return;
                    
                    case 'class':
                        await this.page.type(`.${selector.value}`, text);
                        return;
                    
                    case 'xpath':
                        const [elementHandle] = await this.page.$x(selector.value);
                        if (elementHandle) {
                            await elementHandle.type(text);
                            return;
                        }
                        break;
                    
                    case 'css':
                        await this.page.type(selector.value, text);
                        return;
                }
            } catch (error) {
                console.warn(`Failed with selector ${selector.type}:${selector.value}`, error.message);
                continue;
            }
        }
        
        throw new Error('All selectors failed for input action');
    }

    /**
     * Load existing learning data
     */
    async loadLearningData() {
        const dataPath = path.join(__dirname, 'learning-data.json');
        try {
            const data = await fs.readFile(dataPath, 'utf8');
            this.learningData = { ...this.learningData, ...JSON.parse(data) };
            console.log('📚 Loaded existing learning data');
        } catch (error) {
            console.log('📚 No existing learning data found, starting fresh');
        }
    }

    /**
     * Save learning data
     */
    async saveLearningData() {
        const dataPath = path.join(__dirname, 'learning-data.json');
        await fs.writeFile(dataPath, JSON.stringify(this.learningData, null, 2));
        console.log('💾 Learning data saved');
    }

    /**
     * Get learning statistics
     */
    getStats() {
        return {
            totalWorkflows: this.learningData.workflows.length,
            totalInteractions: this.learningData.workflows.reduce((sum, w) => sum + w.interactions.length, 0),
            totalPatterns: this.learningData.patterns.length,
            workflows: this.learningData.workflows.map(w => ({
                name: w.name,
                interactions: w.interactions.length,
                duration: w.duration
            }))
        };
    }

    /**
     * Clean up resources
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Interactive CLI interface
async function main() {
    const learningSystem = new BrowserLearningSystem();
    await learningSystem.initialize();

    console.log(`
🎓 Browser Learning System Ready!

Commands:
- learn <workflow-name>  : Start learning mode
- stop                   : Stop learning and analyze
- execute <workflow>     : Execute a learned workflow
- generate <workflow>    : Generate automation script
- stats                  : Show learning statistics
- list                   : List all workflows
- goto <url>            : Navigate to URL
- exit                  : Close browser and exit

Example workflow:
1. Type: learn pronto-login
2. Manually perform login in browser
3. Type: stop
4. Type: execute pronto-login
`);

    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '🤖 > '
    });

    rl.prompt();

    rl.on('line', async (input) => {
        const [command, ...args] = input.trim().split(' ');

        try {
            switch (command) {
                case 'learn':
                    const workflowName = args[0] || 'default';
                    await learningSystem.startLearning(workflowName);
                    console.log(`🎓 Learning mode started for: ${workflowName}`);
                    console.log('Perform your actions in the browser, then type "stop" when done.');
                    break;

                case 'stop':
                    const workflow = await learningSystem.stopLearning();
                    if (workflow) {
                        console.log(`✅ Learned workflow: ${workflow.name}`);
                        console.log(`📊 Recorded ${workflow.interactions.length} interactions`);
                    }
                    break;

                case 'execute':
                    const execWorkflow = args[0];
                    if (!execWorkflow) {
                        console.log('❌ Please specify workflow name');
                        break;
                    }
                    await learningSystem.executeWorkflow(execWorkflow);
                    break;

                case 'generate':
                    const genWorkflow = args[0];
                    if (!genWorkflow) {
                        console.log('❌ Please specify workflow name');
                        break;
                    }
                    const script = await learningSystem.generateAutomationScript(genWorkflow);
                    console.log(`📜 Generated script with ${script.steps.length} steps`);
                    break;

                case 'stats':
                    const stats = learningSystem.getStats();
                    console.log('📊 Learning Statistics:');
                    console.log(`   Total Workflows: ${stats.totalWorkflows}`);
                    console.log(`   Total Interactions: ${stats.totalInteractions}`);
                    console.log(`   Total Patterns: ${stats.totalPatterns}`);
                    if (stats.workflows.length > 0) {
                        console.log('   Workflows:');
                        stats.workflows.forEach(w => {
                            console.log(`     - ${w.name}: ${w.interactions} interactions (${w.duration}ms)`);
                        });
                    }
                    break;

                case 'list':
                    const workflows = learningSystem.learningData.workflows;
                    if (workflows.length === 0) {
                        console.log('📝 No workflows learned yet');
                    } else {
                        console.log('📝 Learned Workflows:');
                        workflows.forEach(w => {
                            console.log(`   - ${w.name} (${w.interactions.length} interactions)`);
                        });
                    }
                    break;

                case 'goto':
                    const url = args[0];
                    if (!url) {
                        console.log('❌ Please specify URL');
                        break;
                    }
                    await learningSystem.page.goto(url);
                    console.log(`🌐 Navigated to: ${url}`);
                    break;

                case 'exit':
                    await learningSystem.close();
                    rl.close();
                    return;

                default:
                    console.log('❌ Unknown command. Type "help" for available commands.');
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
        }

        rl.prompt();
    });

    rl.on('close', () => {
        console.log('👋 Goodbye!');
        process.exit(0);
    });
}

// Export for use as module
module.exports = { BrowserLearningSystem };

// Run as standalone script
if (require.main === module) {
    main().catch(console.error);
}