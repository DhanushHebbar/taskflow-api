const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: 'taskflow_attachments', allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'], resource_type: 'auto' },
});
const upload = multer({ storage: storage });

const determinePriority = (text) => {
  if (!text) return 'Medium';
  const lower = text.toLowerCase();
  if (/(urgent|asap|critical|blocker|emergency|immediate)/.test(lower)) return 'High';
  if (/(whenever|low priority|backlog|someday|minor)/.test(lower)) return 'Low';
  return 'Medium';
};

router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority, projectId, assignedTo, dueDate, sprint } = req.body;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    let finalPriority = priority;
    if (priority === 'Auto') finalPriority = determinePriority(`${title} ${description}`);

    const newTask = new Task({
      title, description, priority: finalPriority, project: projectId, 
      assignedTo: assignedTo || null, createdBy: req.user.id, attachments: [],
      dueDate: dueDate || null, sprint: sprint || null 
    });

    const task = await newTask.save();
    await ActivityLog.create({ workspace: project.workspace, user: req.user.id, action: 'CREATE_TASK', details: `Created task "${title}"` });
    res.json(task);
  } catch (err) { res.status(500).send('Server Error'); }
});

router.get('/:projectId', auth, async (req, res) => {
  try {
    // 🔴 FIXED: Use populate so the frontend knows the names of the people who worked on it
    const tasks = await Task.find({ project: req.params.projectId })
      .populate('timeLogs.user', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) { res.status(500).send('Server Error'); }
});

router.put('/:taskId', auth, async (req, res) => {
  try {
    const { title, description, status, priority, assignedTo, dueDate, sprint } = req.body;
    let task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const project = await Project.findById(task.project);

    if (status && task.status !== status) {
      if (task.createdBy.toString() !== req.user.id) {
        const newNotification = new Notification({ user: task.createdBy, message: `Your task "${task.title}" was moved to ${status}.` });
        await newNotification.save();
        const io = req.app.get('io');
        if (io) io.to(task.createdBy.toString()).emit('new_notification', newNotification);
      }
      await ActivityLog.create({ workspace: project.workspace, user: req.user.id, action: 'UPDATE_TASK_STATUS', details: `Moved task to ${status}` });
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;
    if (dueDate !== undefined) { task.dueDate = dueDate; task.isNotified = false; }
    if (sprint !== undefined) { task.sprint = sprint; }

    await task.save();
    res.json(task);
  } catch (err) { res.status(500).send('Server Error'); }
});

router.post('/:taskId/upload', auth, upload.array('attachments', 10), async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

    const newAttachmentUrls = req.files.map(file => file.path);
    task.attachments = [...(task.attachments || []), ...newAttachmentUrls];
    await task.save();
    const io = req.app.get('io');
    if (io) io.to(task.project.toString()).emit('task_changed');
    res.json(task);
  } catch (err) { res.status(500).send('Server Error uploading files'); }
});

router.post('/:taskId/timer/start', auth, async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.isTimerRunning) return res.status(400).json({ message: 'Timer is already running' });

    task.isTimerRunning = true;
    task.timerStartedAt = new Date();
    // 🔴 NEW: Lock the timer to the user who clicked start
    task.timerStartedBy = req.user.id;
    await task.save();

    const io = req.app.get('io');
    if (io) io.to(task.project.toString()).emit('task_changed');
    res.json(task);
  } catch (err) { res.status(500).send('Server Error starting timer'); }
});

router.post('/:taskId/timer/stop', auth, async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!task.isTimerRunning) return res.status(400).json({ message: 'Timer is not running' });

    const now = new Date();
    const diffInSeconds = Math.floor((now - task.timerStartedAt) / 1000);

    task.timeSpent += diffInSeconds;
    
    // 🔴 NEW: Find the user in the ledger and add their seconds
    const logIndex = task.timeLogs.findIndex(log => log.user.toString() === task.timerStartedBy.toString());
    if (logIndex > -1) {
      task.timeLogs[logIndex].seconds += diffInSeconds;
    } else {
      task.timeLogs.push({ user: task.timerStartedBy, seconds: diffInSeconds });
    }

    task.isTimerRunning = false;
    task.timerStartedAt = null;
    task.timerStartedBy = null;
    await task.save();

    const io = req.app.get('io');
    if (io) io.to(task.project.toString()).emit('task_changed');
    res.json(task);
  } catch (err) { res.status(500).send('Server Error stopping timer'); }
});

module.exports = router;
