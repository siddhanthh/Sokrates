import prisma from "./prisma";
import redis from "./redis";

export interface QueueEntry {
  userId: string;
  socketId?: string;
  topicId: string;
  joinedAt: number;
}

/**
 * Calculates Cosine Distance (1.0 - Cosine Similarity) between two 768-dimensional vectors.
 */
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

/**
 * Parse pgvector format string or raw float array into standard number[].
 */
export function parseVector(raw: any): number[] {
  if (!raw) return new Array(768).fill(0);
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const cleaned = raw.replace(/^\[/, "").replace(/\]$/, "");
    return cleaned.split(",").map((v) => parseFloat(v.trim()));
  }
  return new Array(768).fill(0);
}

/**
 * Add a user to the matchmaking queue for a topic and attempt to find the best semantic match.
 */
export async function addToQueue(userId: string, topicId: string, socketId?: string) {
  const queueKey = `match_queue:${topicId}`;

  // Check if there are other candidates waiting in queue for this topic
  const rawMembers = await redis.lrange(queueKey, 0, -1);
  const candidates: QueueEntry[] = rawMembers
    .map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    })
    .filter((c): c is QueueEntry => Boolean(c) && c.userId !== userId);

  if (candidates.length > 0) {
    const candidateUserIds = candidates.map((c) => c.userId);
    let userVec: number[] = [];
    let dbCandidates: Array<{ id: string; interestVec?: any }> = [];

    try {
      const currentUserList: any[] = await prisma.$queryRaw`SELECT id, interest_vec::text as "interestVec" FROM users WHERE id = ${userId}::uuid`;
      if (currentUserList.length > 0) {
        userVec = parseVector(currentUserList[0].interestVec);
      }
      if (candidateUserIds.length > 0) {
        dbCandidates = await prisma.$queryRaw`SELECT id, interest_vec::text as "interestVec" FROM users WHERE id::text = ANY(${candidateUserIds})`;
      }
    } catch {
      // Non-pgvector or local fallback
    }

    let bestCandidate: QueueEntry = candidates[0];
    let minDistance = 2.0;

    for (const candEntry of candidates) {
      const candDb = dbCandidates.find((u) => u.id === candEntry.userId);
      const candVec = parseVector(candDb?.interestVec);
      const dist = cosineDistance(userVec, candVec);
      if (dist < minDistance) {
        minDistance = dist;
        bestCandidate = candEntry;
      }
    }

    // Remove matched candidate from Redis queue
    const candJsonStr = JSON.stringify(bestCandidate);
    await redis.lrem(queueKey, 0, candJsonStr);

    const isUuidStr = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topicId);
    const validTopicId = isUuidStr ? topicId : null;

    // Create 1-on-1 Room in database
    const room = await prisma.room.create({
      data: {
        type: "ONE_ON_ONE",
        systemTopicId: validTopicId,
        customTopic: "Philosophical Topic",
        status: "active",
        hasAi: false,
        isPublic: false,
        participants: {
          create: [
            { userId, isAi: false },
            { userId: bestCandidate.userId, isAi: false },
          ],
        },
      },
      include: {
        systemTopic: true,
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    return {
      matched: true,
      room,
      matchedUser: bestCandidate,
    };
  } else {
    // Push current user to queue
    const entry: QueueEntry = {
      userId,
      socketId,
      topicId,
      joinedAt: Date.now(),
    };
    await redis.rpush(queueKey, JSON.stringify(entry));
    return {
      matched: false,
      entry,
    };
  }
}

/**
 * Remove user from matchmaking queue.
 */
export async function removeFromQueue(userId: string, topicId?: string) {
  if (topicId) {
    const queueKey = `match_queue:${topicId}`;
    const rawMembers = await redis.lrange(queueKey, 0, -1);
    for (const item of rawMembers) {
      try {
        const entry: QueueEntry = JSON.parse(item);
        if (entry.userId === userId) {
          await redis.lrem(queueKey, 0, item);
        }
      } catch {}
    }
  } else {
    // Scan all topics if topicId not provided
    const topics = await prisma.systemTopic.findMany({ select: { id: true } });
    for (const t of topics) {
      const queueKey = `match_queue:${t.id}`;
      const rawMembers = await redis.lrange(queueKey, 0, -1);
      for (const item of rawMembers) {
        try {
          const entry: QueueEntry = JSON.parse(item);
          if (entry.userId === userId) {
            await redis.lrem(queueKey, 0, item);
          }
        } catch {}
      }
    }
  }
  return true;
}

/**
 * Get current queue status for a user.
 */
export async function getQueueStatus(userId: string) {
  const topics = await prisma.systemTopic.findMany({ select: { id: true, title: true } });
  for (const t of topics) {
    const queueKey = `match_queue:${t.id}`;
    const rawMembers = await redis.lrange(queueKey, 0, -1);
    for (const item of rawMembers) {
      try {
        const entry: QueueEntry = JSON.parse(item);
        if (entry.userId === userId) {
          return { inQueue: true, topicId: t.id, topicTitle: t.title, joinedAt: entry.joinedAt };
        }
      } catch {}
    }
  }
  return { inQueue: false };
}
