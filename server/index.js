'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '200kb' }));

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.warn('OPENAI_API_KEY is not set. Endpoints will fail without a key.');
}

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

app.post('/api/rewrite', async (req, res) => {
  try {
    const { text, tone } = req.body || {};
    if (!text || typeof text !== 'string' || text.length > 20000) {
      return res.status(400).json({ error: 'Invalid text' });
    }
    const toneMap = {
      simple: 'Rewrite the following text so a 5th grader can understand it.',
      dramatic: 'Rewrite in a dramatic, narrative tone.',
      professional: 'Rewrite as a concise professional summary for executives.'
    };
    const system = 'You are a helpful assistant that rewrites content using the requested tone.';
    const userPrompt = `${toneMap[tone] || toneMap.professional}\n\nText:\n${text}`;

    const payload = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 350,
      temperature: 0.7
    };

    const r = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const textErr = await r.text();
      return res.status(500).json({ error: 'LLM provider error', details: textErr });
    }
    const body = await r.json();
    const rewritten = body.choices?.[0]?.message?.content || body.choices?.[0]?.text || '';
    return res.json({ rewritten });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/suggestion', async (req, res) => {
  try {
    const { context } = req.body || {};
    const system = 'You are a supportive assistant that provides short wellness suggestions and micro-break activities.';
    const userPrompt = context
      ? `Based on this context, provide a short (one-sentence) wellness suggestion: ${context}`
      : 'Provide a short, actionable wellness suggestion for a reader who needs a quick break.';
    const payload = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 120,
      temperature: 0.7
    };

    const r = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const textErr = await r.text();
      return res.status(500).json({ error: 'LLM provider error', details: textErr });
    }
    const body = await r.json();
    const suggestion = body.choices?.[0]?.message?.content || body.choices?.[0]?.text || '';
    return res.json({ suggestion: suggestion.trim() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
});

const PORT = process.env.PORT || 5173;

// start server when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`LLM proxy server listening on ${PORT}`);
  });
}

module.exports = app;
