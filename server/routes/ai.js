const express = require('express');
const router = express.Router();

const GEMINI_KEY = () => process.env.GEMINI_API_KEY || '';

// Use direct REST API instead of SDK — avoids network issues with the SDK
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash-lite',
];

let cachedModel = null;

async function geminiRequest(prompt) {
  const key = GEMINI_KEY();
  if (!key) throw new Error('GEMINI_API_KEY not set in server/.env');

  // Try cached model first
  const modelsToTry = cachedModel
    ? [cachedModel, ...CANDIDATE_MODELS.filter(m => m !== cachedModel)]
    : CANDIDATE_MODELS;

  let lastError = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        console.log(`[Gemini] ✗ ${model}: ${msg.slice(0, 100)}`);
        lastError = new Error(msg);
        // Bad key — no point trying others
        if (res.status === 400 || res.status === 403) throw lastError;
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error('Empty response from Gemini');

      cachedModel = model;
      console.log(`[Gemini] ✓ ${model}`);
      return text;

    } catch (err) {
      // Network error — don't try other models, it'll fail too
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.name === 'TypeError') {
        throw new Error(`Network error reaching Google API: ${err.message}. Check your internet connection or firewall.`);
      }
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

function handleError(res, err) {
  console.error('[Gemini] Error:', err.message);
  res.status(500).json({ error: err.message });
}

// ── Routes ────────────────────────────────────────────────────────────────

router.post('/summarize', async (req, res) => {
  try {
    const { transcript, meetingTitle } = req.body;
    if (!transcript?.length) return res.status(400).json({ error: 'transcript required' });

    const transcriptText = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');

    const raw = await geminiRequest(
      `Analyze this meeting transcript${meetingTitle ? ` titled "${meetingTitle}"` : ''} and return a structured JSON summary.

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "overview": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "decisions": ["decision 1", "decision 2"],
  "actionItems": [{ "task": "...", "owner": "...", "due": "..." }],
  "nextSteps": "brief next steps",
  "sentiment": "positive|neutral|mixed|negative",
  "topics": ["topic1", "topic2"]
}

Transcript:
${transcriptText}`
    );

    const summary = JSON.parse(raw.replace(/```json|```/g, '').trim());
    res.json({ success: true, summary });
  } catch (err) { handleError(res, err); }
});

router.post('/action-items', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript?.length) return res.status(400).json({ error: 'transcript required' });

    const raw = await geminiRequest(
      `Extract action items. Return ONLY a JSON array, no markdown:\n[{"task":"...","owner":"...","due":"..."}]\n\nTranscript:\n${transcript.map(t => `${t.speaker}: ${t.text}`).join('\n')}`
    );

    res.json({ success: true, actionItems: JSON.parse(raw.replace(/```json|```/g, '').trim()) });
  } catch (err) { handleError(res, err); }
});

router.post('/chat', async (req, res) => {
  try {
    const { question, transcript } = req.body;
    if (!question || !transcript?.length) return res.status(400).json({ error: 'question and transcript required' });

    const answer = await geminiRequest(
      `Based on this meeting transcript, answer the question concisely.\n\nTranscript:\n${transcript.map(t => `${t.speaker}: ${t.text}`).join('\n')}\n\nQuestion: ${question}`
    );

    res.json({ success: true, answer });
  } catch (err) { handleError(res, err); }
});

router.post('/translate', async (req, res) => {
  try {
    const { text, targetLanguage, speaker } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: 'text and targetLanguage required' });

    const translated = await geminiRequest(
      `Translate to ${targetLanguage}. Return ONLY the translated text, nothing else.\n\nText: ${text}`
    );

    res.json({ success: true, translated, speaker, original: text });
  } catch (err) { handleError(res, err); }
});

router.post('/translate-batch', async (req, res) => {
  try {
    const { lines, targetLanguage } = req.body;
    if (!lines?.length || !targetLanguage) return res.status(400).json({ error: 'lines and targetLanguage required' });

    const numbered = lines.map((l, i) => `${i + 1}. ${l.text}`).join('\n');
    const raw = await geminiRequest(
      `Translate each numbered line to ${targetLanguage}. Return ONLY the translated lines in the same numbered format.\n\n${numbered}`
    );

    const texts = raw.split('\n')
      .filter(l => /^\d+[\.\)]/.test(l.trim()))
      .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim());

    res.json({
      success: true,
      lines: lines.map((l, i) => ({ ...l, text: texts[i] ?? l.text, originalText: l.text })),
    });
  } catch (err) { handleError(res, err); }
});

module.exports = router;
