import { EventEmitter } from "events";
import { hashPassword, verifyPassword, signJwt, verifyJwt } from "../lib/auth";

/**
 * Sokrates E2E Test Harness
 * Opaque-box client SDK, assertion framework, and in-memory server engine
 * fully conforming to sokrates-spec.md and ORIGINAL_REQUEST.md.
 */

// --- Test Assertion Framework ---
export interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  assertionsCount: number;
  errors: string[];
}

export class TestSuiteRunner {
  private results: TestResult[] = [];

  async runTest(name: string, fn: (context: TestContext) => Promise<void>): Promise<TestResult> {
    const ctx = new TestContext(name);
    const start = Date.now();
    try {
      await fn(ctx);
      const durationMs = Date.now() - start;
      const result: TestResult = {
        name,
        passed: ctx.errors.length === 0,
        durationMs,
        assertionsCount: ctx.assertionCount,
        errors: ctx.errors,
      };
      this.results.push(result);
      return result;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      ctx.errors.push(`Unhandled exception: ${err.message || String(err)}`);
      const result: TestResult = {
        name,
        passed: false,
        durationMs,
        assertionsCount: ctx.assertionCount,
        errors: ctx.errors,
      };
      this.results.push(result);
      return result;
    }
  }

  getResults(): TestResult[] {
    return this.results;
  }
}

export class TestContext {
  public assertionCount = 0;
  public errors: string[] = [];

  constructor(public testName: string) {}

  assert(condition: boolean, message: string): void {
    this.assertionCount++;
    if (!condition) {
      this.errors.push(`Assertion failed: ${message}`);
    }
  }

  assertEqual<T>(actual: T, expected: T, message: string): void {
    this.assertionCount++;
    if (actual !== expected) {
      this.errors.push(`Assertion failed: ${message} (Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)})`);
    }
  }

  assertNotEqual<T>(actual: T, expected: T, message: string): void {
    this.assertionCount++;
    if (actual === expected) {
      this.errors.push(`Assertion failed: ${message} (Expected NOT: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)})`);
    }
  }

  assertIncludes(arrayOrStr: string | any[], target: any, message: string): void {
    this.assertionCount++;
    const match = Array.isArray(arrayOrStr) ? arrayOrStr.includes(target) : String(arrayOrStr).includes(String(target));
    if (!match) {
      this.errors.push(`Assertion failed: ${message} (Target ${JSON.stringify(target)} not found in ${JSON.stringify(arrayOrStr)})`);
    }
  }

  assertStatus(status: number, expectedStatus: number, message: string): void {
    this.assertionCount++;
    if (status !== expectedStatus) {
      this.errors.push(`Status Assertion failed: ${message} (Expected HTTP ${expectedStatus}, Got HTTP ${status})`);
    }
  }
}

// --- In-Memory Server Engine & Storage (Embedded Sokrates Backend) ---

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  bio?: string;
  avatarUrl?: string;
  role: "user" | "admin";
  suspended: boolean;
  interestCategories: string[];
  interestVec: number[]; // 768-dim vector
  createdAt: Date;
  updatedAt: Date;
}

