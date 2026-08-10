import { SokratesTestClient, TestSuiteRunner, TestResult, mockServer } from "./harness";

/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * Covers edge cases: empty interests, room cap limits, queue cancellations,
 * empty messages, invalid tokens, rate limiting, and RBAC authorization boundaries.
 */

export async function runTier2Tests(runner: TestSuiteRunner = new TestSuiteRunner()): Promise<TestResult[]> {
  const suiteResults: TestResult[] = [];

  // T2.1: Empty Interest Vector Edge Case
  suiteResults.push(
    await runner.runTest("Tier 2 - Empty Interest Categories & Vector Handling", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`empty_int_${Date.now()}@sokrates.app`, `empty_int_${Date.now()}`);

      const res = await client.updateInterests([]);
      ctx.assertStatus(res.status, 200, "Empty interests update handled gracefully with 200 OK");
      ctx.assertEqual(res.body.user.interestCategories.length, 0, "Empty category array saved");
      ctx.assertEqual(res.body.user.interestVec.length, 768, "Generates default non-null 768-dim unit vector");
    })
  );

  // T2.2: Room Participant Cap Boundaries (Min=2, Max=20)
  suiteResults.push(
    await runner.runTest("Tier 2 - Room Participant Cap Boundaries (Min=2, Max=20)", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`cap_tester_${Date.now()}@sokrates.app`, `cap_tester_${Date.now()}`);

      // Cap < 2 (Invalid)
      const lowRes = await client.createGroupRoom("Low Cap Room", "Desc", "cat-1", 1);
      ctx.assertStatus(lowRes.status, 400, "Cap = 1 rejected with 400 Bad Request");

      // Cap > 20 (Invalid)
      const highRes = await client.createGroupRoom("High Cap Room", "Desc", "cat-1", 25);
      ctx.assertStatus(highRes.status, 400, "Cap = 25 rejected with 400 Bad Request");

      // Exact Boundary Cap = 2 (Valid)
      const minValid = await client.createGroupRoom("Min Cap Room", "Desc", "cat-1", 2);
      ctx.assertStatus(minValid.status, 201, "Cap = 2 accepted as min valid cap");

      // Exact Boundary Cap = 20 (Valid)
      const maxValid = await client.createGroupRoom("Max Cap Room", "Desc", "cat-1", 20);
      ctx.assertStatus(maxValid.status, 201, "Cap = 20 accepted as max valid cap");
    })
  );

  // T2.3: Queue Entry and Early Cancellation Edge Case
  suiteResults.push(
    await runner.runTest("Tier 2 - Queue Cancellation Before Fallback Timeout", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`cancel_user_${Date.now()}@sokrates.app`, `cancel_user_${Date.now()}`);

      let aiJoined = false;
      client.socket?.on("ai_joining", () => {
        aiJoined = true;
      });

      // Enter queue with 100ms timeout
      client.socket?.enterQueue("topic-1", 100);

      // Immediately leave queue before timeout
      client.socket?.leaveQueue("topic-1");

      // Wait 150ms
      await new Promise(r => setTimeout(r, 150));

      ctx.assert(!aiJoined, "AI Fallback not triggered after queue cancellation");
    })
  );

  // T2.4: Empty & Whitespace Message Validation
  suiteResults.push(
    await runner.runTest("Tier 2 - Empty & Whitespace Message Filtering", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`msg_tester_${Date.now()}@sokrates.app`, `msg_tester_${Date.now()}`);

      const roomRes = await client.createGroupRoom("Validation Room");
      const roomId = roomRes.body.room.id;

      let errorMsgReceived = false;
      client.socket?.on("error", (err: string) => {
        if (err.includes("empty message")) errorMsgReceived = true;
      });

      // Send empty string
      client.socket?.sendMessage(roomId, "");

      // Send whitespace only
      client.socket?.sendMessage(roomId, "   \n\t  ");

      await new Promise(r => setTimeout(r, 50));

      ctx.assert(errorMsgReceived, "Socket returns error event when sending empty/whitespace message");
    })
  );

  // T2.5: Invalid & Expired Token Authentication Security Boundary
  suiteResults.push(
    await runner.runTest("Tier 2 - Invalid Token Authorization Boundary", async (ctx) => {
      const invalidClient = new SokratesTestClient();
      invalidClient.token = "jwt_invalid_fake_token_12345";

      const profileRes = await invalidClient.getProfile();
      ctx.assertStatus(profileRes.status, 401, "Invalid token rejected with 401 Unauthorized");

      // Invalid socket connection
      let socketErrorEmitted = false;
      const invalidSocketClient = new SokratesTestClient();
      invalidSocketClient.token = "jwt_invalid_fake_token_12345";
      invalidSocketClient.connectSocket();
      invalidSocketClient.socket?.on("error", (err: string) => {
        if (err.includes("Unauthorized")) socketErrorEmitted = true;
      });
      invalidSocketClient.socket?.connect("jwt_invalid_fake_token_12345");

      await new Promise(r => setTimeout(r, 50));
      ctx.assert(socketErrorEmitted, "Socket connection with invalid token rejected");
    })
  );

  // T2.6: Rate Limiting Sliding Window Boundary
  suiteResults.push(
    await runner.runTest("Tier 2 - Redis-Backed Rate Limiting Threshold (100 req/min)", async (ctx) => {
      const client = new SokratesTestClient();

      let rateLimited = false;
      // Perform 105 rapid unauthenticated requests to hit 100 req/min rate limit
      for (let i = 0; i < 105; i++) {
        const res = await client.request("GET", "/api/interests/categories");
        if (res.status === 429) {
          rateLimited = true;
          break;
        }
      }

      ctx.assert(rateLimited, "Rate limiter returns 429 Too Many Requests when threshold exceeded");
    })
  );

  // T2.7: Non-Admin Access Control Security Boundary (RBAC)
  suiteResults.push(
    await runner.runTest("Tier 2 - Non-Admin RBAC Security Guard", async (ctx) => {
      const regularUser = new SokratesTestClient();
      await regularUser.register(`regular_${Date.now()}@sokrates.app`, `regular_${Date.now()}`);

      const adminStatsRes = await regularUser.getAdminStats();
      ctx.assertStatus(adminStatsRes.status, 403, "Non-admin access to admin endpoint returned 403 Forbidden");
    })
  );

  return suiteResults;
}

// Standalone runner execution if invoked directly
if (require.main === module) {
  runTier2Tests().then((results) => {
    console.log(`\n--- Tier 2 Test Results ---`);
    for (const r of results) {
      console.log(`${r.passed ? "✅ PASS" : "❌ FAIL"} ${r.name} (${r.durationMs}ms, ${r.assertionsCount} assertions)`);
      if (!r.passed) {
        r.errors.forEach(e => console.log(`   - ${e}`));
      }
    }
  });
}
