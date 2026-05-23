const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const Workspace = require('../models/Workspace');

// @route   GET /api/admin/stats
// @desc    Get platform-wide statistics
// @access  Private/Admin
router.get('/stats', auth, admin, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const workspaceCount = await Workspace.countDocuments();
    
    res.json({
      totalUsers: userCount,
      totalWorkspaces: workspaceCount,
      activeUsers: userCount // You can extend this logic later
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