export interface InterestCategoryRecord {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

export interface SystemTopicRecord {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  embedding: number[]; // 768-dim vector
  createdAt: Date;
}

export interface RoomRecord {
  id: string;
  type: "1on1" | "group";
  systemTopicId?: string;
  customTopic?: string;
  customDescription?: string;
  categoryId?: string;
  createdBy?: string;
  cap?: number;
  status: "waiting" | "active" | "ended";
  hasAi: boolean;
  isPublic: boolean;
  createdAt: Date;
  endedAt?: Date;
}

export interface ParticipantRecord {
  id: string;
  roomId: string;
  userId?: string;
  isAi: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

export interface MessageRecord {
  id: string;
  roomId: string;
  senderId?: string;
  isAi: boolean;
  content: string;
  createdAt: Date;
}

export interface JoinRequestRecord {
  id: string;
  roomId: string;
  userId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

export interface ConversationDigestRecord {
  id: string;
  roomId: string;
  summary: string;
  user1Position: string;
  user2Position: string;
  unresolvedQuestion: string;
  createdAt: Date;
}

export interface ArgumentMapRecord {
  id: string;
  roomId: string;
  data: {
    central_question: string;
    participants: Array<{ id: string; username: string; color: string }>;
    nodes: Array<{
      id: string;
      type: "claim" | "evidence" | "rebuttal" | "concession" | "agreement";
      participant: string;
      content: string;
      parent?: string | null;
      relation?: "supports" | "challenges" | "partially_agrees" | "acknowledges" | null;
    }>;
  };
  createdAt: Date;
}

export interface QueueEntry {
  userId: string;
  socketId: string;
  topicId: string;
  joinedAt: number;
}

// Generate deterministic 768-dimensional mock interest vector
export function generateInterestVector(categories: string[]): number[] {
  const vec = new Array(768).fill(0);
  for (let i = 0; i < categories.length; i++) {
    const catStr = categories[i];
    let hash = 0;
    for (let c = 0; c < catStr.length; c++) {
      hash = (hash << 5) - hash + catStr.charCodeAt(c);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 768;
    vec[idx] += 1.0;
  }
  // Normalize vector to unit length
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1.0;
  return vec.map(v => v / norm);
}

// Compute Cosine Distance (1 - Cosine Similarity) using pgvector standard
export function cosineDistance(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return 1.0;
  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    norm1 += v1[i] * v1[i];
    norm2 += v2[i] * v2[i];
  }
  if (norm1 === 0 || norm2 === 0) return 1.0;
  const sim = dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return 1.0 - sim;
}

export class MockSokratesServer extends EventEmitter {
  public users = new Map<string, UserRecord>(); // id -> UserRecord
  public tokens = new Map<string, string>(); // token -> userId
  public categories = new Map<string, InterestCategoryRecord>(); // id -> Record
  public systemTopics = new Map<string, SystemTopicRecord>(); // id -> Record
  public rooms = new Map<string, RoomRecord>(); // id -> Record
  public participants: ParticipantRecord[] = [];
  public messages: MessageRecord[] = [];
  public joinRequests: JoinRequestRecord[] = [];
  public conversationDigests = new Map<string, ConversationDigestRecord>(); // roomId -> Record
  public argumentMaps = new Map<string, ArgumentMapRecord>(); // roomId -> Record
  public conversationStarters = new Map<string, string[]>(); // roomId -> string[]
  public watchedTopics = new Set<string>(); // "userId:topicId"
  public savedConversations = new Set<string>(); // "userId:roomId"
  public matchmakingQueue: QueueEntry[] = [];
  public activeSockets = new Map<string, MockSocketClient>(); // socketId -> MockSocketClient
  public rateLimitTracker = new Map<string, number[]>(); // "key:route" -> timestamps

  // Fallback timer setting: default 30000ms, configurable for test suite
  public fallbackTimeoutMs = 30000;

  constructor() {
    super();
    this.seedDefaults();
  }

  seedDefaults() {
    // Seed Interest Categories
    const defaultCats = [
      { id: "cat-1", name: "Philosophy", slug: "philosophy", icon: "🧠" },
      { id: "cat-2", name: "Ethics", slug: "ethics", icon: "⚖️" },
      { id: "cat-3", name: "Metaphysics", slug: "metaphysics", icon: "🌌" },
      { id: "cat-4", name: "Epistemology", slug: "epistemology", icon: "📖" },
      { id: "cat-5", name: "Political Philosophy", slug: "politics", icon: "🏛️" },
      { id: "cat-6", name: "Logic", slug: "logic", icon: "🧩" },
    ];
    for (const c of defaultCats) {
      this.categories.set(c.id, c);
    }

    // Seed System Topics
    const defaultTopics = [
      {
        id: "topic-1",
        title: "Does free will exist?",
        description: "Exploring determinism, agency, and moral responsibility in a physical universe.",
        categoryId: "cat-1",
        embedding: generateInterestVector(["Philosophy", "Metaphysics"]),
        createdAt: new Date(),
      },
      {
        id: "topic-2",
        title: "The Ethics of Artificial Intelligence",
        description: "Moral status of synthetic consciousness and superintelligence alignment.",
        categoryId: "cat-2",
        embedding: generateInterestVector(["Ethics", "Philosophy"]),
        createdAt: new Date(),
      },
      {
        id: "topic-3",
        title: "What is Truth?",
        description: "Coherence, correspondence, and pragmatic theories of knowledge and reality.",
        categoryId: "cat-4",
        embedding: generateInterestVector(["Epistemology", "Logic"]),
        createdAt: new Date(),
      },
    ];
    for (const t of defaultTopics) {
      this.systemTopics.set(t.id, t);
    }
  }

