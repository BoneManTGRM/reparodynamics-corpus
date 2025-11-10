(async () => {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const log = (m) => { status.insertAdjacentHTML('beforeend', `<div>${m}</div>`); console.log(m); };

  // Final safety net. Add any recent DOIs here so the page never shows empty.
  const DOI_FALLBACKS = [
    // Example entries. Keep or replace with yours.
    '10.5281/zenodo.17538091',
    '10.5281/zenodo.17534737',
    '10.5281/zenodo.17532879',
    '10.5281/zenodo.17351915'
  ];

  const QUERIES = [
    'creators.name:"Cody Ryan Jenkins"',
    'creators.name:"Jenkins, Cody Ryan"',
    'creators.name:"Cody R. Jenkins"',
    '(title:Reparodynamics OR description:Reparodynamics OR keywords:Reparodynamics)',
    '(title:"Targeted Gradient Repair Mechanism" OR description:"Targeted Gradient Repair Mechanism" OR keywords:TGRM)',
    '(title:"Repair Yield per Energy" OR description:"Repair Yield per Energy" OR keywords:RYE)',
    // very broad catch all on surname + key term
    '(title:Jenkins AND Reparodynamics)'
  ];

  async function fetchWithBackoff(url, tries = 5, baseDelay = 1200) {
    for (let i = 0; i < tries; i++) {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.status === 429) {
        const wait = baseDelay * Math.pow(2, i);
        log(`Rate limited 429. Retry in ${Math.round(wait/1000)}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Zenodo error ${res.status}: ${text.slice(0,180)}`);
      }
      return res.json();
    }
    throw new Error('Too many 429s. Aborting.');
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
    const url = `https://zenodo.org/api/records/${encodeURIComponent(doi.replace(/^.*zenodo\./i,''))}`;
    try {
      const data = await fetchWithBackoff(url);
      return {
        id: String(data.id),
        title: data.metadata?.title || '(no title)',
        date: data.metadata?.publication_date || data.created || '',
        url: data.links?.html || data.links?.self || '',
        doi: data.doi || data.metadata?.doi || '',
        creators: (data.metadata?.creators || []).map(c => c.name).join(', ')
      };
    } catch (e) {
      log(`DOI fallback failed for ${doi}: ${e.message}`);
      return null;
    }
  }

  async function load() {
    status.innerHTML = 'script.js loaded and running.<br>Trying ' + QUERIES.length + ' query variants.';
    const seen = new Set();
    let results = [];

    // Try all queries and combine
    for (const q of QUERIES) {
      try {
        const rows = await searchQuery(q);
        if (rows.length === 0) {
          log(`No results for ${q}.`);
        } else {
          for (const r of rows) if (!seen.has(r.id)) { seen.add(r.id); results.push(r); }
        }
      } catch (e) {
        log(`Error for ${q}: ${e.message}`);
      }
    }

    // If still empty, use DOI fallbacks
    if (results.length === 0) {
      log('No search results. Using DOI fallbacks so the page is never empty.');
      const manual = [];
      for (const doi of DOI_FALLBACKS) {
        const r = await fetchByDOI(doi);
        if (r && !seen.has(r.id)) { seen.add(r.id); manual.push(r); }
      }
      results = manual;
    }

    if (results.length === 0) {
      list.innerHTML = '<li>No records could be loaded right now. Try a hard refresh. If this repeats, Zenodo search may be degraded temporarily.</li>';
      return;
    }

    // Sort newest first
    results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    list.innerHTML = results.map(r => `
      <li>
        <a href="${r.url}" target="_blank" rel="noopener">${r.title}</a>
        <div class="meta">${r.date} · ${r.creators}${r.doi ? ' · DOI: ' + r.doi : ''}</div>
      </li>
    `).join('');

    log(`Loaded ${results.length} records after de-duplication.`);
  }

  load();
})();
