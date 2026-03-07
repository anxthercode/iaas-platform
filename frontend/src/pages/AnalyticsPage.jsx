import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';
import { streamAnalyticsMessage } from '../api/ai';

function generateRecommendations(tenants, allVMs, proxmoxNodes) {
  const recs = [];

  for (const t of tenants) {
    const cpuPct = t.quota.cpu ? Math.round(t.usage.cpu / t.quota.cpu * 100) : 0;
    const ramPct = t.quota.ram ? Math.round(t.usage.ram / t.quota.ram * 100) : 0;
    const diskPct = t.quota.disk ? Math.round(t.usage.disk / t.quota.disk * 100) : 0;
    const maxPct = Math.max(cpuPct, ramPct, diskPct);

    if (maxPct >= 85) {
      const resource = cpuPct >= 85 ? 'CPU' : ramPct >= 85 ? 'RAM' : 'Disk';
      recs.push({
        title: `Квота ${resource} критична: ${t.name}`,
        desc: `Тенант ${t.name} использует ${maxPct}% ${resource}-квоты (${resource === 'CPU' ? t.usage.cpu + '/' + t.quota.cpu + ' ядер' : resource === 'RAM' ? t.usage.ram + '/' + t.quota.ram + ' GB' : t.usage.disk + '/' + t.quota.disk + ' GB'}). Рекомендуется увеличить лимит для предотвращения отказов.`,
        priority: 'HIGH', color: '#ef4444',
        saving: 'Предотвращение инцидентов',
      });
    } else if (maxPct < 15 && t.usage.vm > 0) {
      recs.push({
        title: `Ресурсы простаивают: ${t.name}`,
        desc: `Тенант ${t.name} использует всего ${maxPct}% ресурсов. Можно перераспределить неиспользуемые мощности.`,
        priority: 'LOW', color: '#3b82f6',
        saving: 'Оптимизация расходов',
      });
    }
  }

  if (proxmoxNodes.length >= 2) {
    const loads = proxmoxNodes.map(n => ({
      host: n.host,
      cpuPct: n.cpuTotal ? Math.round(n.cpuUsed / n.cpuTotal * 100) : 0,
      vms: n.vms,
    }));
    const maxLoad = Math.max(...loads.map(l => l.cpuPct));
    const minLoad = Math.min(...loads.map(l => l.cpuPct));

    if (maxLoad - minLoad > 30) {
      const heavy = loads.find(l => l.cpuPct === maxLoad);
      const light = loads.find(l => l.cpuPct === minLoad);
      recs.push({
        title: 'Дисбаланс нагрузки между нодами',
        desc: `${heavy.host} загружена на ${maxLoad}% CPU, а ${light.host} — лишь на ${minLoad}%. Рекомендуется миграция ВМ для выравнивания.`,
        priority: 'MEDIUM', color: '#f59e0b',
        saving: `Снижение нагрузки ${heavy.host}: ${maxLoad}→${Math.round((maxLoad + minLoad) / 2)}%`,
      });
    }

    for (const n of loads) {
      if (n.cpuPct >= 80) {
        recs.push({
          title: `Высокая загрузка: ${n.host}`,
          desc: `Нода ${n.host} работает на ${n.cpuPct}% CPU при ${n.vms} активных ВМ. Рассмотрите балансировку или добавление мощностей.`,
          priority: 'HIGH', color: '#ef4444',
          saving: 'Снижение риска отказа',
        });
      }
    }
  }

  const stoppedVMs = allVMs.filter(v => v.status === 'stopped');
  if (stoppedVMs.length >= 2) {
    const totalCpu = stoppedVMs.reduce((s, v) => s + v.cpu, 0);
    const totalRam = stoppedVMs.reduce((s, v) => s + v.ram, 0);
    recs.push({
      title: `${stoppedVMs.length} остановленных ВМ занимают ресурсы`,
      desc: `Остановленные ВМ (${stoppedVMs.map(v => v.name).slice(0, 3).join(', ')}${stoppedVMs.length > 3 ? '...' : ''}) резервируют ${totalCpu} vCPU и ${totalRam} GB RAM. Удалите неиспользуемые для освобождения квот.`,
      priority: 'LOW', color: '#3b82f6',
      saving: `~${totalCpu} vCPU, ${totalRam} GB RAM`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: 'Инфраструктура в хорошем состоянии',
      desc: 'Нагрузка сбалансирована, квоты не превышены, критических рекомендаций нет.',
      priority: 'OK', color: '#22c55e',
      saving: 'Всё в норме',
    });
  }

  return recs;
}

