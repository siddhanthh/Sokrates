import { TestSuiteRunner, TestResult } from "./harness";
import { runTier1Tests } from "./tier1_features.test";
import { runTier2Tests } from "./tier2_boundary.test";
import { runTier3Tests } from "./tier3_cross_feature.test";
import { runTier4Tests } from "./tier4_real_world.test";

/**
 * Sokrates Master E2E Test Runner
 * Executes Tiers 1-4 Test Suites and reports comprehensive metrics.
 */

async function main() {
  console.log(`\n===============================================================`);
  console.log(`          SOKRATES E2E MASTER TEST RUNNER (TIERS 1-4)         `);
  console.log(`===============================================================\n`);

  const runner = new TestSuiteRunner();
  const startTime = Date.now();

  console.log(`Executing Tier 1: Feature Coverage Tests...`);
  const tier1Results = await runTier1Tests(runner);

  console.log(`Executing Tier 2: Boundary & Corner Cases Tests...`);
  const tier2Results = await runTier2Tests(runner);

  console.log(`Executing Tier 3: Cross-Feature Integration Tests...`);
  const tier3Results = await runTier3Tests(runner);

  console.log(`Executing Tier 4: Real-World Application Scenarios...`);
  const tier4Results = await runTier4Tests(runner);

  const totalDuration = Date.now() - startTime;
  const allResults = runner.getResults();

  let totalAssertions = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  console.log(`\n---------------------------------------------------------------`);
  console.log(`                     DETAILED TEST RESULTS                     `);
  console.log(`---------------------------------------------------------------`);

  const printTierGroup = (tierName: string, results: TestResult[]) => {
    console.log(`\n🔹 ${tierName}`);
    for (const r of results) {
      totalAssertions += r.assertionsCount;
      if (r.passed) {
        totalPassed++;
        console.log(`  ✅ PASS  ${r.name} (${r.durationMs}ms, ${r.assertionsCount} assertions)`);
      } else {
        totalFailed++;
        console.log(`  ❌ FAIL  ${r.name} (${r.durationMs}ms, ${r.assertionsCount} assertions)`);
        r.errors.forEach(e => console.log(`      ⚠️  ${e}`));
      }
    }
  };

  printTierGroup("Tier 1: Feature Coverage (R1 - R6)", tier1Results);
  printTierGroup("Tier 2: Boundary & Corner Cases", tier2Results);
  printTierGroup("Tier 3: Cross-Feature Pairwise Transitions", tier3Results);
  printTierGroup("Tier 4: Real-World Multi-User Scenarios", tier4Results);

  const passRate = ((totalPassed / allResults.length) * 100).toFixed(1);

  console.log(`\n===============================================================`);
  console.log(`                     SUMMARY & VERIFICATION                    `);
  console.log(`===============================================================`);
  console.log(` Total Test Suites  : ${allResults.length}`);
  console.log(` Passed Test Suites : ${totalPassed}`);
  console.log(` Failed Test Suites : ${totalFailed}`);
  console.log(` Total Assertions   : ${totalAssertions}`);
  console.log(` Overall Pass Rate  : ${passRate}%`);
  console.log(` Total Execution Time: ${totalDuration}ms`);
  console.log(`===============================================================\n`);

  if (totalFailed > 0) {
    console.error(`❌ TEST SUITE FAILURE: ${totalFailed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL QUALITY TIERS PASSED! System is fully verified for deployment.`);
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Master runner error:", err);
    process.exit(1);
  });
}
