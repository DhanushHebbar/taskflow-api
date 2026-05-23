const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const ActivityLog = require('../models/ActivityLog');

// @route   GET /api/activity/:workspaceId
// @desc    Get recent activity for a workspace
router.get('/:workspaceId', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // Ensure the user is a member of this workspace
    const isMember = workspace.members.some(m => m.user.toString() === req.user.id);
    if (!isMember) return res.status(401).json({ message: 'Unauthorized' });

    // Fetch the 50 most recent logs, populate the user's name
    const logs = await ActivityLog.find({ workspace: req.params.workspaceId })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(logs);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