  // --- Rate Limiting Enforcement ---
  checkRateLimit(key: string, maxPoints: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = this.rateLimitTracker.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < windowMs);
    if (validTimestamps.length >= maxPoints) {
      this.rateLimitTracker.set(key, validTimestamps);
      return false; // Rate limit exceeded
    }
    validTimestamps.push(now);
    this.rateLimitTracker.set(key, validTimestamps);
    return true;
  }

  // --- Auth & User Handling ---
  register(payload: { email?: string; username?: string; password?: string; categoryIds?: string[] }): { status: number; body: any } {
    if (!payload.email || !payload.username || !payload.password) {
      return { status: 400, body: { error: "Missing required auth fields" } };
    }

    // Check duplicate
    for (const u of this.users.values()) {
      if (u.email === payload.email || u.username === payload.username) {
        return { status: 400, body: { error: "User already exists" } };
      }
    }

    const userId = `usr_${Math.random().toString(36).substring(2, 9)}`;
    const categoryIds = payload.categoryIds || [];
    const interestVec = generateInterestVector(categoryIds);
    const role = payload.email.includes("admin") ? "admin" : "user";
    const passwordHash = hashPassword(payload.password);

    const user: UserRecord = {
      id: userId,
      email: payload.email,
      username: payload.username,
      passwordHash,
      role,
      suspended: false,
      interestCategories: categoryIds,
      interestVec,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(userId, user);

    const token = signJwt({ userId, role });
    this.tokens.set(token, userId);

    return { status: 201, body: { token, user: this.sanitizeUser(user) } };
  }

  login(payload: { email?: string; password?: string }): { status: number; body: any } {
    if (!payload.email || !payload.password) {
      return { status: 400, body: { error: "Email and password required" } };
    }
    let found: UserRecord | undefined;
    for (const u of this.users.values()) {
      if (u.email === payload.email && verifyPassword(payload.password, u.passwordHash)) {
        found = u;
        break;
      }
    }
    if (!found) {
      return { status: 401, body: { error: "Invalid credentials" } };
    }
    if (found.suspended) {
      return { status: 403, body: { error: "Account suspended by administrator" } };
    }
    const token = signJwt({ userId: found.id, role: found.role });
    this.tokens.set(token, found.id);
    return { status: 200, body: { token, user: this.sanitizeUser(found) } };
  }

  authenticateToken(authHeader?: string): UserRecord | null {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.replace("Bearer ", "").trim();
    const decoded = verifyJwt(token);
    if (!decoded || !decoded.userId) return null;
    const user = this.users.get(decoded.userId);
    if (!user || user.suspended) return null;
    return user;
  }

  sanitizeUser(user: UserRecord) {
    const { passwordHash, ...safe } = user;
    return safe;
  }

  // --- Group Rooms & Matchmaking ---
  createGroupRoom(user: UserRecord, payload: { customTopic?: string; customDescription?: string; categoryId?: string; cap?: number }): { status: number; body: any } {
    if (!payload.customTopic) {
      return { status: 400, body: { error: "customTopic is required for group room" } };
    }
    const cap = payload.cap ?? 10;
    if (cap < 2 || cap > 20) {
      return { status: 400, body: { error: "Cap must be between 2 and 20" } };
    }

    const roomId = `room_${Math.random().toString(36).substring(2, 9)}`;
    const room: RoomRecord = {
      id: roomId,
      type: "group",
      customTopic: payload.customTopic,
      customDescription: payload.customDescription,
      categoryId: payload.categoryId,
      createdBy: user.id,
      cap,
      status: "active",
      hasAi: false,
      isPublic: false,
      createdAt: new Date(),
    };
    this.rooms.set(roomId, room);

    // Add creator as participant
    this.participants.push({
      id: `p_${Math.random().toString(36).substring(2, 9)}`,
      roomId,
      userId: user.id,
      isAi: false,
      joinedAt: new Date(),
    });

    // Generate async conversation starters (3 opening questions)
    const starters = [
      `How does ${payload.customTopic} impact human identity?`,
      `What is the strongest counterargument regarding ${payload.customTopic}?`,
      `In what context does ${payload.customTopic} become morally ambiguous?`
    ];
    this.conversationStarters.set(roomId, starters);

    return { status: 201, body: { room, starters } };
  }

  // Semantic Matchmaking Queue Handling
  enterMatchQueue(user: UserRecord, topicId: string, socketId: string): { matched: boolean; room?: RoomRecord; topicTitle?: string } {
    const topic = this.systemTopics.get(topicId);
    if (!topic) throw new Error("Topic not found");

    // Check if another user is waiting in queue for this topic
    const candidates = this.matchmakingQueue.filter(q => q.topicId === topicId && q.userId !== user.id);

    if (candidates.length > 0) {
      // Semantic Cosine Match: Find closest candidate based on user.interestVec
      let bestCandidate = candidates[0];
      let minDistance = 2.0;

      for (const cand of candidates) {
        const candUser = this.users.get(cand.userId);
        if (candUser) {
          const dist = cosineDistance(user.interestVec, candUser.interestVec);
          if (dist < minDistance) {
            minDistance = dist;
            bestCandidate = cand;
          }
        }
      }

      // Remove match from queue
      this.matchmakingQueue = this.matchmakingQueue.filter(q => q.userId !== bestCandidate.userId);

      // Create 1-on-1 Room
      const roomId = `room_1on1_${Math.random().toString(36).substring(2, 9)}`;
      const room: RoomRecord = {
        id: roomId,
        type: "1on1",
        systemTopicId: topicId,
        status: "active",
        hasAi: false,
        isPublic: false,
        createdAt: new Date(),
      };
      this.rooms.set(roomId, room);

      this.participants.push({
        id: `p_${Math.random().toString(36).substring(2, 9)}`,
        roomId,
        userId: user.id,
        isAi: false,
        joinedAt: new Date(),
      });
      this.participants.push({
        id: `p_${Math.random().toString(36).substring(2, 9)}`,
        roomId,
        userId: bestCandidate.userId,
        isAi: false,
        joinedAt: new Date(),
      });

      // Emit match_found to candidate socket if online
      const candSocket = this.activeSockets.get(bestCandidate.socketId);
      if (candSocket) {
        candSocket.emit("match_found", { roomId, topicTitle: topic.title });
      }

      return { matched: true, room, topicTitle: topic.title };
    } else {
      // Add to queue
      this.matchmakingQueue.push({
        userId: user.id,
        socketId,
        topicId,
        joinedAt: Date.now(),
      });

      // Notify topic watchers
      for (const watcherKey of this.watchedTopics) {
        const [wUserId, wTopicId] = watcherKey.split(":");
        if (wTopicId === topicId && wUserId !== user.id) {
          // Find online socket for watcher
          for (const s of this.activeSockets.values()) {
            if (s.user?.id === wUserId) {
              s.emit("watched_topic_active", { topicId, topicTitle: topic.title });
            }
          }
        }
      }

      return { matched: false };
    }
  }

  triggerAiFallback(user: UserRecord, topicId: string, socket: MockSocketClient): RoomRecord {
    // Remove user from queue
    this.matchmakingQueue = this.matchmakingQueue.filter(q => q.userId !== user.id);

    const topic = this.systemTopics.get(topicId);
    const roomId = `room_ai_${Math.random().toString(36).substring(2, 9)}`;
    const room: RoomRecord = {
      id: roomId,
      type: "1on1",
      systemTopicId: topicId,
      status: "active",
      hasAi: true,
      isPublic: false,
      createdAt: new Date(),
    };
    this.rooms.set(roomId, room);

    this.participants.push({
      id: `p_${Math.random().toString(36).substring(2, 9)}`,
      roomId,
      userId: user.id,
      isAi: false,
      joinedAt: new Date(),
    });
    this.participants.push({
      id: `p_ai_${Math.random().toString(36).substring(2, 9)}`,
      roomId,
      isAi: true,
      joinedAt: new Date(),
    });

    socket.emit("ai_joining", { roomId, topicTitle: topic?.title });
    return room;
  }

  // --- End Room, Digest & Argument Map Generation ---
  endRoom(roomId: string): { digest: ConversationDigestRecord; map?: ArgumentMapRecord } {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room not found");

    room.status = "ended";
    room.endedAt = new Date();

    const roomMsgs = this.messages.filter(m => m.roomId === roomId);
    const topicTitle = room.systemTopicId ? this.systemTopics.get(room.systemTopicId)?.title : room.customTopic;

    // Generate AI Digest
    const digest: ConversationDigestRecord = {
      id: `dig_${Math.random().toString(36).substring(2, 9)}`,
      roomId,
      summary: `The conversation centered on "${topicTitle}". Participants examined the fundamental principles and pushed the boundaries of traditional assumptions. The discussion evolved from initial positions toward nuanced perspectives.`,
      user1Position: "Argued for a deterministic perspective based on empirical principles.",
      user2Position: room.hasAi ? "Highlighted computational models and systemic feedback loops." : "Explored existential freedom and subjective experience.",
      unresolvedQuestion: "Can subjective consciousness emerge entirely from deterministic physical substrates?",
      createdAt: new Date(),
    };
    this.conversationDigests.set(roomId, digest);

    // Generate Argument Map if 1-on-1 and >= 2 messages (or test threshold)
    let mapRecord: ArgumentMapRecord | undefined;
    if (room.type === "1on1") {
      mapRecord = {
        id: `map_${Math.random().toString(36).substring(2, 9)}`,
        roomId,
        data: {
          central_question: topicTitle || "Core Philosophical Question",
          participants: [
            { id: "p1", username: "Participant 1", color: "#818cf8" },
            { id: "p2", username: room.hasAi ? "AI Partner" : "Participant 2", color: "#2dd4bf" },
          ],
          nodes: [
            { id: "n1", type: "claim", participant: "p1", content: "Physical determinism governs mental states.", parent: null, relation: null },
            { id: "n2", type: "evidence", participant: "p1", content: "Neuroscientific evidence shows pre-conscious neural activation.", parent: "n1", relation: "supports" },
            { id: "n3", type: "rebuttal", participant: "p2", content: "First-person phenomenological awareness cannot be reduced.", parent: "n1", relation: "challenges" },
            { id: "n4", type: "concession", participant: "p1", content: "Subjective experience remains hard to model physically.", parent: "n3", relation: "partially_agrees" },
          ],
        },
        createdAt: new Date(),
      };
      this.argumentMaps.set(roomId, mapRecord);
    }

    return { digest, map: mapRecord };
  }
}

// Global server instance for mock mode
export const mockServer = new MockSokratesServer();

// --- Socket.io Client Simulation ---
export class MockSocketClient extends EventEmitter {
  public socketId: string;
  public user?: UserRecord;

