process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/sokrates?schema=public";
process.env.DIRECT_URL = process.env.DIRECT_URL || "postgresql://postgres:postgres@localhost:5432/sokrates?schema=public";
process.env.JWT_SECRET = process.env.JWT_SECRET || "sokrates-jwt-secret-key-2026-production-fallback";
process.env.PORT = process.env.PORT || "4000";
import { EventEmitter } from "events";
import { io as socketClient, Socket as ClientSocket } from "socket.io-client";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import { verifyJwt } from "../lib/auth";

// Start in-process Express + Socket.io server
import "../server/index";

// Import Next.js App Router API Route Handlers
import * as registerRoute from "../app/api/auth/register/route";
import * as loginRoute from "../app/api/auth/login/route";
import * as sessionRoute from "../app/api/auth/session/route";
import * as userMeRoute from "../app/api/users/me/route";
import * as interestsRoute from "../app/api/interests/route";
import * as categoriesRoute from "../app/api/interests/categories/route";
import * as topicsRoute from "../app/api/topics/route";
import * as trendingTopicsRoute from "../app/api/topics/trending/route";
import * as watchedTopicsRoute from "../app/api/topics/watched/route";
import * as watchTopicRoute from "../app/api/topics/[id]/watch/route";
import * as roomsRoute from "../app/api/rooms/route";
import * as roomDetailRoute from "../app/api/rooms/[id]/route";
import * as joinRequestRoute from "../app/api/rooms/[id]/join-request/route";
import * as joinRequestsRoute from "../app/api/rooms/[id]/join-requests/route";
import * as joinRequestPatchRoute from "../app/api/rooms/[id]/join-requests/[reqId]/route";
import * as digestRoute from "../app/api/conversations/[id]/digest/route";
import * as mapRoute from "../app/api/conversations/[id]/map/route";
import * as saveRoute from "../app/api/conversations/[id]/save/route";
import * as publishRoute from "../app/api/conversations/[id]/publish/route";
import * as debatesRoute from "../app/api/debates/route";
import * as searchRoute from "../app/api/search/route";
import * as adminStatsRoute from "../app/api/admin/stats/route";
import * as adminUserRoute from "../app/api/admin/users/[id]/route";
import * as adminSuspendRoute from "../app/api/admin/users/[id]/suspend/route";

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

// Interfaces for backward compatibility
export interface UserRecord {
  id: string;
  email: string;
  username: string;
  passwordHash?: string;
  bio?: string;
  avatarUrl?: string;
  role: "user" | "admin";
  suspended: boolean;
  interestCategories?: string[];
  interestVec?: number[];
  createdAt: Date | string;
  updatedAt: Date | string;
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
  embedding?: number[];
  createdAt: Date | string;
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
  createdAt: Date | string;
  endedAt?: Date | string;
}

export interface ParticipantRecord {
  id: string;
  roomId: string;
  userId?: string;
  isAi: boolean;
  joinedAt: Date | string;
  leftAt?: Date | string;
}

export interface MessageRecord {
  id: string;
  roomId: string;
  senderId?: string;
  isAi: boolean;
  content: string;
  createdAt: Date | string;
}

export interface JoinRequestRecord {
  id: string;
  roomId: string;
  userId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date | string;
}

export interface ConversationDigestRecord {
  id: string;
  roomId: string;
  summary: string;
  user1Position: string;
  user2Position: string;
  unresolvedQuestion: string;
  createdAt: Date | string;
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
  createdAt: Date | string;
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
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1.0;
  return vec.map(v => v / norm);
}

