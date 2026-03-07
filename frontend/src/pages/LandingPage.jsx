import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BrandLogo = ({ size = 40 }) => (
  <svg width={size * 0.76} height={size} viewBox="0 0 37 49" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="33" height="45" rx="10" fill="#FF0000" />
    <path
      d="M11 26C11 21.58 14.58 18 19 18C22.87 18 26 21.13 26 25C26 28.87 22.87 32 19 32H14"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FEATURES = [
  { icon: 'VM', title: 'Виртуальные машины', desc: 'Разворачивайте ВМ за секунды. Выбор из 8+ образов ОС, гибкие flavors, автоматическая настройка сети.' },
  { icon: 'SEC', title: 'Мультитенантность', desc: 'Полная изоляция данных, гибкая система квот, управление пользователями и ролями.' },
  { icon: 'MON', title: 'Мониторинг', desc: 'Метрики CPU, RAM, Disk, Network в реальном времени. Исторические графики и алерты.' },
  { icon: 'AI', title: 'AI Аналитика', desc: 'Умные рекомендации по оптимизации ресурсов, обнаружение аномалий, прогнозирование нагрузки.' },
  { icon: 'AUD', title: 'Аудит и Безопасность', desc: 'Полный лог всех действий, support sessions с ограниченным доступом, экспорт в SIEM.' },
];

const OS_LIST = [
  { icon: '🐧', label: 'Ubuntu' },
  { icon: '🐧', label: 'Debian' },
  { icon: '🪟', label: 'Windows' },
  { icon: '🪨', label: 'Rocky Linux' },
  { icon: '⭐', label: 'Astra Linux' },
];

const STEPS = [
  { num: 1, title: 'Регистрация', desc: 'Подайте заявку. Администратор облачной платформы создаст ваш тенант и пришлёт данные для входа.' },
  { num: 2, title: 'Квота ресурсов', desc: 'Вы получаете выделенные ресурсы: ВМ, vCPU, RAM, Disk. Возможно увеличение по запросу.' },
  { num: 3, title: 'Создание ВМ', desc: 'Выберите образ ОС, конфигурацию и нажмите «Создать». ВМ готова через 30-60 секунд.' },
  { num: 4, title: 'Работа', desc: 'Управляйте ВМ через веб-интерфейс или API. Мониторинг и логи доступны в реальном времени.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [showNavButtons, setShowNavButtons] = useState(false);
  const featuresRef = useRef(null);

  useEffect(() => {
    const features = featuresRef.current;
    if (!features) return;

    const onScroll = () => {
      const rect = features.getBoundingClientRect();
      // показываем кнопки, когда блок "Всё что нужно..." приблизился к верхней части экрана
      setShowNavButtons(rect.top <= 72);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <BrandLogo size={36} />
            <span className="landing-logo-text">Cloud <span>IaaS</span></span>
          </div>
          <div className={`landing-nav-right ${showNavButtons ? 'landing-nav-right-visible' : 'landing-nav-right-hidden'}`}>
            <button className="landing-btn-try" onClick={() => navigate('/register')}>Подать заявку</button>
            <button className="landing-btn-login" onClick={() => navigate('/login')}>Войти в систему</button>
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div>
            <h1 className="landing-hero-title">IaaS платформа<br />для вашего бизнеса</h1>
            <p className="landing-hero-sub">
              Виртуальные машины на базе Proxmox VE в облачных дата-центрах. Полная изоляция, гибкие квоты, мгновенный деплой.
            </p>
            <div className="landing-hero-features">
              {['Деплой ВМ за 30-60 секунд', 'Мультитенантная архитектура', 'REST API и веб-интерфейс'].map(f => (
                <div key={f} className="landing-hero-feature">
                  <div className="landing-hero-feature-icon">✓</div>
                  {f}
                </div>
              ))}
            </div>
            <div className="landing-hero-cta">
              <button className="landing-cta-btn" onClick={() => navigate('/register')}>Подать заявку</button>
              <button className="landing-cta-btn-outline" onClick={() => navigate('/login')}>Войти в систему</button>
            </div>
          </div>
          <div className="landing-hero-logo" style={{ paddingLeft: 60 }}>
            <BrandLogo size={320} />
            </div>
        </div>
      </section>

      <section className="landing-features" ref={featuresRef}>
        <div className="landing-features-inner">
          <h2 className="landing-features-title">Всё что нужно для работы в облаке</h2>
          <div className="landing-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-label-icon">{f.icon}</div>
                <div className="landing-feature-title">{f.title}</div>
                <div className="landing-feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-features" style={{ background: '#f8fafc', borderTop: '1px solid #e0e0e0' }}>
        <div className="landing-features-inner">
          <h2 className="landing-features-title">Поддерживаемые операционные системы</h2>
          <div className="landing-os-grid">
            {OS_LIST.map(os => (
              <div key={os.label} className="landing-os-card">
                <div style={{ fontSize: 32, marginBottom: 8 }}>{os.icon}</div>
                <div className="landing-os-label">{os.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-steps">
        <div className="landing-steps-inner">
          <h2 className="landing-steps-title">Как начать работу</h2>
          <p className="landing-steps-sub">Четыре простых шага до первой виртуальной машины</p>
          <div className="landing-steps-grid">
            {STEPS.map(s => (
              <div key={s.num} className="landing-step">
                <div className="landing-step-num">{s.num}</div>
                <div className="landing-step-title">{s.title}</div>
                <div className="landing-step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button className="landing-cta-btn" onClick={() => navigate('/register')}>Подать заявку →</button>
          </div>
        </div>
      </section>

      <footer style={{ background: '#0d1b2a', color: 'rgba(255,255,255,0.5)', padding: '24px 40px', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>© 2026 Cloud IaaS Platform</div>
      </footer>
    </div>
  );
}