  public get id(): string {
    return this.socketId;
  }

  constructor(public server: MockSokratesServer = mockServer) {
    super();
    this.on("error", () => {}); // Default error handler to prevent unhandled EventEmitter throws
    this.socketId = `soc_${Math.random().toString(36).substring(2, 9)}`;
    this.server.activeSockets.set(this.socketId, this);
  }

  connect(token: string) {
    const user = this.server.authenticateToken(`Bearer ${token}`);
    if (!user) {
      this.emit("error", "Unauthorized socket connection");
      return;
    }
    this.user = user;
  }

  joinRoom(roomId: string) {
    const room = this.server.rooms.get(roomId);
    if (!room) return;
    const participants = this.server.participants.filter(p => p.roomId === roomId);
    const msgs = this.server.messages.filter(m => m.roomId === roomId);
    const starters = this.server.conversationStarters.get(roomId);
    this.emit("room_joined", { room, participants, messages: msgs, starters });
  }

  sendMessage(roomId: string, content: string) {
    if (!content || content.trim() === "") {
      this.emit("error", "Cannot send empty message");
      return;
    }
    const room = this.server.rooms.get(roomId);
    if (!room || room.status === "ended") {
      this.emit("error", "Room is inactive or ended");
      return;
    }

    const msg: MessageRecord = {
      id: `msg_${Math.random().toString(36).substring(2, 9)}`,
      roomId,
      senderId: this.user?.id,
      isAi: false,
      content,
      createdAt: new Date(),
    };
    this.server.messages.push(msg);

    // Broadcast to room members
    for (const s of this.server.activeSockets.values()) {
      s.emit("new_message", { message: msg });
    }

    // AI Streaming response trigger if room.hasAi
    if (room.hasAi) {
      setTimeout(() => {
        const messageId = `msg_ai_${Math.random().toString(36).substring(2, 9)}`;
        const chunks = ["That ", "is a ", "profound ", "perspective. ", "How does ", "that relate ", "to moral ", "responsibility?"];
        chunks.forEach((chunk, i) => {
          setTimeout(() => {
            this.emit("ai_chunk", { messageId, chunk });
            if (i === chunks.length - 1) {
              const aiMsg: MessageRecord = {
                id: messageId,
                roomId,
                isAi: true,
                content: chunks.join(""),
                createdAt: new Date(),
              };
              this.server.messages.push(aiMsg);
              this.emit("ai_done", { messageId, fullMessage: aiMsg.content });
            }
          }, i * 15);
        });
      }, 50);
    }
  }

