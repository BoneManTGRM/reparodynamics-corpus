// script.js — fast, exact author, cached, with manual reset option
(async () => {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const log = (m) => { status.insertAdjacentHTML('beforeend', `<div>${m}</div>`); console.log(m); };

  // cache
  const CACHE_KEY = 'zenodo_cody_v1';
  const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
  const RESET = new URLSearchParams(location.search).has('reset');
  if (RESET) { try { localStorage.removeItem(CACHE_KEY); log('Cache cleared'); } catch {} }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, rows } = JSON.parse(raw);
      if (!rows || Date.now() - ts > CACHE_TTL_MS) return null;
      return rows;
    } catch { return null; }
  }
  function saveCache(rows) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows })); } catch {}
  }

  // exact author query
  const QUERY = 'creators.name:"Jenkins, Cody Ryan"';
  const API = `https://zenodo.org/api/records/?q=${encodeURIComponent(QUERY)}&all_versions=false&sort=mostrecent&size=200`;

  // fast fetch with short timeout and a single 429 retry
  async function fetchFast(url, timeoutMs = 4000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1200));
        const res2 = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res2.ok) throw new Error(`HTTP ${res2.status}`);
        return res2.json();
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function toRow(h) {
    return {
      id: String(h.id),
      title: h.metadata?.title || '(no title)',
      date: h.metadata?.publication_date || h.created || '',
      url: h.links?.html || h.links?.self || '',
      doi: h.doi || h.metadata?.doi || h.metadata?.prereserve_doi?.doi || '',
      creators: (h.metadata?.creators || []).map(c => c.name).join(', ')
    };
  }

  function render(rows) {
    if (!rows || !rows.length) {
      list.innerHTML = '<li>No records found for Jenkins, Cody Ryan.</li>';
      return;
    }
    rows.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
    list.innerHTML = rows.map(r => `
      <li>
        <a href="${r.url}" target="_blank" rel="noopener">${r.title}</a>
        <div class="meta">${r.date} · ${r.creators}${r.doi ? ' · DOI: ' + r.doi : ''}</div>
      </li>
    `).join('');
    log(`Rendered ${rows.length} records.`);
  }

  status.innerHTML = 'script.js loaded and running';

  // serve cache instantly if available
  const cached = RESET ? null : loadCache();
  if (cached) { log('Served from cache'); render(cached); }

  // try a fresh pull in background
  try {
    const data = await fetchFast(API);
    const hits = data?.hits?.hits || [];
    // extra guard even though query is exact
    const rows = hits
      .filter(h => (h.metadata?.creators || []).some(c => c.name === 'Jenkins, Cody Ryan'))
      .map(toRow);

    if (rows.length) {
      saveCache(rows);
      if (!cached || cached.length !== rows.length) render(rows);
    } else if (!cached) {
      render([]);
    }
  } catch (e) {
    log(`Using cache due to network or timeout: ${e.message || e}`);
    if (!cached) render([]);
  }
})();
