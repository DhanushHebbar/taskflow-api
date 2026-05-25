const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Note = require('../models/Note');

// @route   GET /api/notes
// @desc    Get all personal notes for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.find({ user: req.user.id }).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).send('Server Error fetching notes');
  }
});

// @route   POST /api/notes
// @desc    Create a new note
router.post('/', auth, async (req, res) => {
  try {
    const { title, type } = req.body;
    const newNote = new Note({
      user: req.user.id,
      title: title || 'Untitled Note',
      type: type || 'text'
    });
    const note = await newNote.save();
    res.json(note);
  } catch (err) {
    res.status(500).send('Server Error creating note');
  }
});

// @route   PUT /api/notes/:id
// @desc    Update a note (text or drawing data)
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, drawing } = req.body;
    let note = await Note.findOne({ _id: req.params.id, user: req.user.id });
    
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (title) note.title = title;
    if (content !== undefined) note.content = content;
    if (drawing !== undefined) note.drawing = drawing;
    note.updatedAt = Date.now();

    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).send('Server Error updating note');
  }
});

// @route   DELETE /api/notes/:id
// @desc    Delete a note
router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note removed' });
  } catch (err) {
    res.status(500).send('Server Error deleting note');
  }
});

module.exports = router;