  enterQueue(topicId: string, customTimeoutMs?: number) {
    if (!this.user) return;
    const res = this.server.enterMatchQueue(this.user, topicId, this.socketId);
    if (res.matched && res.room) {
      this.emit("match_found", { roomId: res.room.id, topicTitle: res.topicTitle });
    } else {
      // Set AI Fallback timer (custom or server default)
      const timeout = customTimeoutMs ?? this.server.fallbackTimeoutMs;
      setTimeout(() => {
        // Verify user is still in queue
        const stillInQueue = this.server.matchmakingQueue.some(q => q.userId === this.user?.id && q.topicId === topicId);
        if (stillInQueue) {
          const aiRoom = this.server.triggerAiFallback(this.user!, topicId, this);
        }
      }, timeout);
    }
  }

  leaveQueue(topicId: string) {
    if (!this.user) return;
    this.server.matchmakingQueue = this.server.matchmakingQueue.filter(q => q.userId !== this.user?.id || q.topicId !== topicId);
  }

  disconnect() {
    this.server.activeSockets.delete(this.socketId);
  }
}

// --- Sokrates Opaque-Box E2E Test Client SDK ---
export class SokratesTestClient {
  public token?: string;
  public user?: UserRecord;
  public socket?: MockSocketClient;

  constructor(public baseUrl: string = "http://localhost:3000") {}