function generateInsights(tenants, allVMs, proxmoxNodes) {
  const insights = [];

  for (const t of tenants) {
    const ramPct = t.quota.ram ? Math.round(t.usage.ram / t.quota.ram * 100) : 0;
    if (ramPct >= 75) {
      insights.push({
        icon: '💡',
        tenant: t.name,
        text: `Использует ${ramPct}% RAM-квоты (${t.usage.ram}/${t.quota.ram} GB). При текущем темпе лимит будет исчерпан в ближайшее время.`,
      });
    }
  }

  for (const n of proxmoxNodes) {
    const cpuPct = n.cpuTotal ? Math.round(n.cpuUsed / n.cpuTotal * 100) : 0;
    if (cpuPct >= 70) {
      insights.push({
        icon: '⚙️',
        tenant: n.host,
        text: `Нагрузка CPU ${cpuPct}%. На ноде работает ${n.vms} ВМ. Мониторьте деградацию производительности.`,
      });
    }
  }

  const smallVMs = allVMs.filter(v => v.status === 'active' && v.cpu <= 1 && v.ram <= 1);
  if (smallVMs.length > 0) {
    insights.push({
      icon: '📉',
      tenant: `${smallVMs.length} мини-ВМ`,
      text: `Обнаружены ВМ с минимальными ресурсами (≤1 vCPU, ≤1 GB RAM). Рассмотрите консолидацию для снижения overhead.`,
    });
  }

  const totalVMs = allVMs.length;
  const activeVMs = allVMs.filter(v => v.status === 'active').length;
  if (totalVMs > 0) {
    insights.push({
      icon: '📊',
      tenant: 'Общая статистика',
      text: `Всего ${totalVMs} ВМ, из них ${activeVMs} активных (${Math.round(activeVMs / totalVMs * 100)}%). ${tenants.length} тенантов на ${proxmoxNodes.length} нодах.`,
    });
  }

  return insights;
}

function generateAnomalies(tenants, allVMs) {
  const anomalies = [];
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ru-RU').slice(0, 5);

  const errorVMs = allVMs.filter(v => v.status === 'error');
  for (const vm of errorVMs) {
    anomalies.push({
      time: timeStr, severity: 'warn',
      subject: vm.name,
      msg: `ВМ в статусе error. Тенант: ${vm.tenant || 'N/A'}. Требуется диагностика.`,
    });
  }

  for (const t of tenants) {
    const vmPct = t.quota.vm ? Math.round(t.usage.vm / t.quota.vm * 100) : 0;
    if (vmPct >= 100) {
      anomalies.push({
        time: timeStr, severity: 'warn',
        subject: t.name,
        msg: `Лимит ВМ исчерпан (${t.usage.vm}/${t.quota.vm}). Новые ВМ создать невозможно.`,
      });
    }
  }

  if (anomalies.length === 0) {
    anomalies.push({
      time: timeStr, severity: 'info',
      subject: 'Система',
      msg: 'Аномалий не обнаружено. Все показатели в пределах нормы.',
    });
  }

  return anomalies;
}

const PRESETS = [
  'Какие ВМ можно оптимизировать?',
  'Какой тенант ближе всего к лимиту?',
  'Дай общую оценку состояния кластера',
  'Предложи план масштабирования',
];

