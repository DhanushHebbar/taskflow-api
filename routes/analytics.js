const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const Task = require('../models/Task');

// @route   GET /api/analytics/workspace/:workspaceId
// @desc    Get aggregated analytics data for an entire workspace
router.get('/workspace/:workspaceId', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    
    // UPGRADED SECURITY CHECK
    const isMember = workspace.members.some(m => m.user.toString() === req.user.id);
    if (!isMember) {
      return res.status(401).json({ message: 'Unauthorized access to workspace analytics' });
    }

    const projects = await Project.find({ workspace: req.params.workspaceId });
    const projectIds = projects.map(p => p._id);
    const tasks = await Task.find({ project: { $in: projectIds } });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const statusCounts = { 'Todo': 0, 'In Progress': 0, 'Review': 0, 'Completed': 0 };
    const priorityCounts = { 'Low': 0, 'Medium': 0, 'High': 0 };

    tasks.forEach(task => {
      if (statusCounts[task.status] !== undefined) statusCounts[task.status]++;
      if (priorityCounts[task.priority] !== undefined) priorityCounts[task.priority]++;
    });

    const statusData = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));
    const priorityData = Object.keys(priorityCounts).map(key => ({ name: key, value: priorityCounts[key] }));

    res.json({
      workspaceName: workspace.name,
      totalProjects: projects.length,
      totalTasks,
      completedTasks,
      completionRate,
      statusData,
      priorityData
    });

  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
