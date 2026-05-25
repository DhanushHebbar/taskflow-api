const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  status: {
    type: String,
    enum: ['Todo', 'In Progress', 'Review', 'Completed'],
    default: 'Todo',
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium',
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  attachmentUrl: {
    type: String, // Kept for backwards compatibility with your older test tasks
  },
  attachments: [{
    type: String, // Stores an array of Cloudinary file links
  }],
  
  // Deadline & Automation tracking
  dueDate: { type: Date }, 
  isNotified: { type: Boolean, default: false },
  
  // Sprint Tracking
  sprint: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Sprint',
    default: null 
  },
  
  // Real-Time Time Tracking
  timeSpent: { type: Number, default: 0 }, // Total time tracked in seconds
  timerStartedAt: { type: Date, default: null }, // Timestamp when play was pressed
  isTimerRunning: { type: Boolean, default: false }, // Is the stopwatch active right now?

  // User Identity Time Tracking
  timerStartedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  timeLogs: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    seconds: { type: Number, default: 0 }
  }],

  // 🔴 NEW: Task Comments Array
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 🔴 THE FIX: The index must be declared AFTER the schema object is closed!
TaskSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Task', TaskSchema);
