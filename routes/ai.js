const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// @route   POST /api/ai/enhance-task
// @desc    Generate a professional task description based on a title
router.post('/enhance-task', auth, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Task title is required for AI enhancement' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ message: 'AI API key is not configured on the server.' });
    }

    // Initialize the Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // The Prompt Engineering Instruction
    const prompt = `
      You are an expert Agile Project Manager. A developer is creating a task ticket with the following title: "${title}".
      Write a concise, professional task description. Include:
      1. A brief summary of the objective (1-2 sentences).
      2. A short bulleted list of Acceptance Criteria.
      Keep the formatting clean using basic text and dashes for bullets (no markdown bolding as it will go into a standard text box). Do not include introductory conversational text.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({ enhancedDescription: responseText.trim() });
  } catch (err) {
    console.error('Gemini API Error:', err);
    res.status(500).json({ message: 'Failed to generate AI content. Please try again later.' });
  }
});

module.exports = router;
