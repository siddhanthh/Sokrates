import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from '../lib/prisma';
import { verifyJwt } from '../lib/auth';
import { addToQueue, removeFromQueue } from '../lib/matchmaking';
import { streamGroqResponse } from '../lib/ai/groq';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

// Health Check Route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'sokrates-realtime-server',
    timestamp: new Date().toISOString(),
  });
});

const server = http.createServer(app);

// Socket.io Server Setup
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// User socket map and fallback timer tracker
const activeUserSockets = new Map<string, string>(); // userId -> socketId
const queueTimers = new Map<string, NodeJS.Timeout>(); // "userId:topicId" -> Timer

io.use(async (socket: Socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
    (socket.handshake.query?.token as string);

  if (!token) {
    return next(new Error('Unauthorized socket connection'));
  }

  const payload = verifyJwt(token);
  if (!payload || !payload.userId) {
    return next(new Error('Unauthorized socket connection'));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.suspended) {
      return next(new Error('Account suspended or unauthorized'));
    }

    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket: Socket) => {
  const user = socket.data.user;
  if (user) {
    activeUserSockets.set(user.id, socket.id);
    console.log(`[Socket.io] Authenticated user connected: ${user.username} (${socket.id})`);
  }

  // --- Matchmaking Queue Events ---
  socket.on('queue_enter', async (data: { topicId: string; timeoutMs?: number }) => {
    if (!user) return;
    const { topicId, timeoutMs = 30000 } = data || {};
    if (!topicId) return;

    try {
      const isUuidStr = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topicId);
      const topic = isUuidStr
        ? await prisma.systemTopic.findUnique({ where: { id: topicId } })
        : await prisma.systemTopic.findFirst();

      const topicTitle = topic?.title || 'Philosophical Topic';
      const validTopicId = topic ? topic.id : null;

      const matchResult = await addToQueue(user.id, topicId, socket.id);

      if (matchResult.matched && matchResult.room) {
        const roomId = matchResult.room.id;
        const matchedUserId = matchResult.matchedUser?.userId;

        // Clear timers for both users
        const timer1 = queueTimers.get(`${user.id}:${topicId}`);
        if (timer1) clearTimeout(timer1);
        queueTimers.delete(`${user.id}:${topicId}`);

        if (matchedUserId) {
          const timer2 = queueTimers.get(`${matchedUserId}:${topicId}`);
          if (timer2) clearTimeout(timer2);
          queueTimers.delete(`${matchedUserId}:${topicId}`);
        }

        // Notify both sockets
        socket.emit('match_found', { roomId, topicTitle });
        socket.join(roomId);

        if (matchedUserId) {
          const matchedSocketId = activeUserSockets.get(matchedUserId);
          if (matchedSocketId) {
            const matchedSocket = io.sockets.sockets.get(matchedSocketId);
            if (matchedSocket) {
              matchedSocket.emit('match_found', { roomId, topicTitle });
              matchedSocket.join(roomId);
            }
          }
        }
      } else {
        // Notify topic watchers who are online
        if (validTopicId) {
          const watchers = await prisma.watchedTopic.findMany({
            where: { topicId: validTopicId, userId: { not: user.id } },
            select: { userId: true },
          });

          for (const watcher of watchers) {
            const watcherSocketId = activeUserSockets.get(watcher.userId);
            if (watcherSocketId) {
              io.to(watcherSocketId).emit('watched_topic_active', {
                topicId: validTopicId,
                topicTitle,
              });
            }
          }
        }

        // Set queue timeout for AI Fallback
        const timerKey = `${user.id}:${topicId}`;
        if (queueTimers.has(timerKey)) {
          clearTimeout(queueTimers.get(timerKey)!);
        }

        const timer = setTimeout(async () => {
          queueTimers.delete(timerKey);
          await removeFromQueue(user.id, topicId);

          // Create AI Fallback Room
          const aiRoom = await prisma.room.create({
            data: {
              type: 'ONE_ON_ONE',
              systemTopicId: validTopicId,
              customTopic: topicTitle,
              status: 'active',
              hasAi: true,
              isPublic: false,
              participants: {
                create: [
                  { userId: user.id, isAi: false },
                  { isAi: true },
                ],
              },
            },
          });

          socket.join(aiRoom.id);
          socket.emit('ai_joining', {
            roomId: aiRoom.id,
            topicTitle,
          });
        }, timeoutMs);

        queueTimers.set(timerKey, timer);
      }
    } catch (err: any) {
      socket.emit('error', err.message || 'Matchmaking failed');
    }
  });

  socket.on('queue_leave', async (data: { topicId: string }) => {
    if (!user) return;
    const { topicId } = data || {};
    if (topicId) {
      await removeFromQueue(user.id, topicId);
    }

    for (const [key, t] of queueTimers.entries()) {
      if (key.startsWith(`${user.id}:`)) {
        clearTimeout(t);
        queueTimers.delete(key);
      }
    }
  });

  // Active room participant tracking
  const roomActiveParticipants = new Map<string, Set<string>>(); // roomId -> Set<userId>

  // --- Room Events ---
  socket.on('join_room', async (roomId: string) => {
    try {
      socket.join(roomId);

      if (!roomActiveParticipants.has(roomId)) {
        roomActiveParticipants.set(roomId, new Set());
      }
      if (user) {
        roomActiveParticipants.get(roomId)!.add(user.id);
      }

      const activeCount = roomActiveParticipants.get(roomId)?.size || 1;
      io.to(roomId).emit('room_participants_updated', { roomId, activeCount });

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          systemTopic: true,
          category: true,
          participants: { include: { user: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { sender: true },
          },
          starter: true,
        },
      });

      if (room) {
        socket.emit('room_joined', {
          room,
          participants: room.participants,
          messages: room.messages,
          starters: room.starter?.questions || [],
        });
      }
    } catch (err) {
      socket.emit('error', 'Failed to join room');
    }
  });

  socket.on('leave_room', (roomId: string) => {
    socket.leave(roomId);
    if (user && roomActiveParticipants.has(roomId)) {
      roomActiveParticipants.get(roomId)!.delete(user.id);
      const activeCount = roomActiveParticipants.get(roomId)?.size || 0;
      io.to(roomId).emit('room_participants_updated', { roomId, activeCount });
    }
  });

  socket.on('request_join_room', async (data: { roomId: string }) => {
    const { roomId } = data || {};
    if (!user || !roomId) return;
    try {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }

      const joinReq = await prisma.joinRequest.upsert({
        where: { roomId_userId: { roomId, userId: user.id } },
        update: { status: 'pending' },
        create: { roomId, userId: user.id, status: 'pending' },
        include: { user: true, room: true },
      });

      if (room.createdBy) {
        const creatorSocketId = activeUserSockets.get(room.createdBy);
        if (creatorSocketId) {
          io.to(creatorSocketId).emit('join_request_received', { request: joinReq });
        }
      }
      socket.emit('join_request_sent', { request: joinReq });
    } catch (err: any) {
      socket.emit('error', err.message || 'Failed to request join room');
    }
  });

  socket.on('respond_join_request', async (data: { requestId: string; status: 'approved' | 'rejected' }) => {
    const { requestId, status } = data || {};
    if (!user || !requestId || !status) return;
    try {
      const reqRecord = await prisma.joinRequest.findUnique({
        where: { id: requestId },
        include: { room: true, user: true },
      });

      if (!reqRecord || reqRecord.room.createdBy !== user.id) {
        socket.emit('error', 'Unauthorized to manage join request');
        return;
      }

      const updatedReq = await prisma.joinRequest.update({
        where: { id: requestId },
        data: { status },
        include: { user: true, room: true },
      });

      if (status === 'approved') {
        const existingPart = await prisma.participant.findFirst({
          where: { roomId: reqRecord.roomId, userId: reqRecord.userId },
        });
        if (!existingPart) {
          await prisma.participant.create({
            data: { roomId: reqRecord.roomId, userId: reqRecord.userId, isAi: false },
          });
        }
      }

      const applicantSocketId = activeUserSockets.get(reqRecord.userId);
      if (applicantSocketId) {
        io.to(applicantSocketId).emit('join_request_resolved', { request: updatedReq });
      }

      socket.emit('join_request_updated', { request: updatedReq });
      io.to(reqRecord.roomId).emit('room_updated', { roomId: reqRecord.roomId });
    } catch (err: any) {
          socket.emit('error', err.message || 'Failed to respond to join request');
    }
  });

  socket.on('send_message', async (data: { roomId: string; content: string }) => {
    if (!user) return;
    const { roomId, content } = data || {};
    if (!content || content.trim() === '') {
      socket.emit('error', 'Cannot send empty message');
      return;
    }

    const isUuidStr = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId || '');
    if (!roomId || !isUuidStr) {
      socket.emit('error', 'Invalid room ID');
      return;
    }

    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          systemTopic: true,
          messages: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { sender: true },
          },
        },
      });

      if (!room || room.status === 'ended') {
        socket.emit('error', 'Room is inactive or ended');
        return;
      }

      // Save user message
      const msg = await prisma.message.create({
        data: {
          roomId,
          senderId: user ? user.id : null,
          isAi: false,
          content,
        },
        include: { sender: true },
      });

      io.to(roomId).emit('new_message', { message: msg });
      io.to(roomId).emit('room_message', { message: msg });

      // AI Response Streaming Trigger
      if (room.hasAi) {
        const topicTitle = room.systemTopic?.title || 'Philosophical Dialogue';
        const recentMsgs = room.messages.reverse().map((m) => ({
          role: (m.isAi ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.content,
        }));
        recentMsgs.push({ role: 'user', content });

        const messageId = `msg_ai_${Date.now()}`;
        let fullAiText = '';

        streamGroqResponse(
          recentMsgs,
          (chunk) => {
            fullAiText += chunk;
            io.to(roomId).emit('ai_chunk', { messageId, chunk });
            io.to(roomId).emit('ai_stream_token', { messageId, chunk });
          },
          async (fullResponse) => {
            const aiMsg = await prisma.message.create({
              data: {
                roomId,
                isAi: true,
                content: fullResponse,
              },
            });

            io.to(roomId).emit('ai_done', {
              messageId,
              fullMessage: fullResponse,
              message: aiMsg,
            });
            io.to(roomId).emit('ai_stream_end', {
              messageId,
              fullMessage: fullResponse,
            });
          },
          `You are Sokrates, an empathetic, intellectually rigorous AI debate partner discussing "${topicTitle}". Engage in thoughtful, open-minded dialogue.`
        );
      }
    } catch (err: any) {
      socket.emit('error', err.message || 'Failed to send message');
    }
  });

  socket.on('typing_start', (roomId: string) => {
    socket.to(roomId).emit('user_typing', { userId: user?.id, username: user?.username, isTyping: true });
  });

  socket.on('typing_stop', (roomId: string) => {
    socket.to(roomId).emit('user_typing', { userId: user?.id, username: user?.username, isTyping: false });
  });

  socket.on('disconnect', (reason) => {
    if (user) {
      activeUserSockets.delete(user.id);
      for (const [roomId, usersSet] of roomActiveParticipants.entries()) {
        if (usersSet.has(user.id)) {
          usersSet.delete(user.id);
          io.to(roomId).emit('room_participants_updated', { roomId, activeCount: usersSet.size });
        }
      }
    }
    console.log(`[Socket.io] Client disconnected: ${socket.id} (Reason: ${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`[Sokrates Server] Running on http://localhost:${PORT}`);
  console.log(`[Sokrates Server] Health endpoint: http://localhost:${PORT}/health`);
});
