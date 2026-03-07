import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Topbar from '../components/Topbar';

const FLAVORS = [
  { id: 'small',   name: 'Small',   spec: '1 vCPU · 2 GB RAM · 20 GB SSD',   cpu: 1,  ram: 2,  disk: 20,  price: '39 BYN/мес' },
  { id: 'medium',  name: 'Medium',  spec: '2 vCPU · 4 GB RAM · 40 GB SSD',   cpu: 2,  ram: 4,  disk: 40,  price: '78 BYN/мес' },
  { id: 'large',   name: 'Large',   spec: '4 vCPU · 8 GB RAM · 80 GB SSD',   cpu: 4,  ram: 8,  disk: 80,  price: '156 BYN/мес' },
  { id: 'xlarge',  name: 'XLarge',  spec: '8 vCPU · 16 GB RAM · 160 GB SSD', cpu: 8,  ram: 16, disk: 160, price: '312 BYN/мес' },
  { id: '2xlarge', name: '2XLarge', spec: '16 vCPU · 32 GB RAM · 320 GB SSD',cpu: 16, ram: 32, disk: 320, price: '624 BYN/мес' },
];

const IMAGES = [
  'Ubuntu 22.04 LTS', 'Ubuntu 20.04 LTS', 'Debian 12', 'Debian 11',
  'CentOS Stream 9', 'Rocky Linux 9', 'Astra Linux 2.12', 'РЕД ОС 7.3',
];

const NETWORKS = ['default-net (192.168.100.0/24)', 'internal-net (192.168.100.128/25)', 'dmz-net (172.16.0.0/24)'];
const KEYPAIRS = ['default-key', 'prod-key', 'dev-key', 'Без ключа'];

