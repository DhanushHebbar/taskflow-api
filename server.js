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
    methods: ['GET', 'POST', 'PUT']
  }
});

// Make 'io' accessible to our Express routes
app.set('io', io);

io.on('connection', (socket) => {
  // Project-specific real-time updates
  socket.on('join_project', (projectId) => {
    socket.join(projectId);
  });
  socket.on('task_changed', (projectId) => {
    socket.to(projectId).emit('task_changed');
  });

  // User-specific real-time notifications
  socket.on('join_user', (userId) => {
    socket.join(userId);
  });

  socket.on('disconnect', () => {});
});

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/analytics', require('./routes/analytics')); 
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/users', require('./routes/users')); 

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
  console.log(`Server is running on port ${PORT}`);
  
  // 🔴 INJECT WATCHDOG HERE
  // This passes the Socket.io instance so the cron job can send live notifications
  startWatchdog(io); 
});
