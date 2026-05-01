/**
 * translate.js
 * Uses MyMemory Translation API — completely free, no API key needed.
 * https://mymemory.translated.net/doc/spec.php
 * Free tier: 1,000 words/day (more than enough for meetings)
 */

// Map our language codes to MyMemory language pair codes
const LANG_MAP = {
  'es':    'es',
  'fr':    'fr',
  'de':    'de',
  'it':    'it',
  'pt':    'pt',
  'ru':    'ru',
  'zh':    'zh-CN',
  'zh-TW': 'zh-TW',
  'ja':    'ja',
  'ko':    'ko',
  'ar':    'ar',
  'hi':    'hi',
  'bn':    'bn',
  'tr':    'tr',
  'nl':    'nl',
  'pl':    'pl',
  'sv':    'sv',
  'da':    'da',
  'fi':    'fi',
  'uk':    'uk',
  'el':    'el',
  'he':    'he',
  'th':    'th',
  'vi':    'vi',
  'id':    'id',
  'ms':    'ms',
  'cs':    'cs',
  'ro':    'ro',
  'sw':    'sw',
  'tl':    'tl',
};

/**
 * Translate a single line using MyMemory API.
 * @param {string} text
 * @param {string} targetLangCode - our internal code e.g. 'fr', 'ja'
 */
export async function translateLine(text, targetLangCode) {
  if (!text?.trim()) return text;

  const langCode = LANG_MAP[targetLangCode] || targetLangCode;
  const langPair = `en|${langCode}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`NETWORK: ${err.message}`);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  // responseStatus 200 = success, 429 = quota exceeded
  if (data.responseStatus !== 200) {
    throw new Error(`MyMemory: ${data.responseMessage || data.responseStatus}`);
  }

  const translated = data.responseData?.translatedText;
  if (!translated) throw new Error('Empty translation response');

  console.log(`[Translate ✓] ${targetLangCode}: "${text.slice(0, 40)}" → "${translated.slice(0, 40)}"`);
  return translated;
}

/**
 * Translate multiple lines — MyMemory doesn't support batch,
 * so we fire requests in parallel (fast).
 * @param {Array<{speaker, text}>} lines
 * @param {string} targetLangCode
 */
export async function translateBatch(lines, targetLangCode) {
  if (!lines?.length) return lines;

  const results = await Promise.all(
    lines.map(async (line) => {
      try {
        const translated = await translateLine(line.text, targetLangCode);
        return { ...line, text: translated, originalText: line.text };
      } catch {
        return { ...line, originalText: line.text }; // keep original on error
      }
    })
  );

  console.log(`[Translate-batch ✓] ${lines.length} lines → ${targetLangCode}`);
  return results;
}

/**
 * Test translation — used by the 🧪 button.
 */
export async function testApiKey() {
  const result = await translateLine('Hello, this is a test.', 'fr');
  return { ok: true, model: 'MyMemory (free, no key needed)', result };
}

// Not needed anymore but exported so nothing breaks
export function getApiKey() { return 'mymemory'; }
