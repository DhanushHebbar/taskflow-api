const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace'); 
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

router.get('/workload/:projectId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const workspace = await Workspace.findById(project.workspace).populate('members.user', 'name email avatar');
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    const activeTasks = await Task.find({ project: req.params.projectId, status: { $ne: 'Completed' } });

    const workload = workspace.members.map(memberObj => {
      const actualUser = memberObj.user;
      if (!actualUser) return null;
      const userTasks = activeTasks.filter(t => t.assignedTo?.toString() === actualUser._id.toString());
      let score = 0;
      userTasks.forEach(t => {
        if (t.priority === 'High') score += 3;
        else if (t.priority === 'Medium') score += 2;
        else score += 1;
      });
      return { user: actualUser, taskCount: userTasks.length, loadScore: score };
    }).filter(item => item !== null);

    workload.sort((a, b) => a.loadScore - b.loadScore);
    res.json(workload);
  } catch (err) { res.status(500).send('Server Error'); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, description, priority, projectId, assignedTo, dueDate, sprint } = req.body;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    let finalPriority = priority;
    if (priority === 'Auto') finalPriority = determinePriority(`${title} ${description}`);

    const newTask = new Task({ title, description, priority: finalPriority, project: projectId, assignedTo: assignedTo || null, createdBy: req.user.id, attachments: [], dueDate: dueDate || null, sprint: sprint || null });
    const task = await newTask.save();
    await ActivityLog.create({ workspace: project.workspace, user: req.user.id, action: 'CREATE_TASK', details: `Created task "${title}"` });
    res.json(task);
  } catch (err) { res.status(500).send('Server Error'); }
});

router.get('/:projectId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId })
      .populate('timeLogs.user', 'name avatar')
      .populate('assignedTo', 'name avatar') 
      .populate('comments.user', 'name avatar') // 🔴 NEW: Populate comment authors
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

// 🔴 NEW: Task Comments & Mentions Engine
router.post('/:taskId/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    let task = await Task.findById(req.params.taskId).populate('project');
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Save Comment
    const newComment = { user: req.user.id, text };
    task.comments.push(newComment);
    await task.save();

    // Populate the returned task so the UI updates instantly with names
    task = await Task.findById(req.params.taskId)
      .populate('comments.user', 'name avatar')
      .populate('assignedTo', 'name')
      .populate('timeLogs.user', 'name');

    // MENTION ENGINE: Look for @Name in the text
    const mentions = text.match(/@([a-zA-Z0-9_]+)/g);
    if (mentions) {
       const workspace = await Workspace.findById(task.project.workspace).populate('members.user');
       mentions.forEach(async (mention) => {
         const namePart = mention.substring(1).toLowerCase(); // remove '@'
         // Find the workspace member whose name contains the mentioned text
         const mentionedMember = workspace.members.find(m => m.user.name.toLowerCase().includes(namePart));
         
         if (mentionedMember && mentionedMember.user._id.toString() !== req.user.id) {
            const newNotification = new Notification({
              user: mentionedMember.user._id,
              message: `💬 You were mentioned in a comment on task: "${task.title}"`
            });
            await newNotification.save();
            const io = req.app.get('io');
            if (io) io.to(mentionedMember.user._id.toString()).emit('new_notification', newNotification);
         }
       });
    }

    const io = req.app.get('io');
    if (io) io.to(task.project._id.toString()).emit('task_changed');

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
    task.isTimerRunning = true;
    task.timerStartedAt = new Date();
    task.timerStartedBy = req.user.id;
    await task.save();
    const io = req.app.get('io');
    if (io) io.to(task.project.toString()).emit('task_changed');
    res.json(task);
  } catch (err) { res.status(500).send('Server Error'); }
});

router.post('/:taskId/timer/stop', auth, async (req, res) => {
  try {
    let task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    const now = new Date();
    const diffInSeconds = Math.floor((now - task.timerStartedAt) / 1000);
    task.timeSpent += diffInSeconds;
    
    const logIndex = task.timeLogs.findIndex(log => log.user.toString() === task.timerStartedBy.toString());
    if (logIndex > -1) task.timeLogs[logIndex].seconds += diffInSeconds;
    else task.timeLogs.push({ user: task.timerStartedBy, seconds: diffInSeconds });

    task.isTimerRunning = false;
    task.timerStartedAt = null;
    task.timerStartedBy = null;
    await task.save();
    const io = req.app.get('io');
    if (io) io.to(task.project.toString()).emit('task_changed');
    res.json(task);
  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
