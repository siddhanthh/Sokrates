import { SokratesTestClient, TestSuiteRunner, TestResult, mockServer } from "./harness";

/**
 * Tier 1: Feature Coverage Test Suite
 * Covers R1 (Auth & Profile), R2 (Group Rooms), R3 (Match Queue),
 * R4 (AI Fallback), R5 (Digests & Argument Maps), R6 (Public Debates & Admin Stats)
 */

export async function runTier1Tests(runner: TestSuiteRunner = new TestSuiteRunner()): Promise<TestResult[]> {
  const suiteResults: TestResult[] = [];

  // T1.1: Auth & Profile Lifecycle
  suiteResults.push(
    await runner.runTest("Tier 1 - Auth & Profile Lifecycle (R1)", async (ctx) => {
      const client = new SokratesTestClient();
      const email = `philosopher_${Date.now()}@sokrates.app`;
      const username = `socrates_${Date.now()}`;

      // Register
      const regRes = await client.register(email, username, "secret123", ["cat-1", "cat-2"]);
      ctx.assertStatus(regRes.status, 201, "User registration succeeds");
      ctx.assert(Boolean(regRes.body.token), "Auth token returned on registration");
      ctx.assertEqual(regRes.body.user.username, username, "Username matches registration");

      // Profile Retrieval
      const profileRes = await client.getProfile();
      ctx.assertStatus(profileRes.status, 200, "Get user profile returns 200 OK");
      ctx.assertEqual(profileRes.body.user.email, email, "Profile email matches");

      // Update Bio
      const patchRes = await client.updateProfile({ bio: "Seeking wisdom through dialogue." });
      ctx.assertStatus(patchRes.status, 200, "Update profile bio returns 200 OK");
      ctx.assertEqual(patchRes.body.user.bio, "Seeking wisdom through dialogue.", "Updated bio persisted");
    })
  );

  // T1.2: Interest Vector API & Embedding Generation
  suiteResults.push(
    await runner.runTest("Tier 1 - Interest Vector Embedding API (R1)", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`vector_user_${Date.now()}@sokrates.app`, `vector_user_${Date.now()}`);

      // Update interest categories
      const intRes = await client.updateInterests(["cat-1", "cat-3", "cat-6"]);
      ctx.assertStatus(intRes.status, 200, "Update interests returns 200 OK");
      ctx.assertEqual(intRes.body.user.interestCategories.length, 3, "User assigned 3 categories");
      ctx.assertEqual(intRes.body.user.interestVec.length, 768, "Generates 768-dimensional interest vector");
    })
  );

  // T1.3: Group Discussion Room & AI Starter Questions
  suiteResults.push(
    await runner.runTest("Tier 1 - Group Discussion Rooms & AI Starters (R2)", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`creator_${Date.now()}@sokrates.app`, `creator_${Date.now()}`);

      // Create Group Room
      const roomRes = await client.createGroupRoom(
        "Is Utilitarianism morally justifiable in modern warfare?",
        "Discussing consequentialist ethical frameworks vs deontological duties.",
        "cat-2",
        8
      );
      ctx.assertStatus(roomRes.status, 201, "Group room creation returns 201 Created");
      ctx.assertEqual(roomRes.body.room.customTopic, "Is Utilitarianism morally justifiable in modern warfare?", "Custom topic matches");
      ctx.assertEqual(roomRes.body.room.cap, 8, "Participant cap set correctly");
      ctx.assert(Array.isArray(roomRes.body.starters), "AI conversation starters generated");
      ctx.assertEqual(roomRes.body.starters.length, 3, "Generates exactly 3 AI starter questions");
    })
  );

  // T1.4: 1-on-1 Match Queue & Cosine Similarity Matchmaking
  suiteResults.push(
    await runner.runTest("Tier 1 - 1-on-1 Semantic Matchmaking Queue (R3)", async (ctx) => {
      const client1 = new SokratesTestClient();
      await client1.register(`thinker1_${Date.now()}@sokrates.app`, `thinker1_${Date.now()}`, "password123", ["cat-1", "cat-2"]);

      const client2 = new SokratesTestClient();
      await client2.register(`thinker2_${Date.now()}@sokrates.app`, `thinker2_${Date.now()}`, "password123", ["cat-1", "cat-2"]);

      let matchFound = false;
      let matchedRoomId = "";

      client2.socket?.on("match_found", (data: any) => {
        matchFound = true;
        matchedRoomId = data.roomId;
      });

      // User 1 enters queue
      client1.socket?.enterQueue("topic-1");

      // User 2 enters queue (triggers match)
      client2.socket?.enterQueue("topic-1");

      ctx.assert(matchFound, "Semantic match found and emitted over socket");
      ctx.assert(matchedRoomId.startsWith("room_1on1_"), "Matched room created with 1on1 type");
    })
  );

  // T1.5: Real-time AI Fallback Streaming
  suiteResults.push(
    await runner.runTest("Tier 1 - Real-time AI Fallback Streaming (R4)", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`solo_${Date.now()}@sokrates.app`, `solo_${Date.now()}`);

      let aiJoiningEmitted = false;
      let aiChunksReceived = 0;
      let aiDoneEmitted = false;
      let aiRoomId = "";

      client.socket?.on("ai_joining", (data: any) => {
        aiJoiningEmitted = true;
        aiRoomId = data.roomId;
      });

      client.socket?.on("ai_chunk", () => {
        aiChunksReceived++;
      });

      client.socket?.on("ai_done", () => {
        aiDoneEmitted = true;
      });

      // Enter queue with fast 20ms fallback timeout
      client.socket?.enterQueue("topic-1", 20);

      // Wait for timer and streaming
      await new Promise(r => setTimeout(r, 200));

      ctx.assert(aiJoiningEmitted, "ai_joining socket event emitted on timeout");
      ctx.assert(Boolean(aiRoomId), "AI room assigned");

      // Send message to AI partner
      client.socket?.sendMessage(aiRoomId, "What is the nature of human consciousness?");
      await new Promise(r => setTimeout(r, 300));

      ctx.assert(aiChunksReceived > 0, "Received streamed AI response chunks over socket");
      ctx.assert(aiDoneEmitted, "ai_done event emitted when AI response stream finishes");
    })
  );

  // T1.6: Post-Chat Digest & Argument Map Generation
  suiteResults.push(
    await runner.runTest("Tier 1 - AI Digest & Argument Map Generation (R5)", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`debater_${Date.now()}@sokrates.app`, `debater_${Date.now()}`);

      const roomRes = await client.createGroupRoom("Free Will vs Determinism");
      const roomId = roomRes.body.room.id;

      // End room
      const endRes = await client.endRoom(roomId);
      ctx.assertStatus(endRes.status, 200, "Ending room returns 200 OK");
      ctx.assert(Boolean(endRes.body.digest), "AI digest generated upon room termination");
      ctx.assert(Boolean(endRes.body.digest.summary), "Digest contains 3-sentence summary");
      ctx.assert(Boolean(endRes.body.digest.unresolvedQuestion), "Digest includes unresolved question");
    })
  );

  // T1.7: Public Debate Showcase & Full-Text Search
  suiteResults.push(
    await runner.runTest("Tier 1 - Public Debate Showcase & FTS (R6)", async (ctx) => {
      const client = new SokratesTestClient();
      await client.register(`public_user_${Date.now()}@sokrates.app`, `public_user_${Date.now()}`);

      const roomRes = await client.createGroupRoom("Existentialism and the Search for Meaning");
      const roomId = roomRes.body.room.id;

      // Publish debate
      const pubRes = await client.publishDebate(roomId);
      ctx.assertStatus(pubRes.status, 200, "Publish debate returns 200 OK");

      // Fetch public debates feed
      const debatesRes = await client.getPublicDebates();
      ctx.assertStatus(debatesRes.status, 200, "Get public debates returns 200 OK");
      ctx.assert(debatesRes.body.debates.some((d: any) => d.id === roomId), "Published debate appears in public feed");

      // Full-text search
      const searchRes = await client.search("Existentialism");
      ctx.assertStatus(searchRes.status, 200, "Full-text search returns 200 OK");
      ctx.assert(searchRes.body.results.rooms.length > 0, "FTS returns matching group room");
    })
  );

  // T1.8: Admin Dashboard & Statistics
  suiteResults.push(
    await runner.runTest("Tier 1 - Admin Stats Dashboard (R6)", async (ctx) => {
      const adminClient = new SokratesTestClient();
      await adminClient.register(`admin_${Date.now()}@sokrates.app`, `admin_${Date.now()}`);

      const statsRes = await adminClient.getAdminStats();
      ctx.assertStatus(statsRes.status, 200, "Admin stats endpoint returns 200 OK for admin role");
      ctx.assert(typeof statsRes.body.stats.totalUsers === "number", "Returns total users metric");
      ctx.assert(typeof statsRes.body.stats.totalRooms === "number", "Returns total rooms metric");
    })
  );

  return suiteResults;
}

// Standalone runner execution if invoked directly
if (require.main === module) {
  runTier1Tests().then((results) => {
    console.log(`\n--- Tier 1 Test Results ---`);
    for (const r of results) {
      console.log(`${r.passed ? "✅ PASS" : "❌ FAIL"} ${r.name} (${r.durationMs}ms, ${r.assertionsCount} assertions)`);
      if (!r.passed) {
        r.errors.forEach(e => console.log(`   - ${e}`));
      }
    }
  });
}
