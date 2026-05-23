const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
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

io.on('connection', (socket) => {
  // When a user opens a project board, they join a specific "room"
  socket.on('join_project', (projectId) => {
    socket.join(projectId);
  });

  // When a user moves or creates a task, broadcast to others in the same room
  socket.on('task_changed', (projectId) => {
    socket.to(projectId).emit('task_changed');
  });

  socket.on('disconnect', () => {
    // Socket.io automatically handles room leave on disconnect
  });
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
app.use('/api/analytics', require('./routes/analytics')); // NEW MODULE 7 ROUTE

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'Active', 
    message: 'TaskFlow API is running successfully!',
    timestamp: new Date().toISOString()
  });
});

// Start Server (Crucial: Use 'server.listen', not 'app.listen')
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
