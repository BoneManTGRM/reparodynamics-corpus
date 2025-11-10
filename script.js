// script.js
(async () => {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const log = (m) => { status.insertAdjacentHTML('beforeend', `<div>${m}</div>`); console.log(m); };

  // 1) Local cache
  const CACHE_KEY = 'zenodo_corpus_cache_v1';
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

  // 2) Local JSON fallback you keep in the repo at /corpus.json
  // Format shown below in notes
  const LOCAL_JSON_URL = './corpus.json';

  // 3) DOI final fallback so page is never empty
  const DOI_FALLBACKS = [
    '10.5281/zenodo.17538091',
    '10.5281/zenodo.17534737',
    '10.5281/zenodo.17532879',
    '10.5281/zenodo.17351915'
  ];

  // 4) Queries in descending priority
  const QUERIES = [
    'creators.name:"Cody Ryan Jenkins"',
    'creators.name:"Jenkins, Cody Ryan"',
    'creators.name:"Cody R. Jenkins"',
    '(title:Reparodynamics OR keywords:Reparodynamics OR description:Reparodynamics)',
    '(title:"Targeted Gradient Repair Mechanism" OR keywords:TGRM)',
    '(title:"Repair Yield per Energy" OR keywords:RYE)',
    '(title:Jenkins AND Reparodynamics)'
  ];

  function saveCache(rows) {
    try {
      const payload = { ts: Date.now(), rows };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {}
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

  async function fetchWithBackoff(url, tries = 5, base = 900) {
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (res.status === 429) throw new Error('429');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        const wait = base * Math.pow(2, i) + Math.floor(Math.random() * 300);
        log(`Temporary fetch issue. Retry in ${Math.round(wait / 1000)}s`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    throw new Error('Fetch failed after retries');
  }

  async function searchQuery(q) {
    const url = `https://zenodo.org/api/records/?q=${encodeURIComponent(q)}&sort=mostrecent&all_versions=true&page=1&size=200`;
    log(`Query: <code class="q">${q}</code>`);
    const data = await fetchWithBackoff(url);
    const hits = data?.hits?.hits || [];
    return hits.map(h => ({
      id: String(h.id),
      title: h.metadata?.title || '(no title)',
      date: h.metadata?.publication_date || h.created || '',
      url: h.links?.html || h.links?.self || '',
      doi: h.doi || h.metadata?.doi || h.metadata?.prereserve_doi?.doi || '',
      creators: (h.metadata?.creators || []).map(c => c.name).join(', ')
    }));
  }

  async function fetchByDOI(doi) {
    const rec = doi.replace(/^.*zenodo\./i, '');
    const url = `https://zenodo.org/api/records/${encodeURIComponent(rec)}`;
    const d = await fetchWithBackoff(url);
    return {
      id: String(d.id),
      title: d.metadata?.title || '(no title)',
      date: d.metadata?.publication_date || d.created || '',
      url: d.links?.html || d.links?.self || '',
      doi: d.doi || d.metadata?.doi || '',
      creators: (d.metadata?.creators || []).map(c => c.name).join(', ')
    };
  }

  function render(rows) {
    if (!rows || rows.length === 0) {
      list.innerHTML = '<li>No records could be loaded right now</li>';
      return;
    }
    rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    list.innerHTML = rows.map(r => `
      <li>
        <a href="${r.url}" target="_blank" rel="noopener">${r.title}</a>
        <div class="meta">${r.date} · ${r.creators}${r.doi ? ' · DOI: ' + r.doi : ''}</div>
      </li>
    `).join('');
    log(`Loaded ${rows.length} records`);
  }

  async function loadFromZenodo() {
    const seen = new Set();
    let results = [];
    for (const q of QUERIES) {
      try {
        const rows = await searchQuery(q);
        for (const r of rows) if (!seen.has(r.id)) { seen.add(r.id); results.push(r); }
      } catch (e) {
        log(`Error on query: ${e.message}`);
      }
    }
    return results;
  }

  async function loadFromLocalJson() {
    try {
      const res = await fetch(LOCAL_JSON_URL, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return [];
      const rows = await res.json();
      log('Used corpus.json fallback');
      return Array.isArray(rows) ? rows : [];
    } catch { return []; }
  }

  async function loadFromDOIs() {
    const out = [];
    for (const d of DOI_FALLBACKS) {
      try { out.push(await fetchByDOI(d)); }
      catch (e) { log(`DOI fallback failed for ${d}`); }
    }
    if (out.length) log('Used DOI fallback');
    return out;
  }

  async function main() {
    status.innerHTML = 'script.js loaded and running';
    // Serve cached immediately for snappy UX
    const cached = loadCache();
    if (cached && cached.length) {
      log('Serving cached results');
      render(cached);
    }

    try {
      // Always attempt a fresh pull in the background
      let rows = await loadFromZenodo();
      if (!rows.length) rows = await loadFromLocalJson();
      if (!rows.length) rows = await loadFromDOIs();

      if (rows.length) {
        saveCache(rows);
        // If we already rendered cache, re-render only if counts differ
        if (!cached || cached.length !== rows.length) render(rows);
      } else if (!cached || !cached.length) {
        render([]);
      }
    } catch (e) {
      log(`Uncaught error: ${e.message}`);
      if (!cached || !cached.length) render([]);
    }
  }

  main();
})();
