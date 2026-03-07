import { useState, useRef, useEffect, useCallback } from 'react';
import { streamChatMessage, fetchSessions, fetchSessionDetail, deleteSession } from '../api/ai';
import './ChatWidget.css';

function ChatBubble({ msg }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isUser = msg.role === 'user';

  return (
    <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
      {!isUser && msg.reasoning_content && (
        <button
          className="chat-reasoning-toggle"
          onClick={() => setShowReasoning(v => !v)}
        >
          {showReasoning ? '▾ Скрыть рассуждение' : '▸ Показать рассуждение'}
        </button>
      )}
      {!isUser && showReasoning && msg.reasoning_content && (
        <div className="chat-reasoning">{msg.reasoning_content}</div>
      )}
      <div className="chat-bubble-text">{msg.content}</div>
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [showHint, setShowHint] = useState(false);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = () => {
      if (!open) {
        setShowHint(true);
        const timer = setTimeout(() => setShowHint(false), 7000);
        return () => clearTimeout(timer);
      }
    };
    window.addEventListener('vm-create-opened', handler);
    return () => window.removeEventListener('vm-create-opened', handler);
  }, [open]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const loadSessions = async () => {
    try {
      const data = await fetchSessions();
      setSessions(data);
    } catch {}
  };

  const loadSession = async (sid) => {
    try {
      const data = await fetchSessionDetail(sid);
      setMessages(data.messages.map(m => ({
        role: m.role,
        content: m.content,
        reasoning_content: m.reasoning_content,
      })));
      setSessionId(sid);
      setShowSessions(false);
    } catch {}
  };

  const handleDeleteSession = async (sid, e) => {
    e.stopPropagation();
    try {
      await deleteSession(sid);
      setSessions(prev => prev.filter(s => s.id !== sid));
      if (sessionId === sid) {
        setSessionId(null);
        setMessages([]);
      }
    } catch {}
  };

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setShowSessions(false);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreamingContent('');
    setStreamingReasoning('');

    const controller = new AbortController();
    abortRef.current = controller;

    let contentAcc = '';
    let reasoningAcc = '';
    let resolvedSessionId = sessionId;

    try {
      await streamChatMessage({
        sessionId,
        text,
        thinking,
        signal: controller.signal,
        onSessionId: (sid) => {
          resolvedSessionId = sid;
          setSessionId(sid);
        },
        onContent: (delta) => {
          contentAcc += delta;
          setStreamingContent(contentAcc);
        },
        onReasoning: (delta) => {
          reasoningAcc += delta;
          setStreamingReasoning(reasoningAcc);
        },
        onError: (msg) => {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `Ошибка: ${msg}`,
          }]);
        },
        onDone: () => {},
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Ошибка: ${err.message}`,
        }]);
      }
    }

    if (contentAcc) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: contentAcc,
        reasoning_content: reasoningAcc || null,
      }]);
    }

    setStreamingContent('');
    setStreamingReasoning('');
    setLoading(false);
    abortRef.current = null;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  if (!open) {
    return (
      <>
        {showHint && (
          <div className="chat-fab-hint" onClick={() => { setShowHint(false); setOpen(true); }}>
            Не можете выбрать? Спросите нашего AI консультанта.
          </div>
        )}
        <button className="chat-fab" onClick={() => { setShowHint(false); setOpen(true); }} title="AI Помощник">
          <span className="chat-fab-icon">AI</span>
        </button>
      </>
    );
  }

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-header-ai-badge">AI</span>
          <span className="chat-header-title">Помощник</span>
        </div>
        <div className="chat-header-actions">
          <button
            className="chat-header-btn"
            onClick={() => { setShowSessions(v => !v); if (!showSessions) loadSessions(); }}
            title="История"
          >☰</button>
          <button className="chat-header-btn" onClick={handleNewChat} title="Новый чат">+</button>
          <button className="chat-header-btn" onClick={() => setOpen(false)} title="Закрыть">✕</button>
        </div>
      </div>

      {showSessions && (
        <div className="chat-sessions-panel">
          <div className="chat-sessions-title">История чатов</div>
          {sessions.length === 0 && <div className="chat-sessions-empty">Нет сохранённых чатов</div>}
          {sessions.map(s => (
            <div key={s.id} className="chat-session-item" onClick={() => loadSession(s.id)}>
              <div className="chat-session-item-title">{s.title || 'Без названия'}</div>
              <div className="chat-session-item-meta">
                {new Date(s.updated_at).toLocaleDateString('ru-RU')} · {s.message_count} сообщ.
              </div>
              <button className="chat-session-delete" onClick={(e) => handleDeleteSession(s.id, e)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            <div className="chat-empty-icon">AI</div>
            <div className="chat-empty-title">Привет! Я AI-помощник</div>
            <div className="chat-empty-sub">
              Помогу подобрать конфигурацию, расскажу про тарифы и помогу с настройкой инфраструктуры.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} />
        ))}

        {loading && streamingContent && (
          <div className="chat-bubble chat-bubble-assistant">
            {streamingReasoning && (
              <div className="chat-reasoning chat-reasoning-streaming">{streamingReasoning}</div>
            )}
            <div className="chat-bubble-text">{streamingContent}<span className="chat-cursor">▊</span></div>
          </div>
        )}

        {loading && !streamingContent && (
          <div className="chat-bubble chat-bubble-assistant">
            <div className="chat-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-controls">
          <label className="chat-thinking-toggle" title="Режим размышления (deepseek-reasoner)">
            <input type="checkbox" checked={thinking} onChange={e => setThinking(e.target.checked)} />
            <span className="chat-thinking-label">Thinking</span>
          </label>
        </div>
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Спросите что-нибудь..."
            rows={1}
            disabled={loading}
          />
          {loading ? (
            <button className="chat-send-btn chat-stop-btn" onClick={handleStop}>■</button>
          ) : (
            <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()}>→</button>
          )}
        </div>
      </div>
    </div>
  );
}
