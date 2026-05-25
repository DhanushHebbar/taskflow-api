const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');

// @route   GET /api/chat/:projectId
// @desc    Get all chat messages for a project
router.get('/:projectId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ project: req.params.projectId })
      .populate('sender', 'name avatar role')
      .sort({ createdAt: 1 }); // Oldest first, so we scroll down to newest
    res.json(messages);
  } catch (err) {
    res.status(500).send('Server Error fetching chat');
  }
});

// @route   POST /api/chat/:projectId
// @desc    Send a new chat message
router.post('/:projectId', auth, async (req, res) => {
  try {
    const { text } = req.body;
    
    // Save the message
    const newMessage = new Message({
      project: req.params.projectId,
      sender: req.user.id,
      text
    });
    await newMessage.save();

    // Populate sender details before sending back to frontend
    const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'name avatar role');

    // Fire real-time WebSocket event to the specific project room
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.projectId).emit('new_chat_message', populatedMessage);
    }

    res.json(populatedMessage);
  } catch (err) {
    res.status(500).send('Server Error sending message');
  }
});

module.exports = router;
