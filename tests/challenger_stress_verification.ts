import { SokratesTestClient, TestSuiteRunner, TestResult, mockServer } from "./harness";

/**
 * Challenger Stress & Resilience Test Suite
 * Created by Challenger 2 to test adversarial inputs, race conditions, and error handling resilience.
 */

export async function runChallengerStressTests(runner: TestSuiteRunner = new TestSuiteRunner()): Promise<TestResult[]> {
  const suiteResults: TestResult[] = [];

  // CS.1: Concurrent Queue Entry Race Condition Test
  suiteResults.push(
    await runner.runTest("Challenger - 10 Concurrent Queue Entries Pairwise Matching", async (ctx) => {
      const clients: SokratesTestClient[] = [];
      const matchedRooms: string[] = [];

      for (let i = 0; i < 10; i++) {
        const c = new SokratesTestClient();
        await c.register(`stress_q_${i}_${Date.now()}@sokrates.app`, `stress_q_${i}_${Date.now()}`);
        c.socket?.on("match_found", (data: any) => {
          matchedRooms.push(data.roomId);
        });
        clients.push(c);
      }

      // Enter all 10 into queue simultaneously
      await Promise.all(clients.map(c => Promise.resolve(c.socket?.enterQueue("topic-1"))));
      await new Promise(r => setTimeout(r, 100));

      ctx.assertEqual(matchedRooms.length, 10, "All 10 users paired up (5 pairs = 10 match_found events emitted)");
      ctx.assertEqual(mockServer.matchmakingQueue.length, 0, "Match queue emptied after all pairs matched");
    })
  );

  // CS.2: Hostile FTS Injection & Special Character Resilience
  suiteResults.push(
    await runner.runTest("Challenger - Hostile FTS Special Character & HTML/SQL Injections", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`fts_tester_${Date.now()}@sokrates.app`, `fts_tester_${Date.now()}`);

      const hostileQueries = [
        "' OR '1'='1",
        "<script>alert('xss')</script>",
        ".*+?^${}()|[]\\",
        "A".repeat(5000),
      ];

      for (const q of hostileQueries) {
        const res = await client.search(q);
        ctx.assertStatus(res.status, 200, `Hostile search query (${q.substring(0, 15)}...) handled without crash`);
        ctx.assert(Array.isArray(res.body.results.rooms), "Search returns valid rooms structure");
      }
    })
  );

  // CS.3: Non-existent Resource Error Resilience
  suiteResults.push(
    await runner.runTest("Challenger - Non-Existent Resource Handlers (404/400)", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`res_tester_${Date.now()}@sokrates.app`, `res_tester_${Date.now()}`);

      // Non-existent room digest
      const badDigest = await client.getDigest("non_existent_room_999");
      ctx.assertStatus(badDigest.status, 404, "Non-existent room digest returns 404 Not Found");

      // Non-existent argument map
      const badMap = await client.getArgumentMap("non_existent_room_999");
      ctx.assertStatus(badMap.status, 404, "Non-existent argument map returns 404 Not Found");

      // Invalid join request ID
      const badJoin = await client.handleJoinRequest("non_existent_room", "bad_req_id", "approved");
      ctx.assertStatus(badJoin.status, 404, "Handling non-existent join request returns 404 Not Found");
    })
  );

  // CS.4: Socket Disconnect During Active AI Stream
  suiteResults.push(
    await runner.runTest("Challenger - Socket Disconnect During AI Fallback Stream", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`disconnect_user_${Date.now()}@sokrates.app`, `disc_user_${Date.now()}`);

      let aiRoomId = "";
      client.socket?.on("ai_joining", (data: any) => {
        aiRoomId = data.roomId;
      });

      client.socket?.enterQueue("topic-1", 10);
      await new Promise(r => setTimeout(r, 50));

      ctx.assert(Boolean(aiRoomId), "AI room assigned");

      // Start stream message
      client.socket?.sendMessage(aiRoomId, "Explain moral anti-realism.");

      // Disconnect immediately mid-stream
      client.socket?.disconnect();

      // Wait to verify server does not throw unhandled exception
      await new Promise(r => setTimeout(r, 250));

      ctx.assert(!mockServer.activeSockets.has(client.socket?.id || ""), "Socket correctly cleaned up on disconnect");
    })
  );

  return suiteResults;
}

if (require.main === module) {
  const runner = new TestSuiteRunner();
  runChallengerStressTests(runner).then((results) => {
    console.log(`\n===============================================================`);
    console.log(`         CHALLENGER ADVERSARIAL STRESS TEST RESULTS            `);
    console.log(`===============================================================`);
    for (const r of results) {
      console.log(`${r.passed ? "✅ PASS" : "❌ FAIL"} ${r.name} (${r.durationMs}ms, ${r.assertionsCount} assertions)`);
      if (!r.passed) {
        r.errors.forEach(e => console.log(`   - ${e}`));
      }
    }
  });
}
