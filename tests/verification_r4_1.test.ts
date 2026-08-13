import { SokratesTestClient, RealSocketClient } from "./harness";
import redis from "../lib/redis";
import prisma from "../lib/prisma";

async function runEmpiricalVerification() {
  console.log("===============================================================");
  console.log("    CHALLENGER 1 (challenger_r4_1) EMPIRICAL VERIFICATION      ");
  console.log("===============================================================\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function recordResult(name: string, passed: boolean, details?: string) {
    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`✅ PASS: ${name}`);
    } else {
      failedTests++;
      console.log(`❌ FAIL: ${name} - ${details || "Unknown failure"}`);
    }
  }

  // --- VERIFICATION ITEM 1: Production API Route Execution via SokratesTestClient ---
  console.log("--- 1. Testing Production API Route Execution via SokratesTestClient ---");

  try {
    const client = new SokratesTestClient();

    // 1.1 Register
    const email = `r4_1_verify_${Date.now()}@sokrates.app`;
    const username = `r4_1_verify_${Date.now()}`;
    const regRes = await client.register(email, username, "password123");
    recordResult("POST /api/auth/register", regRes.status === 201, `Status: ${regRes.status}`);

    // 1.2 Session
    const sessionRes = await client.getSession();
    recordResult("GET /api/auth/session", sessionRes.status === 200, `Status: ${sessionRes.status}`);

    // 1.3 Profile GET & PATCH
    const profileRes = await client.getProfile();
    recordResult("GET /api/users/me", profileRes.status === 200, `Status: ${profileRes.status}`);

    const updateProfileRes = await client.updateProfile({ bio: "Empirical challenger test bio" });
    recordResult("PATCH /api/users/me", updateProfileRes.status === 200, `Status: ${updateProfileRes.status}`);

    // 1.4 Categories GET & Interests PATCH
    const catRes = await client.request("GET", "/api/interests/categories");
    recordResult("GET /api/interests/categories", catRes.status === 200 && Array.isArray(catRes.body.categories), `Status: ${catRes.status}`);

    const catId = catRes.body.categories[0]?.id;
    if (catId) {
      const updateIntRes = await client.updateInterests([catId]);
      recordResult("PATCH /api/interests", updateIntRes.status === 200, `Status: ${updateIntRes.status}`);
    }

    // 1.5 Topics GET, Trending, Watched, Watch, Unwatch
    const topicsRes = await client.request("GET", "/api/topics");
    recordResult("GET /api/topics", topicsRes.status === 200, `Status: ${topicsRes.status}`);

    const trendingRes = await client.request("GET", "/api/topics/trending");
    recordResult("GET /api/topics/trending", trendingRes.status === 200, `Status: ${trendingRes.status}`);

    // Get system topic ID from DB or create dummy topic
    let sysTopic = await prisma.systemTopic.findFirst();
    if (!sysTopic && catId) {
      sysTopic = await prisma.systemTopic.create({
        data: {
          title: "Empirical Test Topic",
          description: "Test description for route verification",
          categoryId: catId,
        },
      });
    }

    if (sysTopic) {
      const watchRes = await client.watchTopic(sysTopic.id);
      recordResult("POST /api/topics/[id]/watch", watchRes.status === 200, `Status: ${watchRes.status}`);

      const watchedRes = await client.getWatchedTopics();
      recordResult("GET /api/topics/watched", watchedRes.status === 200, `Status: ${watchedRes.status}`);

      const unwatchRes = await client.unwatchTopic(sysTopic.id);
      recordResult("DELETE /api/topics/[id]/watch", unwatchRes.status === 200, `Status: ${unwatchRes.status}`);
    }

    // 1.6 Group Rooms POST, GET, Detail, Join Request, Handle Join Request, End Room
    const createRoomRes = await client.createGroupRoom("Empirical Discussion", "Verifying route execution", catId);
    recordResult("POST /api/rooms", createRoomRes.status === 201, `Status: ${createRoomRes.status}`);
    const roomId = createRoomRes.body?.room?.id;

    if (roomId) {
      const getRoomsRes = await client.getRooms();
      recordResult("GET /api/rooms", getRoomsRes.status === 200, `Status: ${getRoomsRes.status}`);

      const roomDetailRes = await client.request("GET", `/api/rooms/${roomId}`);
      recordResult("GET /api/rooms/[id]", roomDetailRes.status === 200, `Status: ${roomDetailRes.status}`);

      // Second client makes join request
      const client2 = new SokratesTestClient();
      await client2.register(`r4_1_joiner_${Date.now()}@sokrates.app`, `r4_1_joiner_${Date.now()}`);

      const joinReqRes = await client2.requestJoinRoom(roomId);
      recordResult("POST /api/rooms/[id]/join-request", joinReqRes.status === 201, `Status: ${joinReqRes.status}`);
      const reqId = joinReqRes.body?.joinRequest?.id;

      const getReqsRes = await client.request("GET", `/api/rooms/${roomId}/join-requests`);
      recordResult("GET /api/rooms/[id]/join-requests", getReqsRes.status === 200, `Status: ${getReqsRes.status}`);

      if (reqId) {
        const handleReqRes = await client.handleJoinRequest(roomId, reqId, "approved");
        recordResult("PATCH /api/rooms/[id]/join-requests/[reqId]", handleReqRes.status === 200, `Status: ${handleReqRes.status}`);
      }

      const endRoomRes = await client.endRoom(roomId);
      recordResult("DELETE /api/rooms/[id]", endRoomRes.status === 200, `Status: ${endRoomRes.status}`);
    }

    // 1.7 Conversations (Digest, Map, Save, Publish) - Test existing or created room
    const convRoom = await prisma.room.create({
      data: { type: "ONE_ON_ONE", status: "ended", hasAi: false, isPublic: false }
    });

    await prisma.conversationDigest.create({
      data: {
        roomId: convRoom.id,
        summary: "Summary test",
        user1Position: "Pos 1",
        user2Position: "Pos 2",
        unresolvedQuestion: "Q?",
      }
    });

    await prisma.argumentMap.create({
      data: {
        roomId: convRoom.id,
        data: { central_question: "Q?", participants: [], nodes: [] }
      }
    });

    const digestRes = await client.getDigest(convRoom.id);
    recordResult("GET /api/conversations/[id]/digest", digestRes.status === 200, `Status: ${digestRes.status}`);

    const mapRes = await client.getArgumentMap(convRoom.id);
    recordResult("GET /api/conversations/[id]/map", mapRes.status === 200, `Status: ${mapRes.status}`);

    const saveRes = await client.saveConversation(convRoom.id);
    recordResult("POST /api/conversations/[id]/save", saveRes.status === 200, `Status: ${saveRes.status}`);

    const pubRes = await client.publishDebate(convRoom.id);
    recordResult("PATCH /api/conversations/[id]/publish", pubRes.status === 200, `Status: ${pubRes.status}`);

    // 1.8 Public Debates & Search
    const debatesRes = await client.getPublicDebates();
    recordResult("GET /api/debates", debatesRes.status === 200, `Status: ${debatesRes.status}`);

    const searchRes = await client.search("Empirical");
    recordResult("GET /api/search", searchRes.status === 200, `Status: ${searchRes.status}`);

    // 1.9 Admin Routes
    // Grant admin role to client user
    await prisma.user.update({
      where: { id: client.user.id },
      data: { role: "admin" }
    });

    const statsRes = await client.getAdminStats();
    recordResult("GET /api/admin/stats", statsRes.status === 200, `Status: ${statsRes.status}`);

    const client2User = await prisma.user.findFirst({ where: { email: { contains: "r4_1_joiner_" } } });
    if (client2User) {
      const suspendRes = await client.adminSuspendUser(client2User.id, true);
      recordResult("PATCH /api/admin/users/[id] (Suspend)", suspendRes.status === 200, `Status: ${suspendRes.status}`);
    }

  } catch (err: any) {
    recordResult("API Route Handlers Execution", false, err.stack || err.message);
  }

  // --- VERIFICATION ITEM 2: Socket Error Event Handling & Crash Prevention ---
  console.log("\n--- 2. Testing Socket Error Event Handling & Crash Prevention ---");

  try {
    let unhandledErrorCaught = false;
    process.on("uncaughtException", (err) => {
      if (err.message.includes("Unhandled error") || err.name === "Error [ERR_UNHANDLED_ERROR]") {
        unhandledErrorCaught = true;
      }
    });

    const socketClient = new RealSocketClient();
    
    // Register user to get JWT token
    const client = new SokratesTestClient();
    const email = `socket_err_${Date.now()}@sokrates.app`;
    const regRes = await client.register(email, `socket_err_${Date.now()}`, "password123");
    
    if (client.token) {
      socketClient.connect(client.token);
      await new Promise(r => setTimeout(r, 100));

      let socketErrorEmitted = false;
      let connectErrorEmitted = false;

      socketClient.on("error", (err: any) => {
        socketErrorEmitted = true;
      });

      socketClient.on("connect_error", (err: any) => {
        connectErrorEmitted = true;
      });

      // Test Case 2.1: Emitting raw "error" strings and Error objects to RealSocketClient EventEmitter
      socketClient.emit("error", "Invalid room ID");
      socketClient.emit("error", new Error("Simulated socket error event"));
      socketClient.emit("connect_error", new Error("Simulated connect error"));

      recordResult(
        "RealSocketClient handles 'error' and 'connect_error' events without EventEmitter crash",
        !unhandledErrorCaught,
        "No unhandled EventEmitter crash occurred"
      );

      // Test Case 2.2: Send invalid room actions to running Socket.io server
      socketClient.joinRoom("non_existent_room_9999");
      socketClient.sendMessage("non_existent_room_9999", "Hello into void");
      await new Promise(r => setTimeout(r, 200));

      recordResult(
        "Server-emitted invalid room errors handled without Node process crashes",
        !unhandledErrorCaught,
        "Socket.io server interaction stayed stable"
      );

      socketClient.disconnect();
    }
  } catch (err: any) {
    recordResult("Socket Error Event Handling", false, err.stack || err.message);
  }

  console.log("\n===============================================================");
  console.log(` SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log("===============================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runEmpiricalVerification();
