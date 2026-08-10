import { verifyJwt, verifyPassword, signJwt, hashPassword } from "../lib/auth";
import { POST as loginHandler } from "../app/api/auth/login/route";

async function runM1AuthBypassEmpiricalVerification() {
  console.log("=================================================================");
  console.log("     EMPIRICAL VERIFICATION: M1 AUTHENTICATION SECURITY FIX     ");
  console.log("=================================================================\n");

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  function assertTest(name: string, condition: boolean, details?: string) {
    totalTests++;
    if (condition) {
      totalPassed++;
      console.log(`✅ [PASS] ${name}`);
    } else {
      totalFailed++;
      console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ""}`);
    }
  }

  // -------------------------------------------------------------------
  // 1. JWT BYPASS ATTACK VERIFICATIONS (`verifyJwt`)
  // -------------------------------------------------------------------
  console.log("--- 1. Testing verifyJwt Bypass Vectors ---");

  // 1a. Raw hardcoded mock/dummy token
  const res1 = verifyJwt("jwt_user123");
  assertTest("Raw 'jwt_user123' token rejected", res1 === null, `Got ${JSON.stringify(res1)}`);

  // 1b. Invalid HMAC signature
  const validToken = signJwt({ userId: "user123" });
  const parts = validToken.split(".");
  const invalidSigToken = `${parts[0]}.${parts[1]}.invalid_hmac_signature_bytes_12345`;
  const res2 = verifyJwt(invalidSigToken);
  assertTest("Invalid HMAC signature token rejected", res2 === null, `Got ${JSON.stringify(res2)}`);

  // 1c. Tampered token payload (privilege escalation attempt)
  const userToken = signJwt({ userId: "user_normal", role: "user" });
  const userParts = userToken.split(".");
  const tamperedPayloadStr = Buffer.from(JSON.stringify({ userId: "admin_user", role: "admin", iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 }))
    .toString("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const tamperedToken = `${userParts[0]}.${tamperedPayloadStr}.${userParts[2]}`; // payload tampered, original sig kept
  const res3 = verifyJwt(tamperedToken);
  assertTest("Tampered token payload (signature mismatch) rejected", res3 === null, `Got ${JSON.stringify(res3)}`);

  // 1d. 'none' algorithm header forgery attempt
  const noneHeaderStr = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }))
    .toString("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const noneAlgToken = `${noneHeaderStr}.${userParts[1]}.`;
  const res4 = verifyJwt(noneAlgToken);
  assertTest("'alg: none' token forgery rejected", res4 === null, `Got ${JSON.stringify(res4)}`);

  // 1e. Expired token
  const expiredToken = signJwt({ userId: "user_expired" }, -10000); // expired 10s ago
  const res5 = verifyJwt(expiredToken);
  assertTest("Expired token rejected", res5 === null, `Got ${JSON.stringify(res5)}`);

  // 1f. Empty/null string input
  const res6 = verifyJwt("");
  assertTest("Empty token string rejected", res6 === null, `Got ${JSON.stringify(res6)}`);

  // -------------------------------------------------------------------
  // 2. PASSWORD BYPASS ATTACK VERIFICATIONS (`verifyPassword`)
  // -------------------------------------------------------------------
  console.log("\n--- 2. Testing verifyPassword Bypass Vectors ---");

  const validPassword = "CorrectSuperSecretPassword2026!";
  const validHash = hashPassword(validPassword);

  // 2a. Plain text passed as combined hash
  const res2a = verifyPassword(validPassword, validPassword);
  assertTest("Plain text string passed as combinedHash returns false", res2a === false);

  const res2b = verifyPassword("password123", "password123");
  assertTest("Plain text password passed as both args returns false", res2b === false);

  // 2c. Incorrect password against valid hash
  const res2c = verifyPassword("WrongPassword123!", validHash);
  assertTest("Incorrect password against valid hash returns false", res2c === false);

  // 2d. Malformed hash format (missing salt separator or invalid length)
  const res2d1 = verifyPassword(validPassword, "nosalt_just_hash_string");
  assertTest("Single string without colon separator returns false", res2d1 === false);

  const res2d2 = verifyPassword(validPassword, "salt:hash:extra_part");
  assertTest("Combined hash with >2 parts returns false", res2d2 === false);

  const res2d3 = verifyPassword(validPassword, ":");
  assertTest("Combined hash ':' returns false", res2d3 === false);

  // 2e. Valid password against valid hash (sanity check)
  const res2e = verifyPassword(validPassword, validHash);
  assertTest("Valid password against valid hash returns true (sanity test)", res2e === true);

  // -------------------------------------------------------------------
  // 3. LOGIN API ENDPOINT BYPASS VERIFICATIONS (`POST /api/auth/login`)
  // -------------------------------------------------------------------
  console.log("\n--- 3. Testing Login API Endpoint Bypass Vectors ---");

  // 3a. Invalid credentials (incorrect password)
  const reqWrongPass = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@sokrates.app", password: "wrongPasswordAttempt" }),
  });
  const resWrongPass = await loginHandler(reqWrongPass);
  const bodyWrongPass = await resWrongPass.json();
  assertTest("Login with incorrect password returns 401 Unauthorized", resWrongPass.status === 401 && bodyWrongPass.error === "Invalid credentials");

  // 3b. Non-existent email
  const reqNonExistent = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent_user_99999@sokrates.app", password: "somePassword" }),
  });
  const resNonExistent = await loginHandler(reqNonExistent);
  const bodyNonExistent = await resNonExistent.json();
  assertTest("Login with non-existent user returns 401 Unauthorized", resNonExistent.status === 401 && bodyNonExistent.error === "Invalid credentials");

  // 3c. Plain text combined hash bypass attempt as password
  const reqHashAsPass = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@sokrates.app", password: validHash }),
  });
  const resHashAsPass = await loginHandler(reqHashAsPass);
  const bodyHashAsPass = await resHashAsPass.json();
  assertTest("Login passing raw hash as password returns 401 Unauthorized", resHashAsPass.status === 401 && bodyHashAsPass.error === "Invalid credentials");

  // 3d. Missing email or password (empty payload)
  const reqEmpty = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const resEmpty = await loginHandler(reqEmpty);
  assertTest("Login with empty payload returns 400 Bad Request", resEmpty.status === 400);

  // -------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(` SUMMARY: ${totalPassed}/${totalTests} tests passed (${totalFailed} failed)`);
  console.log("=================================================================");

  if (totalFailed > 0) {
    console.error("💥 M1 AUTH SECURITY EMPIRICAL VERIFICATION FAILED!");
    process.exit(1);
  } else {
    console.log("🎉 M1 AUTH SECURITY EMPIRICAL VERIFICATION PASSED SUCCESSFULLY!");
    process.exit(0);
  }
}

runM1AuthBypassEmpiricalVerification();
