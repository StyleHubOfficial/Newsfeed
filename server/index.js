'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '200kb' }));

// Configuration
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const LOCAL_MODEL_URL = process.env.LOCAL_MODEL_URL || '';
const mode = OPENAI_KEY ? 'openai' : (LOCAL_MODEL_URL ? 'local' : 'simulate');

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Helper: call OpenAI
async function callOpenAI(payload) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set');
  const r = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const t = await r.text();
    const err = new Error('OpenAI error: ' + r.status);
    err.details = t;
    throw err;
  }
  return r.json();
}

// Helper: forward to local model
async function forwardToLocal(pathSuffix, body) {
  if (!LOCAL_MODEL_URL) throw new Error('LOCAL_MODEL_URL not set');
  const url = new URL(pathSuffix, LOCAL_MODEL_URL).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    const e = new Error('Local model error');
    e.details = t;
    throw e;
  }
  return res.json();
}

// Simulated responses for demo mode
function simulatedRewrite(text, tone) {
  const map = {
    simple: `Simple: ${text.split('.').slice(0,2).join('. ')}. In short: ${text.slice(0,80)}...`,
    dramatic: `Dramatic: In the quiet lab, a breakthrough unfolded — ${text.slice(0,120)}...`,
    professional: `Professional summary: ${text.slice(0,200)}`
  };
  return map[tone] || map.professional;
}
function simulatedSuggestion(context) {
  const tips = [
    'Take a 60-second standing break and stretch your shoulders.',
    'Look away from the screen for 30 seconds and breathe deeply.',
    'Do five slow, deep breaths and focus on your posture for 1 minute.'
  ];
  if (context && /tired|fatigue|sleep/i.test(context)) return 'You seem tired — stand up and walk for 2 minutes.';
  return tips[Math.floor(Math.random()*tips.length)];
}

// API: mode
app.get('/api/mode', (req, res) => {
  res.json({ mode, info: mode === 'openai' ? 'Using OpenAI (requires key)' : (mode === 'local' ? `Forwarding to local model: ${LOCAL_MODEL_URL}` : 'Simulation mode — no API key or local model configured') });
});

// POST /api/rewrite
app.post('/api/rewrite', async (req, res) => {
  try {
    const { text, tone } = req.body || {};
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text is required' });

    if (mode === 'openai') {
      const payload = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You rewrite text in the requested tone.' },
          { role: 'user', content: `${tone || 'professional'} rewrite:\n\n${text}` }
        ],
        temperature: 0.7,
        max_tokens: 500
      };
      const body = await callOpenAI(payload);
      const rewritten = body?.choices?.[0]?.message?.content || body?.choices?.[0]?.text || '';
      return res.json({ rewritten });
    } else if (mode === 'local') {
      const r = await forwardToLocal('/rewrite', { text, tone });
      return res.json({ rewritten: r.rewritten || r.output || JSON.stringify(r) });
    } else {
      const rewritten = simulatedRewrite(text, tone);
      return res.json({ rewritten });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', details: err?.details || err.message });
  }
});

// POST /api/suggestion
app.post('/api/suggestion', async (req, res) => {
  try {
    const { context } = req.body || {};
    if (mode === 'openai') {
      const payload = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You provide a short wellness suggestion (one sentence).' },
          { role: 'user', content: `Context: ${context || 'general'}. Provide a concise wellness suggestion.` }
        ],
        temperature: 0.7,
        max_tokens: 120
      };
      const body = await callOpenAI(payload);
      const suggestion = body?.choices?.[0]?.message?.content || body?.choices?.[0]?.text || '';
      return res.json({ suggestion: suggestion.trim() });
    } else if (mode === 'local') {
      const r = await forwardToLocal('/suggestion', { context });
      return res.json({ suggestion: r.suggestion || r.output || JSON.stringify(r) });
    } else {
      const suggestion = simulatedSuggestion(context);
      return res.json({ suggestion });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', details: err?.details || err.message });
  }
});

// Serve static frontend from server/public
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

const PORT = process.env.PORT || 5173;
if (require.main === module) {
  app.listen(PORT, () => console.log(`LLM proxy + static server listening on ${PORT} (mode=${mode})`));
}

module.exports = app;