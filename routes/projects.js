const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const Task = require('../models/Task'); // NEW IMPORT FOR CASCADE DELETE

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

    const newProject = new Project({
      name, 
      description, 
      workspace: workspaceId, 
      owner: req.user.id,
      createdBy: req.user.id
    });

    const project = await newProject.save();
    res.json(project);
  } catch (err) { 
    console.error("POST Project Error:", err.message);
    res.status(500).json({ message: 'Server Error', error: err.message }); 
  }
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
  } catch (err) { 
    console.error("GET Projects Error:", err.message);
    res.status(500).send('Server Error'); 
  }
});

// NEW FEATURE: EDIT PROJECT
// @route   PUT /api/projects/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    let project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const workspace = await Workspace.findById(project.workspace);
    const member = workspace.members.find(m => m.user && m.user.toString() === req.user.id);

    if (!member) return res.status(401).json({ message: 'Unauthorized' });

    // RBAC: Owners, Admins, or the Member who created it can edit
    if (member.role === 'viewer' || (member.role === 'member' && project.createdBy.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'You do not have permission to edit this project.' });
    }

    if (name) project.name = name;
    if (description !== undefined) project.description = description;

    await project.save();
    res.json(project);
  } catch (err) { res.status(500).send('Server Error'); }
});

// NEW FEATURE: DELETE PROJECT
// @route   DELETE /api/projects/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const workspace = await Workspace.findById(project.workspace);
    const member = workspace.members.find(m => m.user && m.user.toString() === req.user.id);

    if (!member) return res.status(401).json({ message: 'Unauthorized' });

    // RBAC: Owners, Admins, or the Member who created it can delete
    if (member.role === 'viewer' || (member.role === 'member' && project.createdBy.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'You do not have permission to delete this project.' });
    }

    // Cascade Delete Tasks
    await Task.deleteMany({ project: req.params.id });
    await Project.findByIdAndDelete(req.params.id);

    res.json({ message: 'Project deleted' });
  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
