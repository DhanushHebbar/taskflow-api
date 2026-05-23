const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer Storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'taskflow_attachments',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
    resource_type: 'auto' // NEW: Tells Cloudinary to handle PDFs correctly!
  },
});
const upload = multer({ storage: storage });

// @route   POST /api/tasks
// @desc    Create a task inside a project
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority, projectId, assignedTo } = req.body;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const newTask = new Task({
      title, description, priority,
      project: projectId,
      assignedTo: assignedTo || null,
      createdBy: req.user.id,
    });

    const task = await newTask.save();
    res.json(task);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   GET /api/tasks/:projectId
// @desc    Get all tasks belonging to a specific project
router.get('/:projectId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   PUT /api/tasks/:taskId
// @desc    Modify a task's status or detailed attributes
router.put('/:taskId', auth, async (req, res) => {
  try {
    const { title, description, status, priority, assignedTo } = req.body;
    let task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (status && task.status !== status) {
      if (task.createdBy.toString() !== req.user.id) {
        const newNotification = new Notification({
          user: task.createdBy,
          message: `Your task "${task.title}" was moved to ${status}.`
        });
        await newNotification.save();
        const io = req.app.get('io');
        if (io) io.to(task.createdBy.toString()).emit('new_notification', newNotification);
      }
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;

    await task.save();
    res.json(task);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   POST /api/tasks/:taskId/upload
// @desc    Upload an attachment to a specific task
router.post('/:taskId/upload', auth, upload.single('attachment'), async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Save the Cloudinary URL to the task
    task.attachmentUrl = req.file.path;
    await task.save();

    // Trigger real-time update for everyone viewing the board
    const io = req.app.get('io');
    if (io) io.to(task.project.toString()).emit('task_changed');

    res.json(task);
  } catch (err) { 
    console.error(err);
    res.status(500).send('Server Error uploading file'); 
  }
});

module.exports = router;
