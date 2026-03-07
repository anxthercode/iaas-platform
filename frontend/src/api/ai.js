import api from "./api";

export async function sendChatMessage({ sessionId, text, thinking = false }) {
  const payload = { text, thinking };
  if (sessionId) payload.session_id = sessionId;
  const { data } = await api.post("/ai/chat/", payload);
  return data;
}

export async function streamChatMessage({
  sessionId,
  text,
  thinking = false,
  onContent,
  onReasoning,
  onSessionId,
  onError,
  onDone,
  signal,
}) {
  const token = localStorage.getItem("access_token");
  const payload = { text, thinking };
  if (sessionId) payload.session_id = sessionId;

  const res = await fetch("/api/ai/chat/stream/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();

      if (payload === "[DONE]") {
        onDone?.();
        return;
      }

      try {
        const parsed = JSON.parse(payload);
        if (parsed.type === "content") onContent?.(parsed.delta);
        else if (parsed.type === "reasoning") onReasoning?.(parsed.delta);
        else if (parsed.type === "session_id") onSessionId?.(parsed.session_id);
        else if (parsed.type === "error") onError?.(parsed.message);
      } catch {}
    }
  }

  onDone?.();
}

export async function streamAnalyticsMessage({
  sessionId,
  text,
  onContent,
  onReasoning,
  onSessionId,
  onError,
  onDone,
  signal,
}) {
  const token = localStorage.getItem("access_token");
  const payload = { text };
  if (sessionId) payload.session_id = sessionId;

  const res = await fetch("/api/ai/analytics/stream/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();

      if (payload === "[DONE]") {
        onDone?.();
        return;
      }

      try {
        const parsed = JSON.parse(payload);
        if (parsed.type === "content") onContent?.(parsed.delta);
        else if (parsed.type === "reasoning") onReasoning?.(parsed.delta);
        else if (parsed.type === "session_id") onSessionId?.(parsed.session_id);
        else if (parsed.type === "error") onError?.(parsed.message);
      } catch {}
    }
  }

  onDone?.();
}

export async function fetchSessions() {
  const { data } = await api.get("/ai/sessions/");
  return data;
}

export async function fetchSessionDetail(sessionId) {
  const { data } = await api.get(`/ai/sessions/${sessionId}/`);
  return data;
}

export async function deleteSession(sessionId) {
  await api.delete(`/ai/sessions/${sessionId}/`);
}
