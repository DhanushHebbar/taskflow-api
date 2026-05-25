const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Untitled Note' },
  content: { type: String, default: '' }, // Stores text
  drawing: { type: String, default: '' }, // Stores base64 image data from the canvas
  type: { type: String, enum: ['text', 'drawing'], default: 'text' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', NoteSchema);
