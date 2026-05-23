const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');

// @route   POST /api/workspaces
// @desc    Create a new workspace (Creator becomes 'owner')
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const joinCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const newWorkspace = new Workspace({
      name,
      joinCode,
      members: [{ user: req.user.id, role: 'owner' }] // Assign owner role
    });

    const workspace = await newWorkspace.save();
    res.json(workspace);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   GET /api/workspaces
// @desc    Get all workspaces the user is a part of
router.get('/', auth, async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.user': req.user.id });
    res.json(workspaces);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   POST /api/workspaces/join
// @desc    Join a workspace using a code (Joiner becomes 'member')
router.post('/join', auth, async (req, res) => {
  try {
    const { joinCode } = req.body;
    const workspace = await Workspace.findOne({ joinCode: joinCode.toUpperCase() });

    if (!workspace) return res.status(404).json({ message: 'Invalid Join Code' });

    // Check if user is already in the workspace
    const isMember = workspace.members.some(m => m.user.toString() === req.user.id);
    if (isMember) return res.status(400).json({ message: 'You are already a member of this workspace' });

    workspace.members.push({ user: req.user.id, role: 'member' });
    await workspace.save();
    res.json(workspace);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   GET /api/workspaces/:id
// @desc    Get single workspace data with populated user details
router.get('/:id', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id).populate('members.user', 'name email');
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const isMember = workspace.members.some(m => m.user._id.toString() === req.user.id);
    if (!isMember) return res.status(401).json({ message: 'Unauthorized access' });

    res.json(workspace);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   PUT /api/workspaces/:id/members/:userId
// @desc    Change a member's role (Requires Owner or Admin)
router.put('/:id/members/:userId', auth, async (req, res) => {
  try {
    const { role } = req.body;
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    // 1. Identify the person making the request
    const requester = workspace.members.find(m => m.user.toString() === req.user.id);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return res.status(403).json({ message: 'Only Owners and Admins can modify roles' });
    }

    // 2. Identify the target member
    const targetMember = workspace.members.find(m => m.user.toString() === req.params.userId);
    if (!targetMember) return res.status(404).json({ message: 'Target user is not in this workspace' });

    // 3. Apply business hierarchy rules
    if (requester.role === 'admin' && (targetMember.role === 'owner' || role === 'owner')) {
      return res.status(403).json({ message: 'Admins cannot modify or assign Owner roles' });
    }
    if (req.user.id === req.params.userId && role !== 'owner') {
        return res.status(400).json({ message: 'Owners cannot demote themselves. Transfer ownership first.' });
    }

    targetMember.role = role;
    await workspace.save();
    res.json(workspace);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   DELETE /api/workspaces/:id/members/:userId
// @desc    Remove a member from the workspace
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const requester = workspace.members.find(m => m.user.toString() === req.user.id);
    const targetMember = workspace.members.find(m => m.user.toString() === req.params.userId);

    if (!requester || !targetMember) return res.status(404).json({ message: 'User not found in workspace' });

    // Logic: A user can leave voluntarily. Otherwise, requester must be Admin/Owner. Admins cannot kick Owners.
    if (req.user.id !== req.params.userId) {
      if (requester.role !== 'owner' && requester.role !== 'admin') {
        return res.status(403).json({ message: 'You do not have permission to remove members' });
      }
      if (requester.role === 'admin' && targetMember.role === 'owner') {
        return res.status(403).json({ message: 'Admins cannot remove the Workspace Owner' });
      }
    }

    workspace.members = workspace.members.filter(m => m.user.toString() !== req.params.userId);
    await workspace.save();
    res.json(workspace);
  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
