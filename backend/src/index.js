import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import path from 'path';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import alarmRoutes from './routes/alarms.js';
import feedbackRoutes from './routes/feedback.js';
import webhooksInstagramRoutes from './routes/webhooksInstagram.js';
import verifyInstagramRoutes from './routes/verifyInstagram.js';
import messagesRoutes from './routes/messages.js';
import eventsRoutes from './routes/events.js';
import clonesRoutes from './routes/clones.js';
import { startMatchingScheduler } from './services/matchingEngine.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8080;

// Socket.io 설정
const socketCorsOrigin = process.env.CORS_ORIGIN === '*' 
  ? '*' 
  : (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000').split(',');

const io = new Server(httpServer, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: socketCorsOrigin !== '*'
  },
});

// 사용자 ID → Socket ID 매핑
const userSockets = new Map();

io.on('connection', (socket) => {
  // 사용자 등록 (로그인 후 호출)
  socket.on('register', (userId) => {
    userSockets.set(userId, socket.id);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    // 해당 소켓을 가진 사용자 찾아서 제거
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
  });
});

// Middleware
// 토스 미니앱 환경에서의 요청을 허용하기 위해 모든 origin 허용
app.use(cors({
  origin: true, // 모든 origin 허용 (credentials와 함께 사용 가능)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Preflight 요청 명시적 처리
app.options('*', cors());
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
app.use('/api/feedback', feedbackRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/verify/instagram', verifyInstagramRoutes);
app.use('/api/clones', clonesRoutes);
app.use('/webhook', webhooksInstagramRoutes);

app.use(express.static(path.join(__dirname, '../public')));

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

  // AI 클론 매칭 엔진 시작
  if (process.env.ENABLE_MATCHING_ENGINE !== 'false') {
    startMatchingScheduler(prisma, io, userSockets);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// 예상치 못한 에러로 서버가 죽지 않도록 방지
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});

// Render 무료 티어 스핀다운 방지: 14분마다 자기 자신에게 헬스체크
const SELF_URL = process.env.RENDER_EXTERNAL_URL;
if (SELF_URL) {
  setInterval(async () => {
    try {
      const res = await fetch(`${SELF_URL}/health`);
      console.log(`[keep-alive] ping → ${res.status}`);
    } catch (e) {
      console.warn('[keep-alive] ping failed:', e.message);
    }
  }, 14 * 60 * 1000); // 14분
}

