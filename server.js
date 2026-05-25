const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const startWatchdog = require('./cron/watchdog');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Socket.io Configuration
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

// Make 'io' accessible to our Express routes (CRITICAL for Chat & Mentions)
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  // Project-specific real-time updates (Tasks & Team Chat)
  socket.on('join_project', (projectId) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project room: ${projectId}`);
  });
  
  socket.on('task_changed', (projectId) => {
    socket.to(projectId).emit('task_changed');
  });

  // User-specific real-time notifications (@Mentions)
  socket.on('join_user', (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id} joined personal room: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Successfully connected to MongoDB Atlas!'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/sprints', require('./routes/sprints'));
app.use('/api/analytics', require('./routes/analytics')); 
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/search', require('./routes/search')); 

// 🔴 NEW ECOSYSTEM MODULES
app.use('/api/chat', require('./routes/chat'));
app.use('/api/notes', require('./routes/notes'));

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'Active', 
    message: 'TaskFlow API is running successfully!',
    timestamp: new Date().toISOString()
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  
  // Initialize Background Cron Jobs
  if (typeof startWatchdog === 'function') {
    startWatchdog(io); 
  }
});
