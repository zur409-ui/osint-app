import { useState, useEffect } from 'react';

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [githubUsers, setGithubUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('company');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? '#1f2937' : '#ffffff';
    document.body.style.color = darkMode ? '#f9fafb' : '#111827';
  }, [darkMode]);

  const handleCompanySearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(null); setResults([]); setGithubUsers([]);
    try {
      const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Token ' + import.meta.env.VITE_DADATA_TOKEN },
        body: JSON.stringify({ query: query, count: 10 })
      });
      if (!response.ok) throw new Error('Ошибка API');
      const data = await response.json();
      const companies = data.suggestions || [];
      if (companies.length === 0) setError('Ничего не найдено');
      else setResults(companies.map(item => ({
        name: item.value, inn: item.data.inn,
        status: item.data.state.status === 'ACTIVE' ? 'Действующая' : 'Неактивна',
        address: item.data.address?.value || 'Не указан',
        director: item.data.management?.name || 'Не указан'
      })));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleGithubSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setGithubUsers([]);
    try {
      const response = await fetch(`https://api.github.com/search/users?q=company:${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Ошибка GitHub');
      const data = await response.json();
      const users = data.items || [];
      if (users.length === 0) setError('Разработчики не найдены');
      else setGithubUsers(users.slice(0, 15).map(u => ({ login: u.login, profile_url: u.html_url, avatar_url: u.avatar_url })));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const exportToCSV = () => {
    let csv = '\uFEFF';
    if (activeTab === 'company' && results.length > 0) {
      csv += 'Название,ИНН,Статус,Директор,Адрес\n';
      results.forEach(r => { csv += `"${r.name}","${r.inn}","${r.status}","${r.director}","${r.address}"\n`; });
    } else if (activeTab === 'github' && githubUsers.length > 0) {
      csv += 'Логин,Ссылка\n';
      githubUsers.forEach(u => { csv += `"${u.login}","${u.profile_url}"\n`; });
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `osint_export.csv`; link.click();
  };

  const bgColor = darkMode ? '#1f2937' : '#ffffff';
  const textColor = darkMode ? '#f9fafb' : '#111827';
  const borderColor = darkMode ? '#374151' : '#e5e7eb';
  const thStyle = { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` };
  const tdStyle = { padding: '12px 16px', fontSize: '14px', color: textColor };
  const tabStyle = (active) => ({ padding: '10px 20px', cursor: 'pointer', border: 'none', backgroundColor: active ? '#2563eb' : (darkMode ? '#374151' : '#f3f4f6'), color: active ? 'white' : textColor, borderRadius: '6px 6px 0 0', fontWeight: '600', marginRight: '4px' });
  const cardStyle = { backgroundColor: darkMode ? '#374151' : '#ffffff', border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '16px' };

  const dorks = query.trim() ? [
    { title: '🔍 LinkedIn: Сотрудники', url: `https://www.google.com/search?q=site:linkedin.com/in/+("${encodeURIComponent(query)}")` },
    { title: '📧 Google: Поиск email', url: `https://www.google.com/search?q="${encodeURIComponent(query)}"+email+OR+@` },
    { title: '🔎 Yandex: Упоминания', url: `https://yandex.ru/search/?text="${encodeURIComponent(query)}"+сотрудник+OR+директор` },
    { title: '📱 Telegram: Поиск', url: `https://t.me/s/${encodeURIComponent(query).replace(/[^a-z0-9]/gi, '')}` },
    { title: '🖼️ Google Lens: Фото', url: `https://lens.google.com/` },
    { title: '🔎 Yandex Images: Лица', url: `https://yandex.ru/images/` },
    { title: '👁️ TinEye: Обратный поиск', url: `https://tineye.com/` },
    { title: '📷 Insecam: Камеры мира', url: `https://www.insecam.org/` }
  ] : [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: bgColor, color: textColor }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>🔍 OSINT Tool</h1>
        <button onClick={() => setDarkMode(!darkMode)} style={{ padding: '8px 16px', backgroundColor: darkMode ? '#fbbf24' : '#374151', color: darkMode ? '#1f2937' : 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
          {darkMode ? '☀️ Светлая' : '🌙 Тёмная'}
        </button>
      </div>

      <div style={{ display: 'flex', marginBottom: '20px', borderBottom: `2px solid ${borderColor}` }}>
        <button onClick={() => setActiveTab('company')} style={tabStyle(activeTab === 'company')}>🏢 Компании</button>
        <button onClick={() => setActiveTab('links')} style={tabStyle(activeTab === 'links')}>🔗 Связи</button>
        <button onClick={() => setActiveTab('github')} style={tabStyle(activeTab === 'github')}>💻 GitHub</button>
      </div>

      {(activeTab === 'company' || activeTab === 'github') && (
        <form onSubmit={activeTab === 'company' ? handleCompanySearch : handleGithubSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={activeTab === 'company' ? "ИНН или название" : "Название компании"} style={{ flex: 1, padding: '12px', border: `1px solid ${borderColor}`, borderRadius: '8px', backgroundColor: bgColor, color: textColor }} />
          <button type="submit" disabled={loading} style={{ padding: '12px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{loading ? '...' : 'Найти'}</button>
        </form>
      )}

      {activeTab === 'links' && (
        <div style={{ marginBottom: '24px' }}>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Введите название для генерации ссылок" style={{ width: '100%', padding: '12px', border: `1px solid ${borderColor}`, borderRadius: '8px', marginBottom: '16px', boxSizing: 'border-box', backgroundColor: bgColor, color: textColor }} />
          {dorks.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {dorks.map((d, i) => (<div key={i} style={cardStyle}><div style={{ fontWeight: '600', marginBottom: '8px' }}>{d.title}</div><a href={d.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Открыть →</a></div>))}
            </div>
          ) : <div style={{ padding: '16px', backgroundColor: darkMode ? '#374151' : '#f3f4f6', borderRadius: '8px' }}>Введите запрос выше.</div>}
        </div>
      )}

      {error && <div style={{ padding: '16px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1c', marginBottom: '20px' }}>{error}</div>}

      {(results.length > 0 || githubUsers.length > 0) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button onClick={exportToCSV} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📥 CSV</button>
        </div>
      )}

      {activeTab === 'company' && results.length > 0 && (
        <div style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: darkMode ? '#374151' : '#f9fafb' }}>
              <tr><th style={thStyle}>Название</th><th style={thStyle}>ИНН</th><th style={thStyle}>Статус</th><th style={thStyle}>Директор</th><th style={thStyle}>Адрес</th></tr>
            </thead>
            <tbody>
              {results.map((item, idx) => (<tr key={idx} style={{ borderTop: `1px solid ${borderColor}` }}><td style={tdStyle}>{item.name}</td><td style={{ ...tdStyle, fontFamily: 'monospace' }}>{item.inn}</td><td style={tdStyle}>{item.status}</td><td style={tdStyle}>{item.director}</td><td style={{ ...tdStyle, fontSize: '13px', opacity: 0.8 }}>{item.address}</td></tr>))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'github' && githubUsers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {githubUsers.map((u, idx) => (<div key={idx} style={{ ...cardStyle, textAlign: 'center' }}><img src={u.avatar_url} alt={u.login} style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '12px' }} /><div style={{ fontWeight: '600', marginBottom: '8px' }}>{u.login}</div><a href={u.profile_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>Профиль →</a></div>))}
        </div>
      )}

      <footer style={{ marginTop: '40px', padding: '20px', textAlign: 'center', borderTop: `1px solid ${borderColor}`, color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '14px' }}>
        <div>© 2026 <strong>Уваров Сергей</strong>. Open Source OSINT Tool.</div>
      </footer>
    </div>
  );
}