const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');

// @route   GET /api/search?q=keyword
// @desc    Global text search across all tasks
router.get('/', auth, async (req, res) => {
  try {
    const { q } = req.query;
    
    // If search is empty, return nothing
    if (!q || q.trim() === '') {
      return res.json({ tasks: [] });
    }

    // 🔴 Use MongoDB's ultra-fast $text operator
    const tasks = await Task.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" } } // This gets the relevance score
    )
    .populate('project', 'name') // Pull in the project name so we know where the task lives
    .populate('assignedTo', 'name')
    .sort({ score: { $meta: "textScore" } }) // Sort by best match first
    .limit(10); // Limit to top 10 results to keep the UI snappy

    res.json({ tasks });
  } catch (err) {
    console.error('Search API Error:', err);
    res.status(500).send('Server Error during search');
  }
});

module.exports = router;
