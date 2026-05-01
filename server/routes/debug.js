const express = require('express');
const router = express.Router();

// GET /api/debug/models
// Lists all Gemini models available for your API key
router.get('/models', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(400).json({ error: 'No GEMINI_API_KEY set' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
    );
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'API error', raw: data });
    }

    // Filter to only models that support generateContent
    const usable = (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => ({ name: m.name, displayName: m.displayName }));

    res.json({ total: usable.length, models: usable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
