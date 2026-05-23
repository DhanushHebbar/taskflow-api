const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const Task = require('../models/Task');

// @route   GET /api/analytics/workspace/:workspaceId
// @desc    Get aggregated analytics data for an entire workspace
// @access  Private
router.get('/workspace/:workspaceId', auth, async (req, res) => {
  try {
    // 1. Validate Access
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    if (!workspace.members.includes(req.user.id)) {
      return res.status(401).json({ message: 'Unauthorized access to workspace analytics' });
    }

    // 2. Fetch all projects in this workspace
    const projects = await Project.find({ workspace: req.params.workspaceId });
    const projectIds = projects.map(p => p._id);

    // 3. Fetch all tasks belonging to these projects
    const tasks = await Task.find({ project: { $in: projectIds } });

    // 4. Calculate Top-Level Metrics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // 5. Aggregate Data for Charts
    const statusCounts = { 'Todo': 0, 'In Progress': 0, 'Review': 0, 'Completed': 0 };
    const priorityCounts = { 'Low': 0, 'Medium': 0, 'High': 0 };

    tasks.forEach(task => {
      if (statusCounts[task.status] !== undefined) statusCounts[task.status]++;
      if (priorityCounts[task.priority] !== undefined) priorityCounts[task.priority]++;
    });

    // Format for Recharts (Array of Objects)
    const statusData = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));
    const priorityData = Object.keys(priorityCounts).map(key => ({ name: key, value: priorityCounts[key] }));

    // 6. Send payload
    res.json({
      workspaceName: workspace.name,
      totalProjects: projects.length,
      totalTasks,
      completedTasks,
      completionRate,
      statusData,
      priorityData
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
