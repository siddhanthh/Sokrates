import { SokratesTestClient, TestSuiteRunner, TestResult } from "./harness";
import prisma from "../lib/prisma";

/**
 * Tier 3: Cross-Feature Integration Test Suite
 * Pairwise & Multi-System State Transitions:
 * 1. Queue timeout transition into Real-time Socket AI Fallback.
 * 2. Chat room termination triggering AI Digest & Argument Map JSON extraction.
 * 3. Admin user suspension forcing session invalidation and account lock.
 */

export async function runTier3Tests(runner: TestSuiteRunner = new TestSuiteRunner()): Promise<TestResult[]> {
  const suiteResults: TestResult[] = [];

  // T3.1: Matchmaking Queue to AI Fallback Socket Stream Handoff
  suiteResults.push(
    await runner.runTest("Tier 3 - Match Queue Timeout to Socket AI Fallback Transition", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`transition_user_${Date.now()}@sokrates.app`, `transition_user_${Date.now()}`);

      let aiJoiningReceived = false;
      let assignedRoomId = "";
      let aiChunksCount = 0;
      let aiDoneReceived = false;

      client.socket?.on("ai_joining", (data: any) => {
        aiJoiningReceived = true;
        assignedRoomId = data.roomId;
      });

      client.socket?.on("ai_chunk", () => {
        aiChunksCount++;
      });

      client.socket?.on("ai_done", () => {
        aiDoneReceived = true;
      });

      // Enter queue with fast 50ms test fallback timeout
      client.socket?.enterQueue("topic-1", 50);

      // Wait for queue timeout transition
      await new Promise(r => setTimeout(r, 200));

      ctx.assert(aiJoiningReceived, "Queue service successfully hands off to AI Fallback socket stream");
      ctx.assert(Boolean(assignedRoomId), "AI Fallback room ID created");

      // Verify room has_ai flag in server DB
      const roomRecord = await prisma.room.findUnique({ where: { id: assignedRoomId } });
      ctx.assert(Boolean(roomRecord?.hasAi), "Room state updated to has_ai = true");

      // User sends message in AI room
      client.socket?.sendMessage(assignedRoomId, "Is human perception a direct representation of reality?");
      await new Promise(r => setTimeout(r, 1200));

      ctx.assert(aiChunksCount > 0, "AI fallback streams token chunks over WebSocket");
      ctx.assert(aiDoneReceived, "AI fallback stream completes with ai_done event");
    })
  );

  // T3.2: Room Termination to Post-Chat AI Digest & Argument Map Pipeline
  suiteResults.push(
    await runner.runTest("Tier 3 - Room Termination to AI Digest & Argument Map Generation", async (ctx) => {
      const client1 = new SokratesTestClient();
      await client1.register(`debater1_${Date.now()}@sokrates.app`, `debater1_${Date.now()}`);

      const client2 = new SokratesTestClient();
      await client2.register(`debater2_${Date.now()}@sokrates.app`, `debater2_${Date.now()}`);

      // Fetch a valid system topic
      const topic = await prisma.systemTopic.findFirst();

      // Create 1-on-1 room directly in database for pipeline test
      const roomRecord = await prisma.room.create({
        data: {
          type: "ONE_ON_ONE",
          systemTopicId: topic?.id,
          customTopic: topic?.title || "Free Will vs Determinism",
          status: "active",
          hasAi: false,
          isPublic: false,
          participants: {
            create: [
              { userId: client1.user?.id, isAi: false },
              { userId: client2.user?.id, isAi: false },
            ],
          },
          messages: {
            create: [
              { senderId: client1.user?.id, isAi: false, content: "Hard determinism eliminates moral blame." },
              { senderId: client2.user?.id, isAi: false, content: "Compatibilism retains moral responsibility." },
            ],
          },
        },
      });
      const roomId = roomRecord.id;

      // End Room (triggers post-chat pipeline)
      const endRes = await client1.endRoom(roomId);
      ctx.assertStatus(endRes.status, 200, "Room termination returns 200 OK");

      // Fetch generated AI Digest
      const digestRes = await client1.getDigest(roomId);
      ctx.assertStatus(digestRes.status, 200, "Get AI Digest returns 200 OK");
      ctx.assert(Boolean(digestRes.body.digest.summary), "AI Digest contains structured 3-sentence summary");
      ctx.assert(Boolean(digestRes.body.digest.user1Position), "AI Digest contains User 1 stance");
      ctx.assert(Boolean(digestRes.body.digest.unresolvedQuestion), "AI Digest contains unresolved question");

      // Fetch extracted Argument Map
      const mapRes = await client1.getArgumentMap(roomId);
      ctx.assertStatus(mapRes.status, 200, "Get Argument Map returns 200 OK");
      ctx.assert(Array.isArray(mapRes.body.map.data.nodes), "Argument Map contains node list");
      ctx.assert(mapRes.body.map.data.nodes.some((n: any) => n.type === "claim"), "Argument Map contains 'claim' node");

      // Save to profile history
      const saveRes = await client1.saveConversation(roomId);
      ctx.assertStatus(saveRes.status, 200, "Conversation saved to profile history");
    })
  );

  // T3.3: Admin Suspension During Active Room Session
  suiteResults.push(
    await runner.runTest("Tier 3 - Admin User Suspension & Active Session Invalidation", async (ctx) => {
      // Create regular user
      const regularClient = new SokratesTestClient();
      const regUser = await regularClient.register(`suspendee_${Date.now()}@sokrates.app`, `suspendee_${Date.now()}`);
      const userId = regUser.body.user.id;

      // Create admin user
      const adminClient = new SokratesTestClient();
      await adminClient.register(`admin_mod_${Date.now()}@sokrates.app`, `admin_mod_${Date.now()}`);

      // Verify regular user can access session
      const sessionBefore = await regularClient.getSession();
      ctx.assertStatus(sessionBefore.status, 200, "User active before suspension");

      // Admin suspends user
      const suspendRes = await adminClient.adminSuspendUser(userId, true);
      ctx.assertStatus(suspendRes.status, 200, "Admin suspends user successfully");
      ctx.assert(suspendRes.body.user.suspended === true, "User record marked suspended");

      // Regular user attempts subsequent request -> 401/403 Invalidated
      const sessionAfter = await regularClient.getSession();
      ctx.assertStatus(sessionAfter.status, 401, "Suspended user active token invalidated with 401/403");

      // Regular user attempts to re-login -> 403 Account Suspended
      const loginAttempt = await regularClient.login(regUser.body.user.email, "password123");
      ctx.assertStatus(loginAttempt.status, 403, "Re-login attempt rejected with 403 Account Suspended");
    })
  );

  return suiteResults;
}

// Standalone runner execution if invoked directly
if (require.main === module) {
  runTier3Tests().then((results) => {
    console.log(`\n--- Tier 3 Test Results ---`);
    for (const r of results) {
      console.log(`${r.passed ? "✅ PASS" : "❌ FAIL"} ${r.name} (${r.durationMs}ms, ${r.assertionsCount} assertions)`);
      if (!r.passed) {
        r.errors.forEach(e => console.log(`   - ${e}`));
      }
    }
  });
}
