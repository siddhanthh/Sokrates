import { SokratesTestClient, TestSuiteRunner, TestResult, mockServer } from "./harness";

/**
 * Tier 4: Real-World Application Scenarios Test Suite
 * End-to-End User Story Simulations:
 * 1. Complete 1-on-1 Philosophy Debate Lifecycle (Topic Watchlist -> Match -> Debate -> Digest -> Argument Map -> Public Debate Feed).
 * 2. Group Discussion Room Lifecycle (Creation -> AI Starter Chips -> Creator Join Moderation -> Multi-user Chat).
 */

export async function runTier4Tests(runner: TestSuiteRunner = new TestSuiteRunner()): Promise<TestResult[]> {
  const suiteResults: TestResult[] = [];

  // T4.1: 1-on-1 Philosophy Debate Full Lifecycle Scenario
  suiteResults.push(
    await runner.runTest("Tier 4 - Real-World Scenario: 1-on-1 Philosophy Debate Lifecycle", async (ctx) => {
      // Step 1: User A (Spinoza) setup & topic watchlist
      const userA = new SokratesTestClient();
      await userA.register(`spinoza_${Date.now()}@sokrates.app`, `spinoza_${Date.now()}`, "password123", ["cat-1", "cat-3"]);
      const watchRes = await userA.watchTopic("topic-1");
      ctx.assertStatus(watchRes.status, 200, "Spinoza watches topic 'Does free will exist?'");

      let notificationReceived = false;
      userA.socket?.on("watched_topic_active", (data: any) => {
        if (data.topicId === "topic-1") notificationReceived = true;
      });

      // Step 2: User B (Descartes) setup & queue entry
      const userB = new SokratesTestClient();
      await userB.register(`descartes_${Date.now()}@sokrates.app`, `descartes_${Date.now()}`, "password123", ["cat-1", "cat-4"]);

      let userBMatchRoomId = "";
      userB.socket?.on("match_found", (data: any) => {
        userBMatchRoomId = data.roomId;
      });

      // Descartes enters queue (triggers notification for Spinoza)
      userB.socket?.enterQueue("topic-1");

      await new Promise(r => setTimeout(r, 50));
      ctx.assert(notificationReceived, "Spinoza receives live 'watched_topic_active' toast notification over socket");

      // Step 3: Spinoza enters queue (triggers semantic match)
      let userAMatchRoomId = "";
      userA.socket?.on("match_found", (data: any) => {
        userAMatchRoomId = data.roomId;
      });

      userA.socket?.enterQueue("topic-1");
      await new Promise(r => setTimeout(r, 50));

      ctx.assert(Boolean(userAMatchRoomId), "Spinoza receives match_found socket event");
      ctx.assertEqual(userAMatchRoomId, userBMatchRoomId, "Both debaters placed in identical 1-on-1 room");

      const roomId = userAMatchRoomId;

      // Step 4: Multi-turn WebSocket debate conversation
      let userAReceivedMessages: string[] = [];
      let userBReceivedMessages: string[] = [];

      userA.socket?.on("new_message", (data: any) => userAReceivedMessages.push(data.message.content));
      userB.socket?.on("new_message", (data: any) => userBReceivedMessages.push(data.message.content));

      userA.socket?.sendMessage(roomId, "Substance monism dictates all events are necessary consequences of nature.");
      userB.socket?.sendMessage(roomId, "Dualism maintains mind possesses real causal agency distinct from matter.");

      await new Promise(r => setTimeout(r, 100));

      ctx.assert(userAReceivedMessages.length >= 2, "Spinoza receives both debate messages");
      ctx.assert(userBReceivedMessages.length >= 2, "Descartes receives both debate messages");

      // Step 5: End debate & generate AI Digest & Argument Map
      const endRes = await userA.endRoom(roomId);
      ctx.assertStatus(endRes.status, 200, "Debate room terminated by participant");
      ctx.assert(Boolean(endRes.body.digest), "Post-chat AI Digest generated");
      ctx.assert(Boolean(endRes.body.map), "Post-chat Argument Map JSON extracted");

      // Step 6: Save & Publish to Public Debate Showcase
      await userA.saveConversation(roomId);
      const pubRes = await userB.publishDebate(roomId);
      ctx.assertStatus(pubRes.status, 200, "Debate published to public showcase");

      // Step 7: Unauthenticated visitor verification
      const visitor = new SokratesTestClient();
      const publicFeed = await visitor.getPublicDebates();
      ctx.assert(publicFeed.body.debates.some((d: any) => d.id === roomId), "Debate accessible to public visitors");
    })
  );

  // T4.2: Group Discussion Room Lifecycle with Join Approval & AI Starters Scenario
  suiteResults.push(
    await runner.runTest("Tier 4 - Real-World Scenario: Group Discussion with Join Approval & AI Starters", async (ctx) => {
      // Step 1: Host creates group room
      const host = new SokratesTestClient();
      await host.register(`host_${Date.now()}@sokrates.app`, `host_${Date.now()}`);

      const createRes = await host.createGroupRoom(
        "Ethics of Autonomous Weapons",
        "Exploring moral accountability in algorithmic warfare.",
        "cat-2",
        5
      );
      ctx.assertStatus(createRes.status, 201, "Host creates group room with cap=5");
      const roomId = createRes.body.room.id;
      const starters: string[] = createRes.body.starters;

      ctx.assert(starters.length === 3, "3 AI conversation starter chips provided");

      // Step 2: Guest discovers room & submits join request
      const guest = new SokratesTestClient();
      await guest.register(`guest_${Date.now()}@sokrates.app`, `guest_${Date.now()}`);

      const reqRes = await guest.requestJoinRoom(roomId);
      ctx.assertStatus(reqRes.status, 201, "Guest submits join request to creator");
      const reqId = reqRes.body.request.id;

      // Step 3: Host reviews pending join requests & approves
      const reqsList = await host.request("GET", `/api/rooms/${roomId}/join-requests`);
      ctx.assertStatus(reqsList.status, 200, "Host lists pending join requests");
      ctx.assert(reqsList.body.requests.some((r: any) => r.id === reqId), "Pending request found in list");

      const approveRes = await host.handleJoinRequest(roomId, reqId, "approved");
      ctx.assertStatus(approveRes.status, 200, "Host approves guest join request");

      // Step 4: Guest joins room & sends message using AI starter chip
      guest.socket?.joinRoom(roomId);
      const selectedStarter = starters[0];

      let roomMessageReceived = false;
      host.socket?.on("new_message", (data: any) => {
        if (data.message.content === selectedStarter) roomMessageReceived = true;
      });

      guest.socket?.sendMessage(roomId, selectedStarter);
      await new Promise(r => setTimeout(r, 100));

      ctx.assert(roomMessageReceived, "Guest sends message pre-filled by AI starter question chip");
    })
  );

  return suiteResults;
}

// Standalone runner execution if invoked directly
if (require.main === module) {
  runTier4Tests().then((results) => {
    console.log(`\n--- Tier 4 Test Results ---`);
    for (const r of results) {
      console.log(`${r.passed ? "✅ PASS" : "❌ FAIL"} ${r.name} (${r.durationMs}ms, ${r.assertionsCount} assertions)`);
      if (!r.passed) {
        r.errors.forEach(e => console.log(`   - ${e}`));
      }
    }
  });
}
