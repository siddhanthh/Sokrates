import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

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

io.on('connection', (socket: Socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.io] Client disconnected: ${socket.id} (Reason: ${reason})`);
  });
});

server.listen(PORT, () => {
  console.log(`[Sokrates Server] Running on http://localhost:${PORT}`);
  console.log(`[Sokrates Server] Health endpoint: http://localhost:${PORT}/health`);
});
