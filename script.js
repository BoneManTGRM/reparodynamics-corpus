// script.js — author-strict with safe cache + reset
(async () => {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const log = (m) => { status.insertAdjacentHTML('beforeend', `<div>${m}</div>`); console.log(m); };

  // NEW cache key so old broad results aren't reused
  const CACHE_KEY = 'zenodo_corpus_cache_v3';
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
  const params = new URLSearchParams(location.search);
  const RESET = params.has('reset');

  if (RESET) {
    try { localStorage.removeItem(CACHE_KEY); log('Cache reset via ?reset=1'); } catch {}
  }

  // Exact creator strings that are yours
  const NAME_WHITELIST = new Set([
    'Cody Ryan Jenkins',
    'Jenkins, Cody Ryan',
    'Cody R. Jenkins',
    'Jenkins, Cody R.'
  ]);

  // Strong OR query on creators.name, plus alt field once if needed
  const Q1 = '(' + [
    'creators.name:"Cody Ryan Jenkins"',
    'creators.name:"Jenkins, Cody Ryan"',
    'creators.name:"Cody R. Jenkins"',
    'creators.name:"Jenkins, Cody R."'
  ].join(' OR ') + ')';
  const Q2 = '(' + [
    'metadata.creators.name:"Cody Ryan Jenkins"',
    'metadata.creators.name:"Jenkins, Cody Ryan"',
    'metadata.creators.name:"Cody R. Jenkins"',
    'metadata.creators.name:"Jenkins, Cody R."'
  ].join(' OR ') + ')';

  function saveCache(rows) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows })); } catch {}
  }
  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, rows } = JSON.parse(raw);
      if (!ts || !rows) return null;
      if (Date.now() - ts > CACHE_TTL_MS) return null;
      return rows;
    } catch { return null; }
  }

  async function fetchJSON(url) {
    for (let i = 0; i < 4; i++) {
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        const wait = 700 * Math.pow(2, i) + Math.floor(Math.random() * 200);
        log(`Temporary fetch issue (${e.message}). Retry in ${Math.round(wait/1000)}s`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    throw new Error('Fetch failed after retries');
  }

  async function run(q) {
    const url = `https://zenodo.org/api/records/?q=${encodeURIComponent(q)}&all_versions=false&sort=mostrecent&size=200`;
    log(`Query: <code>${q}</code>`);
    const data = await fetchJSON(url);
    const hits = data?.hits?.hits || [];
    const filtered = hits
      .filter(h => (h.metadata?.creators || []).some(c => NAME_WHITELIST.has(c.name)))
      .map(h => ({
        id: String(h.id),
        title: h.metadata?.title || '(no title)',
        date: h.metadata?.publication_date || h.created || '',
        url: h.links?.html || h.links?.self || '',
        doi: h.doi || h.metadata?.doi || h.metadata?.prereserve_doi?.doi || '',
        creators: (h.metadata?.creators || []).map(c => c.name).join(', ')
      }));
    log(`Hits after author filter: ${filtered.length}`);
    return filtered;
  }

  function render(rows) {
    if (!rows.length) {
      list.innerHTML = '<li>No records found for your exact author name right now.</li>';
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

  status.innerHTML = 'script.js loaded and running';

  // Serve cache immediately (if not forced reset)
  const cached = RESET ? null : loadCache();
  if (cached && cached.length) { log('Serving cached author-filtered results'); render(cached); }

  try {
    let results = await run(Q1);
    if (!results.length) results = await run(Q2);

    // de-dupe by id
    const uniq = [];
    const seen = new Set();
    for (const r of results) { if (!seen.has(r.id)) { seen.add(r.id); uniq.push(r); } }

    if (uniq.length) {
      saveCache(uniq);
      if (!cached || cached.length !== uniq.length) render(uniq);
    } else if (!cached) {
      render([]);
    }
  } catch (e) {
    log(`Error: ${e.message}`);
    if (!cached) list.innerHTML = '<li>Temporary issue loading from Zenodo</li>';
  }
})();
