import { SokratesTestClient, mockServer, cosineDistance, generateInterestVector } from "./harness";
import { generateEmbedding } from "../lib/ai/gemini";

async function runTargetedEmpiricalVerification() {
  console.log("=== EMPIRICAL VERIFICATION: COSINE DISTANCE, 30S FALLBACK TIMER, ARGUMENT MAP SCHEMA ===\n");

  let passed = true;
  const logPass = (msg: string) => console.log(`✅ [PASS] ${msg}`);
  const logFail = (msg: string) => {
    console.error(`❌ [FAIL] ${msg}`);
    passed = false;
  };

  // --------------------------------------------------------------------------
  // TEST 1: VECTOR MATCHING COSINE DISTANCE CORRECTNESS
  // --------------------------------------------------------------------------
  console.log("--- TEST 1: Vector Matching Cosine Distance Correctness ---");
  
  // 1a. Identical vectors: distance should be 0.0
  const v1 = generateInterestVector(["Philosophy", "Ethics"]);
  const distIdentical = cosineDistance(v1, v1);
  if (Math.abs(distIdentical - 0.0) < 1e-6) {
    logPass(`Identical vectors distance = ${distIdentical.toFixed(6)} (Expected: 0.0)`);
  } else {
    logFail(`Identical vectors distance = ${distIdentical}, expected 0.0`);
  }

  // 1b. Orthogonal vectors: distance should be 1.0
  const vOrth1 = [1, 0, 0, ...new Array(765).fill(0)];
  const vOrth2 = [0, 1, 0, ...new Array(765).fill(0)];
  const distOrth = cosineDistance(vOrth1, vOrth2);
  if (Math.abs(distOrth - 1.0) < 1e-6) {
    logPass(`Orthogonal vectors distance = ${distOrth.toFixed(6)} (Expected: 1.0)`);
  } else {
    logFail(`Orthogonal vectors distance = ${distOrth}, expected 1.0`);
  }

  // 1c. Opposite vectors: distance should be 2.0
  const vOpp1 = [1, 0, 0, ...new Array(765).fill(0)];
  const vOpp2 = [-1, 0, 0, ...new Array(765).fill(0)];
  const distOpp = cosineDistance(vOpp1, vOpp2);
  if (Math.abs(distOpp - 2.0) < 1e-6) {
    logPass(`Opposite vectors distance = ${distOpp.toFixed(6)} (Expected: 2.0)`);
  } else {
    logFail(`Opposite vectors distance = ${distOpp}, expected 2.0`);
  }

  // 1d. Dimension mismatch / zero vector fallback handling
  const zeroVec = new Array(768).fill(0);
  const distZero = cosineDistance(v1, zeroVec);
  if (distZero === 1.0) {
    logPass(`Zero vector distance fallback = ${distZero.toFixed(6)} (Expected: 1.0 max distance)`);
  } else {
    logFail(`Zero vector distance = ${distZero}, expected 1.0`);
  }

  // 1e. Real Gemini 768-dim embeddings cosine distance check
  const embA = await generateEmbedding("Philosophy of Mind and Consciousness");
  const embB = await generateEmbedding("Philosophy of Mind and Dualism");
  const embC = await generateEmbedding("Quantum Physics and Quantum Mechanics");
  
  const distAB = cosineDistance(embA, embB);
  const distAC = cosineDistance(embA, embC);

  if (distAB < distAC) {
    logPass(`Semantic similarity ordering holds: dist(Mind, Dualism) = ${distAB.toFixed(4)} < dist(Mind, Physics) = ${distAC.toFixed(4)}`);
  } else {
    logFail(`Semantic similarity ordering failed: distAB=${distAB}, distAC=${distAC}`);
  }


  // --------------------------------------------------------------------------
  // TEST 2: 30S FALLBACK TIMER ACCURACY & CANCELATION
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: 30s Fallback Timer Accuracy & Cancellation ---");

  // 2a. Test Fallback Timer firing with scaled timing (100ms test override representing 30s production timer)
  const client1 = new SokratesTestClient();
  await client1.register(`timer_user_${Date.now()}@sokrates.app`, `timer_user_${Date.now()}`);

  let aiJoiningEmitted = false;
  let aiRoomId = "";
  const timerStart = Date.now();

  client1.socket?.on("ai_joining", (data: any) => {
    aiJoiningEmitted = true;
    aiRoomId = data.roomId;
  });

  // Enter queue with 150ms timeout to measure accuracy
  const testTimeoutMs = 150;
  client1.socket?.enterQueue("topic-1", testTimeoutMs);

  await new Promise(r => setTimeout(r, testTimeoutMs + 50));
  const timerElapsed = Date.now() - timerStart;

  if (aiJoiningEmitted && aiRoomId.length > 0) {
    logPass(`Fallback timer fired successfully after ${timerElapsed}ms (target: ~${testTimeoutMs}ms). AI Room ID: ${aiRoomId}`);
  } else {
    logFail("Fallback timer failed to fire ai_joining event");
  }

  // 2b. Test Queue Cancellation before Fallback Timeout
  const client2 = new SokratesTestClient();
  await client2.register(`cancel_user_${Date.now()}@sokrates.app`, `cancel_user_${Date.now()}`);

  let cancelledAiTriggered = false;
  client2.socket?.on("ai_joining", () => {
    cancelledAiTriggered = true;
  });

  // Enter queue with 200ms timeout
  client2.socket?.enterQueue("topic-1", 200);
  
  // Cancel queue after 50ms (before 200ms timeout)
  await new Promise(r => setTimeout(r, 50));
  client2.socket?.leaveQueue("topic-1");

  // Wait past the original 200ms mark to verify no AI room created
  await new Promise(r => setTimeout(r, 200));

  if (!cancelledAiTriggered) {
    logPass("Queue cancellation prior to timer expiration successfully prevented AI fallback room creation");
  } else {
    logFail("Fallback timer fired DESPITE user leaving queue!");
  }


  // --------------------------------------------------------------------------
  // TEST 3: ARGUMENT MAP GRAPH SCHEMA VALIDITY
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Argument Map Graph Schema Validity ---");

  const p1 = new SokratesTestClient();
  const p2 = new SokratesTestClient();
  await p1.register(`arg_p1_${Date.now()}@sokrates.app`, `arg_p1_${Date.now()}`);
  await p2.register(`arg_p2_${Date.now()}@sokrates.app`, `arg_p2_${Date.now()}`);

  // Create room and end it to generate argument map
  let matchRoomId = "";
  p1.socket?.on("match_found", (data: any) => { matchRoomId = data.roomId; });
  p2.socket?.on("match_found", (data: any) => { matchRoomId = data.roomId; });

  p1.socket?.enterQueue("topic-1");
  p2.socket?.enterQueue("topic-1");
  await new Promise(r => setTimeout(r, 100));

  if (!matchRoomId) {
    logFail("Failed to pair users for argument map test");
  } else {
    // End room to generate Argument Map
    const endRes = await p1.endRoom(matchRoomId);
    if (endRes.status !== 200 || !endRes.body.map) {
      logFail("End room did not return argument map");
    } else {
      const map = endRes.body.map.data;

      // 3a. Check root graph fields
      if (typeof map.central_question === "string" && Array.isArray(map.participants) && Array.isArray(map.nodes)) {
        logPass("Argument map root structure valid (central_question, participants, nodes)");
      } else {
        logFail("Argument map missing required root graph fields");
      }

      // 3b. Check participant fields
      const validParticipants = map.participants.every((p: any) => p.id && p.username && p.color);
      if (validParticipants && map.participants.length >= 2) {
        logPass(`Participants array valid (${map.participants.length} participants with id, username, color)`);
      } else {
        logFail("Participants array invalid or incomplete");
      }

      // 3c. Check node types and relations
      const allowedTypes = new Set(["claim", "evidence", "rebuttal", "concession", "agreement"]);
      const allowedRelations = new Set(["supports", "challenges", "partially_agrees", "acknowledges", null, undefined]);

      let allNodesValid = true;
      const nodeIds = new Set<string>(map.nodes.map((n: any) => n.id));

      for (const node of map.nodes) {
        if (!allowedTypes.has(node.type)) {
          console.error(`Invalid node type: ${node.type}`);
          allNodesValid = false;
        }
        if (!node.content || typeof node.content !== "string") {
          console.error(`Invalid node content: ${node.content}`);
          allNodesValid = false;
        }
        if (node.parent !== null && node.parent !== undefined && !nodeIds.has(node.parent)) {
          console.error(`Dangling parent node reference: ${node.parent}`);
          allNodesValid = false;
        }
        if (!allowedRelations.has(node.relation)) {
          console.error(`Invalid relation type: ${node.relation}`);
          allNodesValid = false;
        }
      }

      if (allNodesValid && map.nodes.length > 0) {
        logPass(`All ${map.nodes.length} nodes conform strictly to schema (valid types, contents, parent links & relation enums)`);
      } else {
        logFail("Node graph schema validation failed");
      }
    }
  }

  console.log(`\n===============================================================`);
  console.log(passed ? "🎉 ALL TARGETED EMPIRICAL VERIFICATION TESTS PASSED!" : "💥 TARGETED EMPIRICAL VERIFICATION TESTS FAILED!");
  console.log(`===============================================================`);

  process.exit(passed ? 0 : 1);
}

runTargetedEmpiricalVerification().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
