// PixelBlasphemy Studio - Master Test Suite Runner
const { runIntegrityTests } = require('./integrity.test');
const { runUnitTests } = require('./unit.test');
const { runServerTests } = require('./server.test');

async function main() {
  console.log('====================================================');
  console.log('   PIXELBLASPHEMY STUDIO - COMPLETE TEST SUITE      ');
  console.log('====================================================\n');

  const startTime = Date.now();

  try {
    // 1. Static Integrity
    runIntegrityTests();
    console.log('\n----------------------------------------------------\n');

    // 2. Unit Tests
    await runUnitTests();
    console.log('\n----------------------------------------------------\n');

    // 3. Server API Integration Tests
    await runServerTests();
    console.log('\n====================================================');
    console.log(`   ALL TEST SUITES PASSED CLEANLY in ${((Date.now() - startTime) / 1000).toFixed(2)}s!`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n[FATAL] A test suite encountered an error:', err);
    process.exit(1);
  }
}

main();
