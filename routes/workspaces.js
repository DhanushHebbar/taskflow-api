const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const crypto = require('crypto');

// @route   POST /api/workspaces
// @desc    Create a new workspace
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    // Generate a 6-character random join code
    const joinCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const newWorkspace = new Workspace({
      name: req.body.name,
      owner: req.user.id,
      members: [req.user.id],
      joinCode: joinCode
    });

    const workspace = await newWorkspace.save();
    res.json(workspace);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/workspaces
// @desc    Get all workspaces a user is a member of
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const workspaces = await Workspace.find({ members: req.user.id }).sort({ createdAt: -1 });
    res.json(workspaces);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/workspaces/join
// @desc    Join an existing workspace using a code
// @access  Private
router.post('/join', auth, async (req, res) => {
  try {
    const { joinCode } = req.body;

    // Find the workspace by its code
    const workspace = await Workspace.findOne({ joinCode: joinCode.toUpperCase() });

    if (!workspace) {
      return res.status(404).json({ message: 'Invalid join code. Workspace not found.' });
    }

    // Check if the user is already a member
    if (workspace.members.includes(req.user.id)) {
      return res.status(400).json({ message: 'You are already a member of this workspace.' });
    }

    // Add the user to the members array
    workspace.members.push(req.user.id);
    await workspace.save();

    res.json(workspace);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
