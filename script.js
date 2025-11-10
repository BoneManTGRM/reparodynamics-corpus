<script>
(async () => {
  const log = (m) => {
    const el = document.getElementById('status') || document.body;
    el.insertAdjacentHTML('beforeend', `<div style="opacity:.8">${m}</div>`);
    console.log(m);
  };

  const queries = [
    'creators.name:"Cody Ryan Jenkins"',          // your usual
    'creators.name:"Jenkins, Cody Ryan"',         // alt formatting
    'creators.name:"Cody R. Jenkins"',            // with middle initial
    '(title:Reparodynamics OR description:Reparodynamics OR keywords:Reparodynamics)',
    '(title:"Targeted Gradient Repair Mechanism" OR description:"Targeted Gradient Repair Mechanism" OR keywords:TGRM)',
    '(title:"Repair Yield per Energy" OR description:"Repair Yield per Energy" OR keywords:RYE)',
    '(title:Jenkins AND Reparodynamics)'
  ];

  async function fetchWithBackoff(url, tries = 5, delay = 1200) {
    for (let i = 0; i < tries; i++) {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.status === 429) {
        const wait = delay * Math.pow(2, i);
        log(`Zenodo rate limited (429). Retrying in ${Math.round(wait/1000)}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Zenodo error ${res.status}: ${text.slice(0,200)}`);
      }
      return res.json();
    }
    throw new Error('Gave up after repeated 429s.');
  }

  async function search(query) {
    const url = `https://zenodo.org/api/records/?q=${encodeURIComponent(query)}&sort=mostrecent&all_versions=true&page=1&size=200`;
    log(`Query → ${query}`);
    const data = await fetchWithBackoff(url);
    const hits = (data && data.hits && data.hits.hits) || [];
    return hits.map(h => ({
      id: h.id,
      doi: h.doi || (h.metadata && h.metadata.prereserve_doi && h.metadata.prereserve_doi.doi),
      title: h.metadata?.title || '(no title)',
      date: h.metadata?.publication_date || h.created || '',
      url: h.links?.html || h.links?.self || '',
      creators: (h.metadata?.creators || []).map(c => c.name).join(', ')
    }));
  }

  async function loadAll() {
    const seen = new Set();
    let results = [];
    log('script.js loaded and running.');
    log(`Trying ${queries.length} query variants.`);
    for (const q of queries) {
      try {
        const rows = await search(q);
        rows.forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); results.push(r); } });
        if (results.length) break; // stop at first query that returns papers
        log(`No results for ${q}.`);
      } catch (e) {
        log(`Error for ${q}: ${e.message}`);
      }
    }

    if (!results.length) {
      log('Still no results — likely a temporary Zenodo indexing or API issue. Showing a troubleshooting note instead of an empty list.');
      document.getElementById('list').innerHTML =
        `<li>Couldn’t fetch records right now. Try a hard refresh. If it persists, Zenodo search may be temporarily degraded. Your papers are still safe on Zenodo.</li>`;
      return;
    }

    // sort newest first by date string
    results.sort((a,b) => (b.date||'').localeCompare(a.date||''));

    const ul = document.getElementById('list');
    ul.innerHTML = results.map(r => `
      <li style="margin:0.5rem 0">
        <a href="${r.url}" target="_blank" rel="noopener">${r.title}</a>
        <div style="font-size:.9em;opacity:.8">${r.date} · ${r.creators}${r.doi ? ' · DOI: ' + r.doi : ''}</div>
      </li>`).join('');
    log(`Loaded ${results.length} records.`);
  }

  // Ensure placeholders exist
  if (!document.getElementById('status')) {
    const s = document.createElement('div');
    s.id = 'status';
    s.style.margin = '1rem 0';
    document.body.appendChild(s);
  }
  if (!document.getElementById('list')) {
    const ul = document.createElement('ul');
    ul.id = 'list';
    document.body.appendChild(ul);
  }

  loadAll();
})();
</script>
