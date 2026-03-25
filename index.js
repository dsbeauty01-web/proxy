const express = require('express');
const fetch = require('node-fetch');

const app = express();

app.use(express.json());

// optional but useful for frontend/avatar calls
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const N8N_WEBHOOK =
  process.env.N8N_WEBHOOK ||
  'https://rafa5555.app.n8n.cloud/webhook/22e378ba-aa29-44e6-bb40-7b434f726689/chat';

app.post('/chat/completions', async (req, res) => {
  try {
    const messages = req.body.messages || [];
    const lastMessage = messages[messages.length - 1]?.content || '';

    const n8nRes = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendMessage',
        sessionId: req.body.sessionId || 'liveavatar-session',
        chatInput: lastMessage
      })
    });

    const rawText = await n8nRes.text();

    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      data = { text: rawText };
    }

    const reply =
      data.ai_reply_text ||
      data.output ||
      data.text ||
      'I received your message.';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chunk = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: reply },
          finish_reason: null
        }
      ]
    };

    res.write(`data: ${JSON.stringify(chunk)}\n\n`);

    const doneChunk = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }
      ]
    };

    res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('Proxy running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
