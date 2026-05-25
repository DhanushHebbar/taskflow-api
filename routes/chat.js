const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const Notification = require('../models/Notification');

// @route   GET /api/chat/:projectId
router.get('/:projectId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ project: req.params.projectId })
      .populate('sender', 'name avatar role')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).send('Server Error fetching chat');
  }
});

// @route   POST /api/chat/:projectId
router.post('/:projectId', auth, async (req, res) => {
  try {
    const { text } = req.body;
    
    const newMessage = new Message({
      project: req.params.projectId,
      sender: req.user.id,
      text
    });
    await newMessage.save();

    const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'name avatar role');

    // 🔴 MENTION ENGINE FOR CHAT
    const mentions = text.match(/@([a-zA-Z0-9_]+)/g);
    if (mentions) {
       const project = await Project.findById(req.params.projectId);
       const workspace = await Workspace.findById(project.workspace).populate('members.user');
       
       for (const mention of mentions) {
         const namePart = mention.substring(1).toLowerCase();
         const mentionedMember = workspace.members.find(m => m.user && m.user.name && m.user.name.toLowerCase().includes(namePart));
         
         if (mentionedMember && mentionedMember.user._id.toString() !== req.user.id) {
            const newNotification = new Notification({
              user: mentionedMember.user._id,
              message: `💬 ${populatedMessage.sender.name} mentioned you in the team chat!`
            });
            await newNotification.save();
            const io = req.app.get('io');
            if (io) {
              io.to(mentionedMember.user._id.toString()).emit('new_notification', newNotification);
            }
         }
       }
    }

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.projectId).emit('new_chat_message', populatedMessage);
    }

    res.json(populatedMessage);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error sending message');
  }
});

module.exports = router;
