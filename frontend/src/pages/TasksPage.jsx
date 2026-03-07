import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import api from '../api/api';

const ACTION_LABELS = {
  'vm.create': 'Clone + Start VM',
  'vm.start': 'Start VM (qmstart)',
  'vm.stop': 'Shutdown VM (qmshutdown)',
  'vm.reboot': 'Reboot VM (qmreboot)',
  'vm.suspend': 'Suspend VM (qmsuspend)',
  'vm.resume': 'Resume VM (qmresume)',
  'vm.delete': 'Destroy VM (qmdestroy)',
};

const STATUS_MAP = {
  pending: 'creating',
  running: 'creating',
  success: 'active',
  failed: 'error',
  canceled: 'stopped',
};

function formatDuration(start, end) {
  if (!start) return '—';
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const ms = e - s;
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function truncateUpid(upid) {
  if (!upid) return '—';
  if (upid.length > 60) return upid.slice(0, 58) + '…';
  return upid;
}

export default function TasksPage() {
  const { role } = useApp();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadTasks = useCallback(async () => {
    try {
      const { data } = await api.get('/audit/tasks/');
      setTasks(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    const hasActive = tasks.some(t => t.status === 'running' || t.status === 'pending');
    if (!hasActive) return;
    const interval = setInterval(loadTasks, 3000);
    return () => clearInterval(interval);
  }, [tasks, loadTasks]);

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const stats = {
    total: tasks.length,
    success: tasks.filter(t => t.status === 'success').length,
    running: tasks.filter(t => t.status === 'running' || t.status === 'pending').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  return (
    <div>
      <Topbar title="Proxmox Tasks" breadcrumb="// proxmox.tasks.history" />
      <div className="page-content">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card stat-blue">
            <div className="stat-icon-text">TSK</div>
            <div className="stat-label">Всего задач</div>
            <div className="stat-value" style={{ color: 'var(--blue)' }}>{stats.total}</div>
          </div>
          <div className="stat-card stat-green">
            <div className="stat-icon-text">OK</div>
            <div className="stat-label">Успешных</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.success}</div>
          </div>
          <div className="stat-card stat-yellow">
            <div className="stat-icon-text">RUN</div>
            <div className="stat-label">Выполняется</div>
            <div className="stat-value" style={{ color: 'var(--yellow)' }}>{stats.running}</div>
          </div>
          <div className="stat-card stat-red">
            <div className="stat-icon-text">ERR</div>
            <div className="stat-label">Ошибок</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{stats.failed}</div>
          </div>
        </div>

        <div className="table-wrap">
          <div className="table-top">
            <span className="table-title">Proxmox Task History</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={filter} onChange={e => setFilter(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
                <option value="all">Все статусы</option>
                <option value="success">Success</option>
                <option value="running">Running</option>
                <option value="failed">Failed</option>
              </select>
              <button className="btn btn-ghost btn-sm" onClick={loadTasks}>↻ Обновить</button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="empty-state-title">Загрузка...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Нет задач</div>
              <div className="empty-state-sub">Создайте VM — задачи появятся здесь</div>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Action / Type</th>
                <th>UPID</th>
                <th>Node</th>
                <th>Status</th>
                <th>Duration</th>
                <th>User</th>
                <th>Started</th>
              </tr></thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {ACTION_LABELS[t.action] || t.action}
                      </div>
                      <div className="font-mono" style={{ color: 'var(--text3)', fontSize: 10 }}>
                        {t.resource_kind}:{t.resource_id?.slice(0, 8)}
                      </div>
                    </td>
                    <td>
                      <div className="font-mono" style={{ fontSize: 10, color: 'var(--text2)', maxWidth: 280, wordBreak: 'break-all' }}>
                        {truncateUpid(t.external_id)}
                      </div>
                    </td>
                    <td className="font-mono" style={{ fontSize: 12 }}>
                      {t.external_node || '—'}
                    </td>
                    <td><StatusBadge status={STATUS_MAP[t.status] || t.status} /></td>
                    <td className="font-mono" style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {formatDuration(t.started_at, t.finished_at)}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {t.requested_by_email || 'system'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
