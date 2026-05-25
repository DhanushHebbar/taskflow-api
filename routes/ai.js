const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize genAI globally for this router so all endpoints can use it
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Task Enhancement (Title -> Description & Priority)
router.post('/enhance-task', auth, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) return res.status(400).json({ message: 'Task title is required for AI enhancement' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ message: 'AI API key is not configured.' });

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Standardized to 1.5-flash for speed/consistency

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

// 2. Individual Task Summarization
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

// 3. Workspace-Level Executive Summarization
router.get('/summarize-workspace/:workspaceId', auth, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId).populate('members.user', 'name');
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

    const projects = await Project.find({ workspace: req.params.workspaceId });
    const tasks = await Task.find({ project: { $in: projects.map(p => p._id) } });

    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    const totalTasks = tasks.length;

    const prompt = `You are an AI Project Manager. Provide a highly professional, 3-bullet-point executive summary for the workspace "${workspace.name}". 
    Data: ${projects.length} projects, ${totalTasks} total tasks, ${completedTasks} tasks completed. 
    Focus on overall progress, velocity, and what the team should prioritize next.`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    res.json({ summary: result.response.text() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'AI Workspace Summarization failed.' });
  }
});

module.exports = router;
