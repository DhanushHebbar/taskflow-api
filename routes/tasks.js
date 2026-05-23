const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification'); // ADDED

// @route   POST /api/tasks
// @desc    Create a task inside a project
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority, projectId, assignedTo } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const newTask = new Task({
      title,
      description,
      priority,
      project: projectId,
      assignedTo: assignedTo || null,
      createdBy: req.user.id,
    });

    const task = await newTask.save();
    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/tasks/:projectId
// @desc    Get all tasks belonging to a specific project
// @access  Private
router.get('/:projectId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/tasks/:taskId
// @desc    Modify a task's status or detailed attributes
// @access  Private
router.put('/:taskId', auth, async (req, res) => {
  try {
    const { title, description, status, priority, assignedTo } = req.body;

    let task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Check if status actually changed to trigger a notification
    if (status && task.status !== status) {
      // Create a notification for the task creator if someone else moves it
      if (task.createdBy.toString() !== req.user.id) {
        const newNotification = new Notification({
          user: task.createdBy,
          message: `Your task "${task.title}" was moved to ${status}.`
        });
        await newNotification.save();
      }
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;

    await task.save();
    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