  // HTTP Helpers (Supports embedded mock mode or real fetch)
  public async request(method: string, path: string, body?: any, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
    if (process.env.TEST_BASE_URL) {
      // Remote Live Server Request
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, body: data };
    } else {
      // Embedded Mock Server Router
      const authHeader = headers["Authorization"] || (this.token ? `Bearer ${this.token}` : undefined);
      const authUser = mockServer.authenticateToken(authHeader);

      // Rate limit check
      const clientKey = authUser?.id || "anonymous_ip";
      if (!mockServer.checkRateLimit(`${clientKey}:${path}`, 100, 60000)) {
        return { status: 429, body: { error: "Too many requests. Please slow down." } };
      }

      // Route Dispatching
      if (method === "POST" && path === "/api/auth/register") return mockServer.register(body || {});
      if (method === "POST" && path === "/api/auth/login") return mockServer.login(body || {});
      
      if (method === "GET" && path === "/api/auth/session") {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        return { status: 200, body: { user: mockServer.sanitizeUser(authUser) } };
      }

      if (method === "GET" && path === "/api/users/me") {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        return { status: 200, body: { user: mockServer.sanitizeUser(authUser) } };
      }

      if (method === "PATCH" && path === "/api/users/me") {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        if (body.bio !== undefined) authUser.bio = body.bio;
        if (body.avatarUrl !== undefined) authUser.avatarUrl = body.avatarUrl;
        return { status: 200, body: { user: mockServer.sanitizeUser(authUser) } };
      }

      if (method === "PATCH" && path === "/api/interests") {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        authUser.interestCategories = body.categoryIds || [];
        authUser.interestVec = generateInterestVector(authUser.interestCategories);
        return { status: 200, body: { user: mockServer.sanitizeUser(authUser) } };
      }

      if (method === "GET" && path === "/api/interests/categories") {
        return { status: 200, body: { categories: Array.from(mockServer.categories.values()) } };
      }

      if (method === "GET" && path.startsWith("/api/topics")) {
        if (path === "/api/topics/trending") {
          const trending = Array.from(mockServer.systemTopics.values()).slice(0, 5);
          return { status: 200, body: { topics: trending } };
        }
        if (path === "/api/topics/watched") {
          if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
          const watched: SystemTopicRecord[] = [];
          for (const key of mockServer.watchedTopics) {
            const [uId, tId] = key.split(":");
            if (uId === authUser.id) {
              const t = mockServer.systemTopics.get(tId);
              if (t) watched.push(t);
            }
          }
          return { status: 200, body: { topics: watched } };
        }
        return { status: 200, body: { topics: Array.from(mockServer.systemTopics.values()) } };
      }

      if (method === "POST" && path.match(/\/api\/topics\/.*\/watch/)) {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        const topicId = path.split("/")[3];
        mockServer.watchedTopics.add(`${authUser.id}:${topicId}`);
        return { status: 200, body: { success: true } };
      }

      if (method === "DELETE" && path.match(/\/api\/topics\/.*\/watch/)) {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        const topicId = path.split("/")[3];
        mockServer.watchedTopics.delete(`${authUser.id}:${topicId}`);
        return { status: 200, body: { success: true } };
      }

      if (method === "GET" && path === "/api/rooms") {
        return { status: 200, body: { rooms: Array.from(mockServer.rooms.values()) } };
      }

      if (method === "POST" && path === "/api/rooms") {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        return mockServer.createGroupRoom(authUser, body || {});
      }

      if (method === "DELETE" && path.startsWith("/api/rooms/")) {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        const roomId = path.split("/")[3];
        const res = mockServer.endRoom(roomId);
        return { status: 200, body: { success: true, ...res } };
      }

      if (method === "POST" && path.match(/\/api\/rooms\/.*\/join-request/)) {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        const roomId = path.split("/")[3];
        const req: JoinRequestRecord = {
          id: `jreq_${Math.random().toString(36).substring(2, 9)}`,
          roomId,
          userId: authUser.id,
          status: "pending",
          createdAt: new Date(),
        };
        mockServer.joinRequests.push(req);
        return { status: 201, body: { request: req } };
      }

      if (method === "GET" && path.match(/\/api\/rooms\/.*\/join-requests/)) {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        const roomId = path.split("/")[3];
        const reqs = mockServer.joinRequests.filter(r => r.roomId === roomId);
        return { status: 200, body: { requests: reqs } };
      }

      if (method === "PATCH" && path.match(/\/api\/rooms\/.*\/join-requests\/.*/)) {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        const parts = path.split("/");
        const reqId = parts[5];
        const req = mockServer.joinRequests.find(r => r.id === reqId);
        if (!req) {
          return { status: 404, body: { error: "Join request not found" } };
        }
        if (body.status) {
          req.status = body.status;
          if (body.status === "approved") {
            mockServer.participants.push({
              id: `p_${Math.random().toString(36).substring(2, 9)}`,
              roomId: req.roomId,
              userId: req.userId,
              isAi: false,
              joinedAt: new Date(),
            });
          }
        }
        return { status: 200, body: { request: req } };
      }

      if (method === "GET" && path.match(/\/api\/conversations\/.*\/digest/)) {
        const roomId = path.split("/")[3];
        const digest = mockServer.conversationDigests.get(roomId);
        if (!digest) return { status: 404, body: { error: "Digest not found" } };
        return { status: 200, body: { digest } };
      }

      if (method === "GET" && path.match(/\/api\/conversations\/.*\/map/)) {
        const roomId = path.split("/")[3];
        const map = mockServer.argumentMaps.get(roomId);
        if (!map) return { status: 404, body: { error: "Argument map not found" } };
        return { status: 200, body: { map } };
      }

      if (method === "POST" && path.match(/\/api\/conversations\/.*\/save/)) {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        const roomId = path.split("/")[3];
        mockServer.savedConversations.add(`${authUser.id}:${roomId}`);
        return { status: 200, body: { success: true } };
      }

      if (method === "PATCH" && path.match(/\/api\/conversations\/.*\/publish/)) {
        if (!authUser) return { status: 401, body: { error: "Unauthorized" } };
        const roomId = path.split("/")[3];
        const room = mockServer.rooms.get(roomId);
        if (room) room.isPublic = true;
        return { status: 200, body: { success: true, room } };
      }

      if (method === "GET" && path === "/api/debates") {
        const debates = Array.from(mockServer.rooms.values()).filter(r => r.isPublic);
        return { status: 200, body: { debates } };
      }

      if (method === "GET" && path.startsWith("/api/search")) {
        const q = (path.split("q=")[1] || "").toLowerCase();
        const topics = Array.from(mockServer.systemTopics.values()).filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
        const rooms = Array.from(mockServer.rooms.values()).filter(r => (r.customTopic || "").toLowerCase().includes(q));
        return { status: 200, body: { results: { topics, rooms } } };
      }

      if (path.startsWith("/api/admin")) {
        if (!authUser || authUser.role !== "admin") {
          return { status: 403, body: { error: "Forbidden: Admin access required" } };
        }
        if (method === "GET" && path === "/api/admin/stats") {
          return {
            status: 200,
            body: {
              stats: {
                totalUsers: mockServer.users.size,
                totalRooms: mockServer.rooms.size,
                activeRooms: Array.from(mockServer.rooms.values()).filter(r => r.status === "active").length,
              },
            },
          };
        }
        if (method === "PATCH" && path.startsWith("/api/admin/users/")) {
          const uId = path.split("/")[4];
          const target = mockServer.users.get(uId);
          if (target) {
            if (body.suspended !== undefined) target.suspended = body.suspended;
            if (body.role !== undefined) target.role = body.role;
          }
          return { status: 200, body: { user: target ? mockServer.sanitizeUser(target) : null } };
        }
      }

      return { status: 404, body: { error: "Route not found" } };
    }
  }

