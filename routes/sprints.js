const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Sprint = require('../models/Sprint');
const Project = require('../models/Project');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog');

router.post('/', auth, async (req, res) => {
  try {
    const { name, projectId, startDate, endDate, goals } = req.body;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const newSprint = new Sprint({ name, project: projectId, startDate, endDate, goals, createdBy: req.user.id });
    const sprint = await newSprint.save();

    await ActivityLog.create({ workspace: project.workspace, user: req.user.id, action: 'CREATE_SPRINT', details: `Created new sprint: "${name}"` });
    res.json(sprint);
  } catch (err) { res.status(500).send('Server Error'); }
});

router.get('/:projectId', auth, async (req, res) => {
  try {
    const sprints = await Sprint.find({ project: req.params.projectId }).sort({ startDate: 1 });
    res.json(sprints);
  } catch (err) { res.status(500).send('Server Error'); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    // 🔴 NEW: Accept removeTasks flag
    const { status, name, startDate, endDate, goals, removeTasks } = req.body;
    let sprint = await Sprint.findById(req.params.id);
    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });

    if (name) sprint.name = name;
    if (startDate) sprint.startDate = startDate;
    if (endDate) sprint.endDate = endDate;
    if (goals !== undefined) sprint.goals = goals;
    if (status) sprint.status = status;

    await sprint.save();

    // 🔴 NEW: If reopening without tasks, unassign all tasks linked to this sprint
    if (removeTasks === true) {
      await Task.updateMany({ sprint: sprint._id }, { sprint: null });
    }

    res.json(sprint);
  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