// Compute Cosine Distance (1 - Cosine Similarity)
export function cosineDistance(v1: number[], v2: number[]): number {
  if (!v1 || !v2 || v1.length !== v2.length || v1.length === 0) return 1.0;
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

// Authentic Socket Client wrapping socket.io-client
export class RealSocketClient extends EventEmitter {
  public ioSocket?: ClientSocket;

  constructor() {
    super();
    // Catch socket error events (like 'Invalid room ID') so Node EventEmitter does not emit an unhandled error process crash
    this.on("error", (_err: any) => {});
    this.on("connect_error", (_err: any) => {});
  }

  get id(): string {
    return this.ioSocket?.id || "";
  }

  get disconnected(): boolean {
    return this.ioSocket ? this.ioSocket.disconnected : true;
  }

  get socket(): ClientSocket | undefined {
    return this.ioSocket;
  }

  connect(token: string, port = 4000) {
    this.ioSocket = socketClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket", "polling"],
      forceNew: true,
    });

    const eventNames = [
      "match_found",
      "ai_joining",
      "ai_chunk",
      "ai_done",
      "ai_stream_token",
      "ai_stream_end",
      "new_message",
      "room_message",
      "room_joined",
      "room_participants_updated",
      "join_request_received",
      "join_request_sent",
      "join_request_resolved",
      "join_request_updated",
      "watched_topic_active",
      "user_typing",
      "error",
    ];

    for (const evt of eventNames) {
      this.ioSocket.on(evt, (...args: any[]) => {
        this.emit(evt, ...args);
      });
    }

    this.ioSocket.on("connect_error", (err: Error) => {
      this.emit("error", err.message || "Unauthorized socket connection");
      this.emit("connect_error", err);
    });
  }

  enterQueue(topicId: string, timeoutMs?: number) {
    this.ioSocket?.emit("queue_enter", { topicId, timeoutMs });
  }

  leaveQueue(topicId: string) {
    this.ioSocket?.emit("queue_leave", { topicId });
  }

  sendMessage(roomId: string, content: string) {
    this.ioSocket?.emit("send_message", { roomId, content });
  }

  joinRoom(roomId: string) {
    this.ioSocket?.emit("join_room", roomId);
  }

  leaveRoom(roomId: string) {
    this.ioSocket?.emit("leave_room", roomId);
  }

  disconnect() {
    this.ioSocket?.disconnect();
  }
}

export const MockSocketClient = RealSocketClient;
export const mockServer: any = {};

// Sokrates Opaque-Box E2E Test Client SDK running against Production Handlers
export class SokratesTestClient {
  public token?: string;
  public user?: any;
  public socket?: RealSocketClient;

  constructor(public baseUrl: string = "http://localhost:3000") {}

