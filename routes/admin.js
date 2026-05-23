const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const Task = require('../models/Task');

// @route   GET /api/admin/stats
router.get('/stats', auth, admin, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const workspaceCount = await Workspace.countDocuments();
    res.json({ totalUsers: userCount, totalWorkspaces: workspaceCount });
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Promote or demote a user
router.put('/users/:id/role', auth, admin, async (req, res) => {
  try {
    const { role } = req.body;
    
    // Security check: Only allow valid roles
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role provided' });
    }

    // Prevent the admin from accidentally demoting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id, 
      { role }, 
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (err) { 
    console.error(err);
    res.status(500).send('Server Error'); 
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Permanently delete a user
router.delete('/users/:id', auth, admin, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: 'You cannot delete yourself.' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User terminated' });
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   GET /api/admin/workspaces
// @desc    Get all workspaces
router.get('/workspaces', auth, admin, async (req, res) => {
  try {
    const workspaces = await Workspace.find().sort({ createdAt: -1 });
    res.json(workspaces);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   DELETE /api/admin/workspaces/:id
// @desc    Force delete a workspace and cascade delete its projects/tasks
router.delete('/workspaces/:id', auth, admin, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    
    // Find all projects in this workspace to delete their tasks
    const projects = await Project.find({ workspace: workspaceId });
    const projectIds = projects.map(p => p._id);
    
    // Cascade Delete: Tasks -> Projects -> Workspace
    await Task.deleteMany({ project: { $in: projectIds } });
    await Project.deleteMany({ workspace: workspaceId });
    await Workspace.findByIdAndDelete(workspaceId);

    res.json({ message: 'Workspace and all associated data permanently deleted.' });
  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
