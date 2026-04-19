require('dotenv').config();
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const helmet   = require('helmet');
const cors     = require('cors');
const rateLimit = require('express-rate-limit');

const path           = require('path');
const fs             = require('fs');
const eventsRouter   = require('./routes/events');
const listsRouter    = require('./routes/songLists');
const requestsRouter = require('./routes/songRequests');
const authRouter     = require('./routes/auth');
const searchRouter   = require('./routes/search');
const photosRouter   = require('./routes/photos');
const socketHandlers = require('./socket/handlers');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'photos');
fs.mkdirSync(uploadsDir, { recursive: true });

const app    = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowAllOrigins = allowedOrigins.includes('*');

const corsOrigin = (origin, callback) => {
  // Allow server-to-server calls and tools that do not send Origin.
  if (!origin) return callback(null, true);
  if (allowAllOrigins || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Not allowed by CORS'));
};

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  },
});

socketHandlers(io);

// Make io accessible in route handlers via req.app.get('io')
app.set('io', io);

// Trust the first proxy (nginx) so express-rate-limit reads X-Forwarded-For correctly
app.set('trust proxy', 1);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50kb' }));

const limiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
app.use('/api', limiter);

// ─── Static files (uploaded photos) ──────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/events',   eventsRouter);
app.use('/api/lists',    listsRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/auth',     authRouter);
app.use('/api/search',   searchRouter);
app.use('/api/photos',   photosRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, () => console.log(`DJ API running on http://localhost:${PORT}`));