export default function AnalyticsPage() {
  const { tenants, getAllVMs, proxmoxNodes, refreshVMs, refreshTenants } = useApp();
  const allVMs = getAllVMs();

  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const [report, setReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSessionId, setReportSessionId] = useState(null);
  const reportAbortRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');
  const chatEndRef = useRef(null);
  const abortRef = useRef(null);

  const recommendations = generateRecommendations(tenants, allVMs, proxmoxNodes);
  const insights = generateInsights(tenants, allVMs, proxmoxNodes);
  const anomalies = generateAnomalies(tenants, allVMs);

  const generateReport = useCallback(async () => {
    if (reportLoading) return;
    setReportLoading(true);
    setReport('');

    if (reportAbortRef.current) reportAbortRef.current.abort();
    const ac = new AbortController();
    reportAbortRef.current = ac;

    try {
      await streamAnalyticsMessage({
        sessionId: null,
        text: 'Проведи полный анализ текущего состояния инфраструктуры. Оцени риски по каждому тенанту, состояние нод кластера, распределение ВМ. Дай конкретные рекомендации с цифрами. Пиши чистым текстом без markdown-разметки.',
        onContent: (delta) => setReport(prev => prev + delta),
        onSessionId: (sid) => setReportSessionId(sid),
        onError: (msg) => setReport(prev => prev + `\n\nОшибка: ${msg}`),
        onDone: () => {},
        signal: ac.signal,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setReport(prev => prev || `Ошибка генерации отчёта: ${err.message}`);
      }
    } finally {
      setReportLoading(false);
    }
  }, [reportLoading]);

  useEffect(() => {
    generateReport();
    return () => { if (reportAbortRef.current) reportAbortRef.current.abort(); };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshVMs(), refreshTenants()]);
      setLastUpdate(new Date());
    } catch {}
    setRefreshing(false);
    generateReport();
  };

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStreamingContent('');

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamAnalyticsMessage({
        sessionId,
        text,
        onContent: (delta) => setStreamingContent(prev => prev + delta),
        onSessionId: (sid) => setSessionId(sid),
        onError: (msg) => {
          setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${msg}` }]);
        },
        onDone: () => {
          setStreamingContent(prev => {
            if (prev) setMessages(m => [...m, { role: 'assistant', content: prev }]);
            return '';
          });
        },
        signal: ac.signal,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `Ошибка: ${err.message}` }]);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div>
      <Topbar title="AI Анализ">
        <span style={{
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: '#fff', padding: '4px 12px', borderRadius: 20,
          fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
        }}>✦ AI-powered</span>
      </Topbar>

      <div className="page-content">
        {/* AI Text Report */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: '22px 24px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 24,
          borderTop: '3px solid #764ba2',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontWeight: 900, fontSize: 17,
            }}>✦ Аналитический отчёт</span>
            {reportLoading && <span style={{ fontSize: 12, color: '#9ca3af' }}>Генерация...</span>}
          </div>
          <div style={{
            fontSize: 14, color: '#1a2332', lineHeight: 1.8, whiteSpace: 'pre-wrap',
            minHeight: 80,
          }}>
            {report || (reportLoading
              ? <span style={{ color: '#9ca3af' }}>AI анализирует текущее состояние инфраструктуры...</span>
              : <span style={{ color: '#9ca3af' }}>Нажмите «Обновить данные» для генерации отчёта</span>
            )}
            {reportLoading && <span style={{ animation: 'blink 1s infinite', color: '#764ba2' }}>▌</span>}
          </div>
        </div>

        {/* Recommendations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Рекомендации</div>
          {recommendations.map((r, i) => (
            <div key={i} style={{
              background: '#fff', borderRadius: 14, padding: '20px 24px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              borderLeft: `4px solid ${r.color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{r.title}</span>
                <span style={{ background: r.color + '18', color: r.color, padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{r.priority}</span>
                <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>↗ {r.saving}</span>
              </div>
              <div style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>{r.desc}</div>
            </div>
          ))}
        </div>

        {/* Insights + Anomalies */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Инсайты</div>
            {insights.map((ins, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '14px 0',
                borderBottom: i < insights.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <span style={{ fontSize: 20, minWidth: 28 }}>{ins.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#1e3a5f' }}>{ins.tenant}</div>
                  <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{ins.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 14, padding: '22px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Аномалии</div>
            {anomalies.map((a, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '14px 0', alignItems: 'flex-start',
                borderBottom: i < anomalies.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <span style={{ fontSize: 18 }}>{a.severity === 'warn' ? '⚠️' : 'ℹ️'}</span>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span className="font-mono" style={{ fontSize: 11, color: '#9ca3af' }}>{a.time}</span>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{a.subject}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#4b5563' }}>{a.msg}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Update bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, padding: '10px 16px', background: '#fff',
          borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>
            Последнее обновление: <strong style={{ color: '#374151' }}>{lastUpdate.toLocaleTimeString('ru-RU')}</strong>
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ fontSize: 13 }}
          >
            {refreshing ? '⏳ Обновление...' : '🔄 Обновить данные'}
          </button>
        </div>

        {/* AI Analytics Chat */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: '22px 24px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              fontWeight: 900, fontSize: 17,
            }}>✦ AI-аналитик</span>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Задайте вопрос по инфраструктуре</span>
            {sessionId && (
              <button
                style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}
                onClick={() => { setSessionId(null); setMessages([]); }}
              >
                Новый диалог
              </button>
            )}
          </div>

          {/* Preset chips */}
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {PRESETS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} disabled={loading} style={{
                  background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 20,
                  padding: '8px 16px', fontSize: 13, color: '#374151', cursor: 'pointer',
                  transition: 'all 0.15s', fontFamily: 'var(--font)',
                }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {(messages.length > 0 || streamingContent) && (
            <div style={{
              maxHeight: 400, overflowY: 'auto', marginBottom: 16,
              border: '1px solid #f3f4f6', borderRadius: 10, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%', padding: '10px 16px', borderRadius: 12,
                  background: msg.role === 'user' ? '#1d6ef5' : '#f3f4f6',
                  color: msg.role === 'user' ? '#fff' : '#1a2332',
                  fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              ))}
              {streamingContent && (
                <div style={{
                  alignSelf: 'flex-start', maxWidth: '85%', padding: '10px 16px',
                  borderRadius: 12, background: '#f3f4f6', color: '#1a2332',
                  fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {streamingContent}
                  <span style={{ animation: 'blink 1s infinite' }}>▌</span>
                </div>
              )}
              {loading && !streamingContent && (
                <div style={{
                  alignSelf: 'flex-start', padding: '10px 16px',
                  borderRadius: 12, background: '#f3f4f6', color: '#9ca3af',
                  fontSize: 13,
                }}>
                  Анализирую данные...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Спросите AI-аналитика об инфраструктуре..."
              disabled={loading}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 10,
                border: '1.5px solid #e5e7eb', fontSize: 14,
                fontFamily: 'var(--font)', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: 14 }}
            >
              Отправить
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
