// In dev: use Vite proxy (/api → localhost:3001)
// In prod: use the deployed Railway server URL
const BASE = import.meta.env.VITE_SOCKET_URL
  ? `${import.meta.env.VITE_SOCKET_URL}/api`
  : '/api';

async function request(path, options = {}) {
  const token = JSON.parse(localStorage.getItem('nexmeet-user') || '{}')?.state?.token;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  guestLogin: (name) => request('/auth/guest', { method: 'POST', body: { name } }),

  // Meetings
  createMeeting: (data) => request('/meetings/create', { method: 'POST', body: data }),
  getMeeting: (id) => request(`/meetings/${id}`),
  endMeeting: (id, duration) => request(`/meetings/${id}/end`, { method: 'POST', body: { duration } }),
  saveTranscript: (id, lines) => request(`/meetings/${id}/transcript`, { method: 'POST', body: { lines } }),
  saveSummary: (id, summary) => request(`/meetings/${id}/summary`, { method: 'POST', body: { summary } }),
  listMeetings: () => request('/meetings'),

  // AI
  summarize: (transcript, meetingTitle) =>
    request('/ai/summarize', { method: 'POST', body: { transcript, meetingTitle } }),
  extractActionItems: (transcript) =>
    request('/ai/action-items', { method: 'POST', body: { transcript } }),
  askAboutMeeting: (question, transcript, history) =>
    request('/ai/chat', { method: 'POST', body: { question, transcript, history } }),

  // Translation (free via Gemini)
  translateLine: (text, targetLanguage, speaker) =>
    request('/ai/translate', { method: 'POST', body: { text, targetLanguage, speaker } }),
  translateBatch: (lines, targetLanguage) =>
    request('/ai/translate-batch', { method: 'POST', body: { lines, targetLanguage } }),
};
