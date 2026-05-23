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
    enum: ['CREATE_PROJECT', 'DELETE_PROJECT', 'CREATE_TASK', 'UPDATE_TASK_STATUS', 'DELETE_TASK'],
    required: true
  },
  details: {
    type: String, // e.g., "Moved task 'Design UI' to Completed"
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
