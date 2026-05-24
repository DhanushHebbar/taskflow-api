const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');

// @route   GET /api/analytics/:workspaceId
// @desc    Get aggregated statistics for a workspace
router.get('/:workspaceId', auth, async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    
    // Verify user is in workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    const isMember = workspace.members.some(m => m.user.toString() === req.user.id);
    if (!isMember) return res.status(401).json({ message: 'Unauthorized' });

    // 1. Get all projects in this workspace
    const projects = await Project.find({ workspace: workspaceId });
    const projectIds = projects.map(p => p._id);

    // 2. Get all tasks belonging to those projects
    const tasks = await Task.find({ project: { $in: projectIds } });

    // 3. Calculate Statistics
    const totalTasks = tasks.length;
    let completedTasks = 0;
    let overdueTasks = 0;
    
    const statusCounts = { 'Todo': 0, 'In Progress': 0, 'Review': 0, 'Completed': 0 };
    const priorityCounts = { 'Low': 0, 'Medium': 0, 'High': 0 };

    const now = new Date();

    tasks.forEach(task => {
      // Status & Priority
      if (statusCounts[task.status] !== undefined) statusCounts[task.status]++;
      if (priorityCounts[task.priority] !== undefined) priorityCounts[task.priority]++;
      
      if (task.status === 'Completed') {
        completedTasks++;
      } else if (task.dueDate && new Date(task.dueDate) < now) {
        overdueTasks++;
      }
    });

    const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // Format data for the Recharts frontend library
    const statusData = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));
    const priorityData = Object.keys(priorityCounts).map(key => ({ name: key, value: priorityCounts[key] }));

    res.json({
      totalTasks,
      completedTasks,
      overdueTasks,
      completionRate,
      statusData,
      priorityData
    });

  } catch (err) {
    console.error('Analytics Error:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