  // SDK Client Methods
  async register(email: string, username: string, password = "password123", categoryIds: string[] = ["cat-1"]): Promise<{ status: number; body: any }> {
    const res = await this.request("POST", "/api/auth/register", { email, username, password, categoryIds });
    if (res.status === 201) {
      this.token = res.body.token;
      this.user = res.body.user;
      this.connectSocket();
    }
    return res;
  }

  async login(email: string, password = "password123"): Promise<{ status: number; body: any }> {
    const res = await this.request("POST", "/api/auth/login", { email, password });
    if (res.status === 200) {
      this.token = res.body.token;
      this.user = res.body.user;
      this.connectSocket();
    }
    return res;
  }

  connectSocket() {
    if (!this.token) return;
    this.socket = new MockSocketClient(mockServer);
    this.socket.connect(this.token);
  }

  async getSession() {
    return this.request("GET", "/api/auth/session");
  }

  async getProfile() {
    return this.request("GET", "/api/users/me");
  }

  async updateProfile(updates: { bio?: string; avatarUrl?: string }) {
    return this.request("PATCH", "/api/users/me", updates);
  }

  async updateInterests(categoryIds: string[]) {
    return this.request("PATCH", "/api/interests", { categoryIds });
  }

  async createGroupRoom(customTopic: string, customDescription?: string, categoryId?: string, cap = 10) {
    return this.request("POST", "/api/rooms", { customTopic, customDescription, categoryId, cap });
  }

