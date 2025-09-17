/**
 * Example Usage of Browser Learning System
 * 
 * This example demonstrates how to use the BrowserLearningSystem
 * to learn and automate navigation patterns for Pronto Xi.
 */

const { BrowserLearningSystem } = require('./interactive-navigator');

async function exampleUsage() {
    const learningSystem = new BrowserLearningSystem();
    
    try {
        // Initialize the browser
        console.log('🚀 Initializing browser learning system...');
        await learningSystem.initialize();
        
        // Navigate to Pronto Xi login page
        console.log('🌐 Navigating to Pronto Xi...');
        await learningSystem.page.goto('https://prontoxi.com/login');
        
        // Example 1: Learn login workflow
        console.log('\n📚 Example 1: Learning Login Workflow');
        console.log('Starting learning mode for "pronto-login"...');
        await learningSystem.startLearning('pronto-login');
        
        // Wait for user to perform login manually
        console.log('👤 Please perform login manually in the browser...');
        console.log('Press Enter when you have completed the login process...');
        
        // Wait for user input
        await waitForUserInput();
        
        // Stop learning and analyze
        const loginWorkflow = await learningSystem.stopLearning();
        console.log(`✅ Login workflow learned with ${loginWorkflow.interactions.length} interactions`);
        
        // Generate automation script
        const loginScript = await learningSystem.generateAutomationScript('pronto-login');
        console.log(`📜 Generated automation script with ${loginScript.steps.length} steps`);
        
        // Example 2: Learn navigation to requisitions
        console.log('\n📚 Example 2: Learning Navigation to Requisitions');
        console.log('Starting learning mode for "navigate-to-requisitions"...');
        await learningSystem.startLearning('navigate-to-requisitions');
        
        console.log('👤 Please navigate to the requisitions page manually...');
        console.log('Press Enter when you have reached the requisitions page...');
        
        await waitForUserInput();
        
        const navWorkflow = await learningSystem.stopLearning();
        console.log(`✅ Navigation workflow learned with ${navWorkflow.interactions.length} interactions`);
        
        // Example 3: Execute learned workflow
        console.log('\n🤖 Example 3: Executing Learned Workflow');
        console.log('Executing the navigation workflow...');
        
        // Go back to starting page
        await learningSystem.page.goto('https://prontoxi.com/dashboard');
        
        // Execute the learned navigation
        await learningSystem.executeWorkflow('navigate-to-requisitions');
        console.log('✅ Workflow execution completed');
        
        // Show statistics
        const stats = learningSystem.getStats();
        console.log('\n📊 Learning Statistics:');
        console.log(`   Total Workflows: ${stats.totalWorkflows}`);
        console.log(`   Total Interactions: ${stats.totalInteractions}`);
        console.log('   Workflows:');
        stats.workflows.forEach(w => {
            console.log(`     - ${w.name}: ${w.interactions} interactions`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        // Clean up
        await learningSystem.close();
        console.log('👋 Browser closed');
    }
}

// Helper function to wait for user input
function waitForUserInput() {
    return new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('', () => {
            rl.close();
            resolve();
        });
    });
}

// Advanced example: Custom data injection
async function advancedExample() {
    const learningSystem = new BrowserLearningSystem();
    
    try {
        await learningSystem.initialize();
        
        // Learn a form filling workflow
        await learningSystem.startLearning('fill-requisition-form');
        
        console.log('👤 Please fill out a requisition form manually...');
        await waitForUserInput();
        
        const formWorkflow = await learningSystem.stopLearning();
        
        // Execute with custom data
        const customData = {
            'requisition-title': 'Office Supplies Request',
            'description': 'Monthly office supplies for Q4',
            'amount': '500.00',
            'department': 'IT'
        };
        
        console.log('🤖 Executing form workflow with custom data...');
        await learningSystem.executeWorkflow('fill-requisition-form', customData);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await learningSystem.close();
    }
}

// Export examples
module.exports = {
    exampleUsage,
    advancedExample
};

// Run example if called directly
if (require.main === module) {
    console.log('🎓 Browser Learning System Examples\n');
    console.log('Choose an example to run:');
    console.log('1. Basic Usage Example');
    console.log('2. Advanced Form Filling Example');
    
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('Enter choice (1 or 2): ', (choice) => {
        rl.close();
        
        if (choice === '1') {
            exampleUsage().catch(console.error);
        } else if (choice === '2') {
            advancedExample().catch(console.error);
        } else {
            console.log('Invalid choice. Running basic example...');
            exampleUsage().catch(console.error);
        }
    });
}