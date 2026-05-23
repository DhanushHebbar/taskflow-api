const mongoose = require('mongoose');

const WorkspaceSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  joinCode: { 
    type: String, 
    required: true, 
    unique: true 
  },
  // UPGRADED: Members now have specific roles
  members: [{
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true
    },
    role: { 
      type: String, 
      enum: ['owner', 'admin', 'member', 'viewer'], 
      default: 'member' 
    }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Workspace', WorkspaceSchema);
