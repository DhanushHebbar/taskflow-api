const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');

// 🔴 THE AI ORCHESTRATOR ENGINE
// Orders providers by speed/cost preference. The system tries top-to-bottom.
const aiProviders = [
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: 'llama3-8b-8192' // Blazing fast
  },
  {
    name: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: process.env.CEREBRAS_API_KEY,
    model: 'llama3.1-8b'
  },
  {
    name: 'DeepInfra',
    url: 'https://api.deepinfra.com/v1/openai/chat/completions',
    key: process.env.DEEPINFRA_API_KEY,
    model: 'meta-llama/Meta-Llama-3-8B-Instruct'
  },
  {
    name: 'SambaNova',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    key: process.env.SAMBANOVA_API_KEY,
    model: 'Meta-Llama-3-8B-Instruct' 
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY,
    model: 'meta-llama/llama-3-8b-instruct:free' // Great reliable fallback
  }
];

// Helper function to handle the waterfall failover
async function generateAIContent(prompt) {
  const activeProviders = aiProviders.filter(p => p.key);

  if (activeProviders.length === 0) {
    throw new Error('No AI providers configured in environment variables.');
  }

  for (const provider of activeProviders) {
    try {
      console.log(`🧠 Attempting AI generation via ${provider.name}...`);
      
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.key}`,
          'Content-Type': 'application/json',
          // OpenRouter specific header to identify your app
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://taskflow.com', 
          'X-Title': 'TaskFlow'
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      console.log(`✅ Success via ${provider.name}!`);
      return data.choices[0].message.content.trim();

    } catch (error) {
      console.warn(`⚠️ ${provider.name} failed (${error.message}). Failing over to next provider...`);
      // Loop continues to the next provider automatically
    }
  }

  // If the loop finishes and nothing succeeded:
  throw new Error('All configured AI providers failed to generate a response.');
}


// 1. Task Enhancement (Title -> Description & Priority)
router.post('/enhance-task', auth, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: 'Task title is required.' });

    const prompt = `
      You are an expert Agile Project Manager. A developer is creating a task with the title: "${title}".
      You must respond with ONLY a valid JSON object. Do not include any markdown formatting, backticks, or conversational text.
      The JSON object must have exactly two keys:
      1. "description": A concise professional task description with a short bulleted list of Acceptance Criteria. (Use plain text dashes for bullets).
      2. "priority": Evaluate the urgency of the title and return exactly one of these strings: "High", "Medium", or "Low".
    `;

    let responseText = await generateAIContent(prompt);
    
    // Safety check: Strip markdown if the AI accidentally adds it
    responseText = responseText.replace(/^```json/i, '').replace(/```$/i, '').trim();
    
    const data = JSON.parse(responseText);

    res.json({ 
      enhancedDescription: data.description.trim(),
      suggestedPriority: data.priority 
    });
  } catch (err) {
    console.error('AI Orchestration Error:', err);
    res.status(500).json({ message: 'AI generation failed across all providers.' });
  }
});

// 2. Individual Task Summarization
router.get('/summarize-task/:taskId', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId).populate('comments.user', 'name');
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const commentText = task.comments.map(c => `${c.user?.name}: ${c.text}`).join('\n');
    const prompt = `You are a project management AI. Summarize the following task and its ongoing discussion into exactly 3 concise, actionable bullet points. 
    Task Title: ${task.title}
    Description: ${task.description || 'None'}
    Team Discussion:
    ${commentText || 'No discussion yet.'}`;

    const summary = await generateAIContent(prompt);
    res.json({ summary });
  } catch (err) {
    console.error('AI Orchestration Error:', err);
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
    Focus on overall progress, velocity, and what the team should prioritize next. Ensure you only return the 3 bullet points, nothing else.`;

    const summary = await generateAIContent(prompt);
    res.json({ summary });
  } catch (err) {
    console.error('AI Orchestration Error:', err);
    res.status(500).json({ message: 'AI Workspace Summarization failed.' });
  }
});

module.exports = router;
