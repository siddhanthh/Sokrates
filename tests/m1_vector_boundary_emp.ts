import { SokratesTestClient, generateInterestVector, cosineDistance } from "./harness";
import { generateFallbackEmbedding, generateEmbedding } from "../lib/ai/gemini";

async function runEmpiricalVerification() {
  console.log("=== EMPIRICAL VERIFICATION OF MILESTONE 1 VECTOR & BOUNDARY CONDITIONS ===\n");

  let passed = true;
  const logPass = (msg: string) => console.log(`✅ [PASS] ${msg}`);
  const logFail = (msg: string) => {
    console.error(`❌ [FAIL] ${msg}`);
    passed = false;
  };

  // 1. Vector Dimension & Normalization Verification: lib/ai/gemini.ts
  console.log("--- 1. Testing lib/ai/gemini.ts Embeddings ---");
  const testInputs = [
    { label: "Empty string", text: "" },
    { label: "Whitespace only", text: "   \t\n  " },
    { label: "Single topic", text: "Philosophy" },
    { label: "Multiple topics", text: "Philosophy Ethics Metaphysics Logic Epistemology" },
    { label: "Long text", text: "A".repeat(5000) },
    { label: "Special chars & unicode", text: "🧠 Sokrates §123 !@#$%^&*()_+" },
  ];

  for (const input of testInputs) {
    const vec = await generateEmbedding(input.text);
    
    // Check dimension
    if (vec.length !== 768) {
      logFail(`${input.label}: Dimension is ${vec.length}, expected 768`);
    } else {
      logPass(`${input.label}: Dimension is exactly 768`);
    }

    // Compute L2 norm
    const l2Norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    const isUnitNorm = Math.abs(l2Norm - 1.0) < 1e-5;

    if (!isUnitNorm) {
      logFail(`${input.label}: L2 norm is ${l2Norm.toFixed(6)}, expected 1.0`);
    } else {
      logPass(`${input.label}: L2 norm is ${l2Norm.toFixed(6)} (unit norm = 1.0)`);
    }
  }

  // 2. Vector Dimension & Normalization Verification: generateInterestVector
  console.log("\n--- 2. Testing generateInterestVector (Harness Engine) ---");
  const categoryInputs = [
    { label: "Empty category array", categories: [] },
    { label: "Single category", categories: ["Philosophy"] },
    { label: "Multiple categories", categories: ["Philosophy", "Ethics", "Metaphysics"] },
  ];

  for (const catInput of categoryInputs) {
    const vec = generateInterestVector(catInput.categories);

    if (vec.length !== 768) {
      logFail(`${catInput.label}: Dimension is ${vec.length}, expected 768`);
    } else {
      logPass(`${catInput.label}: Dimension is exactly 768`);
    }

    const l2Norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (catInput.categories.length === 0) {
      console.log(`ℹ️ [NOTE] Empty categories produce zero vector with L2 norm = ${l2Norm.toFixed(6)}`);
      // Dimension is still 768
      if (vec.length === 768) logPass("Empty categories returns 768-dim zero vector (graceful edge case)");
    } else {
      const isUnitNorm = Math.abs(l2Norm - 1.0) < 1e-5;
      if (!isUnitNorm) {
        logFail(`${catInput.label}: L2 norm is ${l2Norm.toFixed(6)}, expected 1.0`);
      } else {
        logPass(`${catInput.label}: L2 norm is ${l2Norm.toFixed(6)} (unit norm = 1.0)`);
      }
    }
  }

  // 3. Boundary Case: Empty Bio & Empty Interests via Test Client
  console.log("\n--- 3. Testing Client API Boundary Conditions ---");
  const client = new SokratesTestClient();
  const regRes = await client.register(`boundary_user_${Date.now()}@sokrates.app`, `boundary_usr_${Date.now()}`);

  if (regRes.status !== 201) {
    logFail(`User registration failed with status ${regRes.status}`);
  } else {
    logPass("User registration successful");
  }

  // 3a. Update with empty bio
  const emptyBioRes = await client.updateProfile({ bio: "" });
  if (emptyBioRes.status === 200 && emptyBioRes.body.user.bio === "") {
    logPass("Empty bio update handled gracefully with 200 OK");
  } else {
    logFail(`Empty bio update failed: status ${emptyBioRes.status}`);
  }

  // 3b. Update with whitespace bio
  const spaceBioRes = await client.updateProfile({ bio: "   " });
  if (spaceBioRes.status === 200) {
    logPass("Whitespace bio update handled gracefully with 200 OK");
  } else {
    logFail(`Whitespace bio update failed: status ${spaceBioRes.status}`);
  }

  // 3c. Update with empty interest categories
  const emptyIntRes = await client.updateInterests([]);
  if (emptyIntRes.status === 200 && emptyIntRes.body.user.interestCategories.length === 0) {
    logPass("Empty interest categories updated with 200 OK");
    if (emptyIntRes.body.user.interestVec.length === 768) {
      logPass("Empty interest category user vector retains 768 dimensions");
    } else {
      logFail(`Empty interest vector length is ${emptyIntRes.body.user.interestVec.length}`);
    }
  } else {
    logFail(`Empty interest category update failed: status ${emptyIntRes.status}`);
  }

  // 4. Invalid Token Handling
  console.log("\n--- 4. Testing Invalid Token Boundary Handling ---");
  const invalidTokens = [
    "invalid_fake_token_99999",
    "Bearer invalid_token",
    "jwt_expired_12345",
    "",
    "   ",
  ];

  for (const tok of invalidTokens) {
    const badClient = new SokratesTestClient();
    badClient.token = tok;
    const res = await badClient.getProfile();
    if (res.status === 401) {
      logPass(`Invalid token '${tok.substring(0, 15)}' rejected with 401 Unauthorized`);
    } else {
      logFail(`Invalid token '${tok}' returned status ${res.status}, expected 401`);
    }
  }

  // Socket Connection with invalid token
  let socketError = false;
  const badSocketClient = new SokratesTestClient();
  badSocketClient.token = "invalid_socket_token_777";
  badSocketClient.connectSocket();
  badSocketClient.socket?.on("error", (err: string) => {
    if (err.includes("Unauthorized")) socketError = true;
  });
  badSocketClient.socket?.connect("invalid_socket_token_777");
  await new Promise(r => setTimeout(r, 100));

  if (socketError) {
    logPass("Socket connection with invalid token rejected with Unauthorized error");
  } else {
    logFail("Socket connection with invalid token was NOT rejected");
  }

  console.log(`\n===============================================================`);
  console.log(passed ? "🎉 ALL EMPIRICAL VERIFICATION TESTS PASSED!" : "💥 SOME EMPIRICAL VERIFICATION TESTS FAILED!");
  console.log(`===============================================================`);

  if (!passed) process.exit(1);
}

runEmpiricalVerification();
