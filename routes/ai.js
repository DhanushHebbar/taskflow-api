const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

router.post('/enhance-task', auth, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) return res.status(400).json({ message: 'Task title is required for AI enhancement' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ message: 'AI API key is not configured.' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // NEW: We force Gemini to return a JSON object with the exact priority
    const prompt = `
      You are an expert Agile Project Manager. A developer is creating a task with the title: "${title}".
      You must respond with ONLY a valid JSON object. Do not include any markdown formatting, backticks, or conversational text.
      The JSON object must have exactly two keys:
      1. "description": A concise professional task description with a short bulleted list of Acceptance Criteria. (Use plain text dashes for bullets).
      2. "priority": Evaluate the urgency of the title and return exactly one of these strings: "High", "Medium", or "Low".
    `;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();
    
    // Safety check: Strip markdown if Gemini accidentally adds it
    responseText = responseText.replace(/^```json/i, '').replace(/```$/i, '').trim();
    
    const data = JSON.parse(responseText);

    res.json({ 
      enhancedDescription: data.description.trim(),
      suggestedPriority: data.priority 
    });
  } catch (err) {
    console.error('Gemini API Error:', err);
    res.status(500).json({ message: 'Failed to generate AI content. Please try again later.' });
  }
});

// 🔴 NEW: AI Task Summarization
router.get('/summarize-task/:taskId', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId).populate('comments.user', 'name');
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Compile all task data and chat history for the AI
    const commentText = task.comments.map(c => `${c.user?.name}: ${c.text}`).join('\n');
    const prompt = `You are a project management AI. Summarize the following task and its ongoing discussion into exactly 3 concise, actionable bullet points. 
    Task Title: ${task.title}
    Description: ${task.description || 'None'}
    Team Discussion:
    ${commentText || 'No discussion yet.'}`;

    const result = await model.generateContent(prompt);
    res.json({ summary: result.response.text() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'AI Summarization failed.' });
  }
});

module.exports = router;
module.exports = router;
