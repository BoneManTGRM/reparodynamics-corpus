// script.js — fast, exact-author, resilient (10s timeout, cache, manual reload)
(async () => {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const btnRefresh = document.getElementById('refresh');
  const btnClear = document.getElementById('clear');
  const log = (m) => { status.insertAdjacentHTML('beforeend', `<div>${m}</div>`); console.log(m); };
  const setStatus = (m) => { status.innerHTML = m; };

  // Optional: if you give me your Zenodo owner id, put it here. Example: 1234567
  const OWNER_ID = null; // <— set to a number when you have it

  // Cache
  const CACHE_KEY = 'zenodo_cody_fast_v2';
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

  // Build exact query
  const baseQ = 'creators.name:"Jenkins, Cody Ryan"';
  const query = OWNER_ID ? `(${baseQ}) AND owner:${OWNER_ID}` : baseQ;
  const API = `https://zenodo.org/api/records/?q=${encodeURIComponent(query)}&all_versions=false&sort=mostrecent&size=200&page=1`;

  // Fetch with 10s timeout; single retry for 429 only
  async function fetchFast(url, timeoutMs = 10000) {
    const
