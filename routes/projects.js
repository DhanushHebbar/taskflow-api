const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');

// @route   POST /api/projects
// @desc    Create a new project inside a workspace
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, workspaceId } = req.body;

    // Verify the workspace exists and the user is a member of it
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    if (!workspace.members.includes(req.user.id)) {
      return res.status(401).json({ message: 'Unauthorized to add projects to this workspace' });
    }

    const newProject = new Project({
      name,
      description,
      workspace: workspaceId,
      owner: req.user.id,
    });

    const project = await newProject.save();
    res.json(project);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/projects/:workspaceId
// @desc    Get all projects inside a specific workspace
// @access  Private
router.get('/:workspaceId', auth, async (req, res) => {
  try {
    // Verify user is a member of the workspace first
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    if (!workspace.members.includes(req.user.id)) {
      return res.status(401).json({ message: 'Unauthorized access to this workspace' });
    }

    const projects = await Project.find({ workspace: req.params.workspaceId }).sort({ createdAt: -1 });
    res.json(projects);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
