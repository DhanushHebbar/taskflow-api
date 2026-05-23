const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const Notification = require('../models/Notification'); // NEW

// @route   POST /api/workspaces
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const joinCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const newWorkspace = new Workspace({
      name,
      joinCode,
      members: [{ user: req.user.id, role: 'owner' }]
    });

    const workspace = await newWorkspace.save();
    res.json(workspace);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   GET /api/workspaces
router.get('/', auth, async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.user': req.user.id });
    res.json(workspaces);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   POST /api/workspaces/join
router.post('/join', auth, async (req, res) => {
  try {
    const { joinCode } = req.body;
    const workspace = await Workspace.findOne({ joinCode: joinCode.toUpperCase() });

    if (!workspace) return res.status(404).json({ message: 'Invalid Join Code' });

    const isMember = workspace.members.some(m => m.user.toString() === req.user.id);
    if (isMember) return res.status(400).json({ message: 'You are already a member of this workspace' });

    workspace.members.push({ user: req.user.id, role: 'member' });
    await workspace.save();
    res.json(workspace);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   GET /api/workspaces/:id
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
// @desc    Change a member's role and notify them live
router.put('/:id/members/:userId', auth, async (req, res) => {
  try {
    const { role } = req.body;
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const requester = workspace.members.find(m => m.user.toString() === req.user.id);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      return res.status(403).json({ message: 'Only Owners and Admins can modify roles' });
    }

    const targetMember = workspace.members.find(m => m.user.toString() === req.params.userId);
    if (!targetMember) return res.status(404).json({ message: 'Target user is not in this workspace' });

    if (requester.role === 'admin' && (targetMember.role === 'owner' || role === 'owner')) {
      return res.status(403).json({ message: 'Admins cannot modify or assign Owner roles' });
    }
    if (req.user.id === req.params.userId && role !== 'owner') {
        return res.status(400).json({ message: 'Owners cannot demote themselves. Transfer ownership first.' });
    }

    targetMember.role = role;
    await workspace.save();

    // LIVE NOTIFICATION: Role Change
    if (req.user.id !== req.params.userId) {
      const notification = new Notification({
        user: req.params.userId,
        message: `Your role in "${workspace.name}" was updated to ${role.toUpperCase()}.`
      });
      await notification.save();
      const io = req.app.get('io');
      if (io) io.to(req.params.userId).emit('new_notification', notification);
    }

    res.json(workspace);
  } catch (err) { res.status(500).send('Server Error'); }
});

// @route   DELETE /api/workspaces/:id/members/:userId
// @desc    Remove a member and force redirect them live
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const requester = workspace.members.find(m => m.user.toString() === req.user.id);
    const targetMember = workspace.members.find(m => m.user.toString() === req.params.userId);

    if (!requester || !targetMember) return res.status(404).json({ message: 'User not found in workspace' });

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

    // LIVE NOTIFICATION & KICK REDIRECT
    if (req.user.id !== req.params.userId) {
      const notification = new Notification({
        user: req.params.userId,
        message: `You were removed from the workspace "${workspace.name}" by an Admin.`
      });
      await notification.save();
      
      const io = req.app.get('io');
      if (io) {
        io.to(req.params.userId).emit('new_notification', notification);
        // Special event to force the frontend to kick the user
        io.to(req.params.userId).emit('kicked_from_workspace', workspace._id); 
      }
    }

    res.json(workspace);
  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
