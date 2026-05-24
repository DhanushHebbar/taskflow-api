const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    // 🔴 FIXED: Added CREATE_SPRINT and UPDATE_SPRINT to the allowed list
    enum: ['CREATE_PROJECT', 'DELETE_PROJECT', 'CREATE_TASK', 'UPDATE_TASK_STATUS', 'DELETE_TASK', 'CREATE_SPRINT', 'UPDATE_SPRINT'],
    required: true
  },
  details: {
    type: String, 
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
