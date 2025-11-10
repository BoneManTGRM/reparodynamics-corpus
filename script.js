// script.js — fast and author-strict
(async () => {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const log = (m) => { status.insertAdjacentHTML('beforeend', `<div>${m}</div>`); console.log(m); };

  // Exact creator strings that are yours
  const NAME_WHITELIST = new Set([
    'Cody Ryan Jenkins',
    'Jenkins, Cody Ryan',
    'Cody R. Jenkins',
    'Jenkins, Cody R.'
  ]);

  // One strong OR query for creators.name
  const Q1 = '(' + [
    'creators.name:"Cody Ryan Jenkins"',
    'creators.name:"Jenkins, Cody Ryan"',
    'creators.name:"Cody R. Jenkins"',
    'creators.name:"Jenkins, Cody R."'
  ].join(' OR ') + ')';

  // Same for metadata.creators.name as a safety net
  const Q2 = '(' + [
    'metadata.creators.name:"Cody Ryan Jenkins"',
    'metadata.creators.name:"Jenkins, Cody Ryan"',
    'metadata.creators.name:"Cody R. Jenkins"',
    'metadata.creators.name:"Jenkins, Cody R."'
  ].join(' OR ') + ')';

  // Helper
  async function fetchJSON(url) {
    for (let i = 0; i < 4; i++) {
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (res.status === 429) throw new Error('429');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        const wait = 700 * Math.pow(2, i) + Math.floor(Math.random() * 200);
        log(`Retry in ${Math.round(wait/1000)}s`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    throw new Error('Fetch failed');
  }

  async function run(q) {
    const url = `https://zenodo.org/api/records/?q=${encodeURIComponent(q)}&all_versions=false&sort=mostrecent&size=200`;
    log(`Query: <code>${q}</code>`);
    const data = await fetchJSON(url);
    const hits = data?.hits?.hits || [];
    // Keep only records where any creator name matches exactly
    return hits
      .filter(h => (h.metadata?.creators || []).some(c => NAME_WHITELIST.has(c.name)))
      .map(h => ({
        id: String(h.id),
        title: h.metadata?.title || '(no title)',
        date: h.metadata?.publication_date || h.created || '',
        url: h.links?.html || h.links?.self || '',
        doi: h.doi || h.metadata?.doi || h.metadata?.prereserve_doi?.doi || '',
        creators: (h.metadata?.creators || []).map(c => c.name).join(', ')
      }));
  }

  function render(rows) {
    if (!rows.length) {
      list.innerHTML = '<li>No records found for your exact author name</li>';
      return;
    }
    rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    list.innerHTML = rows.map(r => `
      <li>
        <a href="${r.url}" target="_blank" rel="noopener">${r.title}</a>
        <div class="meta">${r.date} · ${r.creators}${r.doi ? ' · DOI: ' + r.doi : ''}</div>
      </li>
    `).join('');
    log(`Loaded ${rows.length} records after author filter`);
  }

  status.innerHTML = 'script.js loaded and running';
  try {
    // Try creators.name first, then metadata.creators.name only if needed
    let results = await run(Q1);
    if (!results.length) results = await run(Q2);
    // De-dupe by record id
    const uniq = [];
    const seen = new Set();
    for (const r of results) {
      if (!seen.has(r.id)) { seen.add(r.id); uniq.push(r); }
    }
    render(uniq);
  } catch (e) {
    log(`Error: ${e.message}`);
    list.innerHTML = '<li>Temporary issue loading from Zenodo</li>';
  }
})();
