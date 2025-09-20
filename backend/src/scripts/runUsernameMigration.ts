import { updateAllPRFUsernames } from './updateUsernamesToLDAP';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');
  
  console.log('🚀 PRF Username Migration Tool');
  console.log('================================');
  console.log('');
  
  if (!isLive) {
    console.log('⚠️  Running in DRY RUN mode');
    console.log('   No changes will be made to the database');
    console.log('   Use --live flag to perform actual updates');
    console.log('');
  } else {
    console.log('🔥 Running in LIVE mode');
    console.log('   Changes WILL be made to the database');
    console.log('');
  }
  
  try {
    await updateAllPRFUsernames(!isLive);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();