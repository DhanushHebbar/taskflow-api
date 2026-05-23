const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');

// @route   POST /api/workspaces
// @desc    Create a new workspace
// @access  Private (Requires Token)
router.post('/', auth, async (req, res) => {
  try {
    // Create new workspace. The user making the request becomes the owner and a member.
    const newWorkspace = new Workspace({
      name: req.body.name,
      owner: req.user.id,
      members: [req.user.id] 
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
// @access  Private (Requires Token)
router.get('/', auth, async (req, res) => {
  try {
    // Find all workspaces where the current user's ID is in the members array
    const workspaces = await Workspace.find({ members: req.user.id }).sort({ createdAt: -1 });
    res.json(workspaces);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
