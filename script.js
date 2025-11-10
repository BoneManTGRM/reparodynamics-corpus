// script.js — fast exact-author loader with 15s adaptive timeout, cache, manual reload
(async () => {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const btnRefresh = document.getElementById('refresh');
  const btnClear = document.getElementById('clear');
  const log = (m) => { status.insertAdjacentHTML('beforeend', `<div>${m}</div>`); console.log(m); };
  const setStatus = (m) => { status.innerHTML = m; };

  // Optional: set your Zenodo numeric owner id for perfect precision
  const OWNER_ID = null; // example: 1234567

  // Cache
  const CACHE_KEY = 'zenodo_cody_fast_v3';
  const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h

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
  function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  }

  // Exact author query
  const baseQ = 'creators.name:"Jenkins, Cody Ryan"';
  const query = OWNER_ID ? `(${baseQ}) AND owner:${OWNER_ID}` : baseQ;
  const API = `https://zenodo.org/api/records/?q=${encodeURIComponent(query)}&all_versions=false&sort=mostrecent&size=200&page=1`;

  // Fetch with adaptive 15s timeout and one retry
  async function fetchFast(url, timeoutMs = 15000) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { 'Accept': 'application/json' },
          keepalive: true,
          cache: 'no-store'
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw err;
        }
      }
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
      list.innerHTML = '<li>No records found for Jenkins, Cody Ryan. Tap Reload from Zenodo to try again.</li>';
      return;
    }
    rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    list.innerHTML = rows.map(r => `
      <li>
        <a href="${r.url}" target="_blank" rel="noopener">${r.title}</a>
        <div class="meta">${r.date} · ${r.creators}${r.doi ? ' · DOI: ' + r.doi : ''}</div>
      </li>
    `).join('');
    log(`Rendered ${rows.length} records.`);
  }

  async function loadFresh(showWorking = true) {
    try {
      if (showWorking) setStatus('Contacting Zenodo…');
      const data = await fetchFast(API);
      const hits = data?.hits?.hits || [];

      // Keep only exact author matches as a guard
      const rows = hits
        .filter(h => (h.metadata?.creators || []).some(c => c.name === 'Jenkins, Cody Ryan'))
        .map(toRow);

      if (rows.length) {
        saveCache(rows);
        render(rows);
        setStatus('Loaded live data from Zenodo.');
      } else {
        setStatus('Zenodo returned zero items for this author right now.');
        render([]);
      }
    } catch (e) {
      setStatus(`Using cache due to network or timeout: ${e.message || e}`);
      const cached = loadCache();
      render(cached || []);
    }
  }

  // Buttons
  if (btnRefresh) btnRefresh.addEventListener('click', () => loadFresh(true));
  if (btnClear) btnClear.addEventListener('click', () => { clearCache(); setStatus('Cache cleared.'); render([]); });

  // First paint
  const cached = loadCache();
  if (cached) {
    setStatus('Served from cache.');
    render(cached);
    loadFresh(false); // refresh quietly
  } else {
    loadFresh(true);
  }
})();
