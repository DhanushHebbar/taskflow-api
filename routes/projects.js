const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const Task = require('../models/Task');
const ActivityLog = require('../models/ActivityLog'); // NEW

// @route   POST /api/projects
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ message: 'Workspace ID is missing' });
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    const member = workspace.members.find(m => m.user && m.user.toString() === req.user.id);
    if (!member) return res.status(401).json({ message: 'Unauthorized access to workspace' });
    if (member.role === 'viewer') return res.status(403).json({ message: 'Viewers cannot create projects.' });

    const newProject = new Project({ name, description, workspace: workspaceId, owner: req.user.id, createdBy: req.user.id });
    const project = await newProject.save();

    // 🔴 NEW: LOG THE ACTIVITY
    await ActivityLog.create({
      workspace: workspaceId,
      user: req.user.id,
      action: 'CREATE_PROJECT',
      details: `Created new project: "${name}"`
    });

    res.json(project);
  } catch (err) { res.status(500).json({ message: 'Server Error' }); }
});

// @route   GET /api/projects/:workspaceId
router.get('/:workspaceId', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    const isMember = workspace.members.some(m => m.user && m.user.toString() === req.user.id);
    if (!isMember) return res.status(401).json({ message: 'Unauthorized access to workspace' });
    const projects = await Project.find({ workspace: req.params.workspaceId }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   PUT /api/projects/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const workspace = await Workspace.findById(project.workspace);
    const member = workspace.members.find(m => m.user && m.user.toString() === req.user.id);
    if (!member) return res.status(401).json({ message: 'Unauthorized' });
    if (member.role === 'viewer' || (member.role === 'member' && project.createdBy.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'You do not have permission to edit this project.' });
    }
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    await project.save();
    res.json(project);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   DELETE /api/projects/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const workspaceId = project.workspace; // Save ID before deleting
    const workspace = await Workspace.findById(workspaceId);
    const member = workspace.members.find(m => m.user && m.user.toString() === req.user.id);
    if (!member) return res.status(401).json({ message: 'Unauthorized' });
    if (member.role === 'viewer' || (member.role === 'member' && project.createdBy.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'You do not have permission to delete this project.' });
    }
    await Task.deleteMany({ project: req.params.id });
    await Project.findByIdAndDelete(req.params.id);

    // 🔴 NEW: LOG THE ACTIVITY
    await ActivityLog.create({
      workspace: workspaceId,
      user: req.user.id,
      action: 'DELETE_PROJECT',
      details: `Deleted project: "${project.name}"`
    });

    res.json({ message: 'Project deleted' });
  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
