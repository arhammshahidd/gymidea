require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { verifyToken, checkTokenVersion } = require('./utils/jwt');
const db = require('./config/db');

const errorHandler = require('./middleware/errorhandler');

const app = express();
const server = http.createServer(app);
app.use(cors());
app.use(express.json());

// Auto-load routes in src/routes (mounted under /api/<filename-without-.js>)
const routesPath = path.join(__dirname, 'routes');
if (fs.existsSync(routesPath)) {
  fs.readdirSync(routesPath).forEach((file) => {
    if (file.endsWith('.js')) {
      const route = require(path.join(routesPath, file));
      const routeName = '/' + file.replace('.js', ''); // e.g. auth.js -> /auth
      app.use('/api' + routeName, route);
      console.log(`Loaded route: /api${routeName}`);
    }
  });
}

app.get('/', (req, res) => res.json({ message: 'Gym Backend API is running 🚀' }));

app.use(errorHandler);

// Socket.IO for real-time approval training updates
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.replace('Bearer ', '');
    if (!token) return next(new Error('Unauthorized'));
    const decoded = verifyToken(token);
    const ok = await checkTokenVersion(decoded, db);
    if (!ok) return next(new Error('Invalid token'));
    socket.user = decoded;
    next();
  } catch (e) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const gymId = socket.user?.gym_id;
  if (gymId) {
    socket.join(`gym:${gymId}`);
  }
});

// Expose io to routes/controllers
app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