export default function CreateVMPage() {
  const { createVM, tenants } = useApp();
  const navigate = useNavigate();
  const myTenant = tenants[0];

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [image, setImage] = useState(IMAGES[0]);
  const [selectedTemplate, setSelectedTemplate] = useState('medium');
  const [network, setNetwork] = useState(NETWORKS[0]);
  const [keypair, setKeypair] = useState(KEYPAIRS[0]);
  const [custom, setCustom] = useState({ cpu: 2, ram: 4, disk: 40 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vm-create-opened'));
  }, []);

  const handleSelectTemplate = (f) => {
    setSelectedTemplate(f.id);
    setCustom({ cpu: f.cpu, ram: f.ram, disk: f.disk });
  };

  const handleCustomChange = (field, value) => {
    setSelectedTemplate(null);
    setCustom(c => ({ ...c, [field]: value }));
  };

  const availCPU  = myTenant ? myTenant.quota.cpu  - myTenant.usage.cpu  : 0;
  const availRAM  = myTenant ? myTenant.quota.ram  - myTenant.usage.ram  : 0;
  const availDisk = myTenant ? myTenant.quota.disk - myTenant.usage.disk : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Введите имя ВМ'); return; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) { setError('Только строчные буквы, цифры и дефис'); return; }
    if (!custom.cpu || custom.cpu < 1) { setError('CPU: минимум 1 ядро'); return; }
    if (!custom.ram || custom.ram < 1) { setError('RAM: минимум 1 GB'); return; }
    if (!custom.disk || custom.disk < 10) { setError('Disk: минимум 10 GB'); return; }
    setLoading(true);
    const flavorId = selectedTemplate || 'custom';
    const result = await createVM({
      name: name.trim(), image, flavor: flavorId,
      cpu: Number(custom.cpu), ram: Number(custom.ram), disk: Number(custom.disk),
    });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    navigate('/vms');
  };

  const idKey = Math.random().toString(36).slice(2, 10);

  return (
    <div>
      <Topbar title="Создание виртуальной машины">
        <button className="btn btn-ghost" style={{ fontSize: 14 }} onClick={() => navigate('/vms')}>← Назад к списку</button>
      </Topbar>

      <div className="page-content">
        <form onSubmit={handleSubmit} style={{ maxWidth: 860, margin: '0 auto' }}>
          <div className="table-wrap" style={{ padding: 28 }}>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20, fontFamily: 'monospace' }}>
              Создание через асинхронную очередь задач · Idempotency-Key: idem-{idKey}
            </div>

            <div className="form-grid form-2col">
              <div className="field">
                <label style={{ fontSize: 14, fontWeight: 700 }}>Имя ВМ *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="web-server-01"
                  style={{ fontSize: 15, padding: '10px 14px' }} />
                <div className="field-hint">строчные буквы, цифры и дефис</div>
              </div>
              <div className="field">
                <label style={{ fontSize: 14, fontWeight: 700 }}>Описание</label>
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Сервер для prod-окружения"
                  style={{ fontSize: 15, padding: '10px 14px' }} />
              </div>
            </div>

            <div className="field">
              <label style={{ fontSize: 14, fontWeight: 700 }}>Образ (OS Template) *</label>
              <select value={image} onChange={e => setImage(e.target.value)} style={{ fontSize: 15, padding: '10px 14px' }}>
                {IMAGES.map(img => <option key={img}>{img}</option>)}
              </select>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#374151' }}>⚙️ Ресурсы виртуальной машины</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>vCPU (ядра)</label>
                  <input type="number" min={1} max={availCPU || 64} value={custom.cpu}
                    onChange={e => handleCustomChange('cpu', e.target.value)}
                    style={{ fontSize: 15, padding: '10px 14px' }} />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Доступно: {availCPU}</div>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>RAM (GB)</label>
                  <input type="number" min={1} max={availRAM || 512} value={custom.ram}
                    onChange={e => handleCustomChange('ram', e.target.value)}
                    style={{ fontSize: 15, padding: '10px 14px' }} />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Доступно: {availRAM} GB</div>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Disk (GB)</label>
                  <input type="number" min={10} max={availDisk || 2000} value={custom.disk}
                    onChange={e => handleCustomChange('disk', e.target.value)}
                    style={{ fontSize: 15, padding: '10px 14px' }} />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Доступно: {availDisk} GB</div>
                </div>
              </div>
            </div>

            <div className="field">
              <label style={{ fontSize: 14, fontWeight: 700, color: '#6b7280' }}>Или выберите готовую конфигурацию</label>
              <div className="flavor-grid">
                {FLAVORS.map(f => (
                  <div key={f.id} className={`flavor-card${selectedTemplate === f.id ? ' selected' : ''}`} onClick={() => handleSelectTemplate(f)}>
                    <div className="flavor-name" style={{ fontSize: 15 }}>{f.name}</div>
                    <div className="flavor-spec" style={{ fontSize: 13 }}>{f.spec}</div>
                    <div className="flavor-price" style={{ fontSize: 12 }}>{f.price}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-grid form-2col">
              <div className="field">
                <label style={{ fontSize: 14, fontWeight: 700 }}>Сеть</label>
                <select value={network} onChange={e => setNetwork(e.target.value)} style={{ fontSize: 14, padding: '10px 14px' }}>
                  {NETWORKS.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div className="field">
                <label style={{ fontSize: 14, fontWeight: 700 }}>SSH Keypair</label>
                <select value={keypair} onChange={e => setKeypair(e.target.value)} style={{ fontSize: 14, padding: '10px 14px' }}>
                  {KEYPAIRS.map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
            </div>

            {myTenant && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#1d4ed8', marginBottom: 16 }}>
                Квота OK: доступно {availCPU} vCPU, {availRAM} GB RAM, {availDisk} GB Disk
              </div>
            )}

            {error && <div className="err-box" style={{ marginBottom: 16 }}><span>⚠</span> {error}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/vms')}>Отмена</button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ fontSize: 15, padding: '10px 28px' }}>
                {loading ? <span className="spin">◌</span> : 'Создать ВМ'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