  public async request(
    method: string,
    path: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; body: any }> {
    if (process.env.TEST_BASE_URL) {
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
    }

    // Rate Limiting Check via Redis
    const clientKey = this.token ? verifyJwt(this.token)?.userId || "anon" : "anon";
    const rateKey = `rate:${clientKey}:${path.split("?")[0]}`;
    const currentReqs = (await redis.get<number>(rateKey)) || 0;
    if (currentReqs >= 100) {
      return { status: 429, body: { error: "Too many requests. Please slow down." } };
    }
    await redis.set(rateKey, currentReqs + 1, { ex: 60 });

    const headersObj = new Headers({
      "Content-Type": "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...headers,
    });

    const fullUrl = `http://localhost:3000${path}`;
    const req = new Request(fullUrl, {
      method,
      headers: headersObj,
      ...(body && ["POST", "PATCH", "PUT"].includes(method)
        ? { body: JSON.stringify(body) }
        : {}),
    });

    try {
      let res: Response | null = null;
      const urlObj = new URL(fullUrl);
      const pathname = urlObj.pathname;

      if (pathname === "/api/auth/register" && method === "POST") {
        res = await registerRoute.POST(req);
      } else if (pathname === "/api/auth/login" && method === "POST") {
        res = await loginRoute.POST(req);
      } else if (pathname === "/api/auth/session" && method === "GET") {
        res = await sessionRoute.GET(req);
      } else if (pathname === "/api/users/me") {
        if (method === "GET") res = await userMeRoute.GET(req);
        else if (method === "PATCH") res = await userMeRoute.PATCH(req);
      } else if (pathname === "/api/interests" && method === "PATCH") {
        res = await interestsRoute.PATCH(req);
      } else if (pathname === "/api/interests/categories" && method === "GET") {
        res = await categoriesRoute.GET();
      } else if (pathname === "/api/topics/trending" && method === "GET") {
        res = await trendingTopicsRoute.GET();
      } else if (pathname === "/api/topics/watched" && method === "GET") {
        res = await watchedTopicsRoute.GET(req);
      } else if (pathname === "/api/topics" && method === "GET") {
        res = await topicsRoute.GET();
      } else if (pathname.match(/^\/api\/topics\/[^\/]+\/watch$/)) {
        const topicId = pathname.split("/")[3];
        if (method === "POST") {
          res = await watchTopicRoute.POST(req, { params: Promise.resolve({ id: topicId }) });
        } else if (method === "DELETE") {
          res = await watchTopicRoute.DELETE(req, { params: Promise.resolve({ id: topicId }) });
        }
      } else if (pathname === "/api/rooms") {
        if (method === "GET") res = await roomsRoute.GET(req);
        else if (method === "POST") res = await roomsRoute.POST(req);
      } else if (pathname.match(/^\/api\/rooms\/[^\/]+$/)) {
        const roomId = pathname.split("/")[3];
        if (method === "GET") {
          res = await roomDetailRoute.GET(req, { params: Promise.resolve({ id: roomId }) });
        } else if (method === "DELETE") {
          res = await roomDetailRoute.DELETE(req, { params: Promise.resolve({ id: roomId }) });
        }
      } else if (pathname.match(/^\/api\/rooms\/[^\/]+\/join-request$/) && method === "POST") {
        const roomId = pathname.split("/")[3];
        res = await joinRequestRoute.POST(req, { params: Promise.resolve({ id: roomId }) });
      } else if (pathname.match(/^\/api\/rooms\/[^\/]+\/join-requests$/) && method === "GET") {
        const roomId = pathname.split("/")[3];
        res = await joinRequestsRoute.GET(req, { params: Promise.resolve({ id: roomId }) });
      } else if (pathname.match(/^\/api\/rooms\/[^\/]+\/join-requests\/[^\/]+$/) && method === "PATCH") {
        const parts = pathname.split("/");
        const roomId = parts[3];
        const reqId = parts[5];
        res = await joinRequestPatchRoute.PATCH(req, { params: Promise.resolve({ id: roomId, reqId }) });
      } else if (pathname.match(/^\/api\/conversations\/[^\/]+\/digest$/) && method === "GET") {
        const roomId = pathname.split("/")[3];
        res = await digestRoute.GET(req, { params: Promise.resolve({ id: roomId }) });
      } else if (pathname.match(/^\/api\/conversations\/[^\/]+\/map$/) && method === "GET") {
        const roomId = pathname.split("/")[3];
        res = await mapRoute.GET(req, { params: Promise.resolve({ id: roomId }) });
      } else if (pathname.match(/^\/api\/conversations\/[^\/]+\/save$/) && method === "POST") {
        const roomId = pathname.split("/")[3];
        res = await saveRoute.POST(req, { params: Promise.resolve({ id: roomId }) });
      } else if (pathname.match(/^\/api\/conversations\/[^\/]+\/publish$/) && (method === "PATCH" || method === "POST")) {
        const roomId = pathname.split("/")[3];
        res = await publishRoute.PATCH(req, { params: Promise.resolve({ id: roomId }) });
      } else if (pathname === "/api/debates" && method === "GET") {
        res = await debatesRoute.GET();
      } else if (pathname === "/api/search" && method === "GET") {
        res = await searchRoute.GET(req);
      } else if (pathname === "/api/admin/stats" && method === "GET") {
        res = await adminStatsRoute.GET(req);
      } else if (pathname.match(/^\/api\/admin\/users\/[^\/]+\/suspend$/) && method === "POST") {
        const userId = pathname.split("/")[4];
        res = await adminSuspendRoute.POST(req, { params: Promise.resolve({ id: userId }) });
      } else if (pathname.match(/^\/api\/admin\/users\/[^\/]+$/) && method === "PATCH") {
        const userId = pathname.split("/")[4];
        res = await adminUserRoute.PATCH(req, { params: Promise.resolve({ id: userId }) });
      }

      if (res) {
        const json = await res.json().catch(() => ({}));
        return { status: res.status, body: json };
      }

      return { status: 404, body: { error: "Route not found" } };
    } catch (err: any) {
      return { status: 500, body: { error: err.message || "Internal server error" } };
    }
  }

  // SDK Client Methods
  async register(
    email: string,
    username: string,
    password = "password123",
    categoryIds: string[] = []
  ): Promise<{ status: number; body: any }> {
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
    this.socket = new RealSocketClient();
    this.socket.on("error", (_err: any) => {});
    this.socket.on("connect_error", (_err: any) => {});
    this.socket.connect(this.token, 4000);
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
