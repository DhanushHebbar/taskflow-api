const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');

// @route   POST /api/projects
// @desc    Create a project
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
      owner: req.user.id,      // FIX: Explicitly pass the 'owner' field
      createdBy: req.user.id   // Keep for backwards compatibility
    });

    const project = await newProject.save();
    res.json(project);
  } catch (err) { 
    console.error("POST Project Error:", err.message);
    res.status(500).json({ message: 'Server Error', error: err.message }); 
  }
});

// @route   GET /api/projects/:workspaceId
// @desc    Get all projects in a workspace
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

module.exports = router;
