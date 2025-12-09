import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import alarmRoutes from './routes/alarms.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8080;

// Socket.io 설정
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
});

// 사용자 ID → Socket ID 매핑
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('🔌 소켓 연결됨:', socket.id);

  // 사용자 등록 (로그인 후 호출)
  socket.on('register', (userId) => {
    userSockets.set(userId, socket.id);
    console.log(`👤 사용자 등록: ${userId} → ${socket.id}`);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    // 해당 소켓을 가진 사용자 찾아서 제거
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        console.log(`👋 사용자 연결 해제: ${userId}`);
        break;
      }
    }
  });
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Prisma와 io를 req에 추가
app.use((req, res, next) => {
  req.prisma = prisma;
  req.io = io;
  req.userSockets = userSockets;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alarms', alarmRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '좋아하면 울리는 서버가 실행 중입니다!' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// Start server (httpServer 사용!)
httpServer.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
  console.log(`🔌 WebSocket 활성화됨`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