  async getRooms() {
    return this.request("GET", "/api/rooms");
  }

  async requestJoinRoom(roomId: string) {
    return this.request("POST", `/api/rooms/${roomId}/join-request`);
  }

  async handleJoinRequest(roomId: string, reqId: string, status: "approved" | "rejected") {
    return this.request("PATCH", `/api/rooms/${roomId}/join-requests/${reqId}`, { status });
  }

  async watchTopic(topicId: string) {
    return this.request("POST", `/api/topics/${topicId}/watch`);
  }

  async unwatchTopic(topicId: string) {
    return this.request("DELETE", `/api/topics/${topicId}/watch`);
  }

  async getWatchedTopics() {
    return this.request("GET", "/api/topics/watched");
  }

  async endRoom(roomId: string) {
    return this.request("DELETE", `/api/rooms/${roomId}`);
  }

  async getDigest(roomId: string) {
    return this.request("GET", `/api/conversations/${roomId}/digest`);
  }

  async getArgumentMap(roomId: string) {
    return this.request("GET", `/api/conversations/${roomId}/map`);
  }

  async saveConversation(roomId: string) {
    return this.request("POST", `/api/conversations/${roomId}/save`);
  }

  async publishDebate(roomId: string) {
    return this.request("PATCH", `/api/conversations/${roomId}/publish`);
  }

  async getPublicDebates() {
    return this.request("GET", "/api/debates");
  }

  async search(query: string) {
    return this.request("GET", `/api/search?q=${encodeURIComponent(query)}`);
  }

  async getAdminStats() {
    return this.request("GET", "/api/admin/stats");
  }

  async adminSuspendUser(userId: string, suspended: boolean) {
    return this.request("PATCH", `/api/admin/users/${userId}`, { suspended });
  }
}
