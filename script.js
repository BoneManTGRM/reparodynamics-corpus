// Robust Zenodo loader with on page diagnostics
// Put this file at the repo root as script.js

const LIST = document.getElementById('list');

// If Zenodo spells the author differently, add it here
const AUTHOR_CANDIDATES = [
  'Cody Ryan Jenkins',
  'Jenkins, Cody Ryan',
  'Cody R. Jenkins'
];

// Page size per API call
const PAGE_SIZE = 200;

// write a diagnostic line into the page
function diag(msg) {
  const p = document.createElement('p');
  p.style.color = '#8b949e';
  p.style.fontSize = '0.9rem';
  p.innerHTML = msg;
  LIST.appendChild(p);
}

function clearList() {
  LIST.innerHTML = '';
}

function escapeQuotes(s) {
  return s.replace(/"/g, '\\"');
}

function buildQueries() {
  const qs = [];
  // exact creators.name
  for (const a of AUTHOR_CANDIDATES) {
    qs.push(`creators.name:"${escapeQuotes(a)}"`);
  }
  // phrase search as fallback
  for (const a of AUTHOR_CANDIDATES) {
    qs.push(`"${escapeQuotes(a)}"`);
  }
  // final safety keyword
  qs.push('Reparodynamics');
  return qs;
}

async function fetchAllForQuery(q) {
  let page = 1;
  let all = [];
  while (true) {
    const url = new URL('https://zenodo.org/api/records');
    url.searchParams.set('q', q);
    url.searchParams.set('size', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', 'mostrecent');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Zenodo error ${res.status} for query: ${q}`);
    const data = await res.json();
    const hits = Array.isArray(data.hits?.hits) ? data.hits.hits : [];
    all = all.concat(hits);
    if (hits.length < PAGE_SIZE) break;
    page++;
  }
  return all;
}

function cardHTML(r) {
  const title = r.metadata?.title || 'Untitled';
  const doi = r.metadata?.doi ? `https://doi.org/${r.metadata.doi}` : null;
  const link = r.links?.html || doi || '#';
  const date = r.metadata?.publication_date || r.created || '';
  const rawDesc = r.metadata?.description || '';
  const desc = rawDesc
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);

  const files = Array.isArray(r.files) ? r.files : [];
  const filesHTML = files.length
    ? `<p class="files">${files.slice(0, 3).map(f =>
        `<a href="${f.links?.self}" target="_blank" rel="noopener noreferrer">${f.key}</a>`
      ).join(' · ')}${files.length > 3 ? ' · …' : ''}</p>`
    : '';

  return `
    <article class="card">
      <h3><a href="${link}" target="_blank" rel="noopener noreferrer">${title}</a></h3>
      <p class="meta">${date}${doi ? ` · <a href="${doi}" target="_blank" rel="noopener noreferrer">DOI</a>` : ''}</p>
      ${desc ? `<p>${desc}…</p>` : ''}
      ${filesHTML}
    </article>
  `;
}

function render(records, label) {
  clearList();

  if (!records.length) {
    LIST.innerHTML = `<p>No records found. Edit <code>AUTHOR_CANDIDATES</code> in <code>script.js</code> to match the exact name shown under Creators on Zenodo.</p>`;
    diag(`Tried query group: <code>${label}</code>`);
    return;
  }

  diag(`Loaded ${records.length} record(s) from Zenodo using <code>${label}</code>.`);
  LIST.insertAdjacentHTML('beforeend', records.map(cardHTML).join(''));
}

(async () => {
  clearList();
  LIST.innerHTML = '<p>Loading your Zenodo corpus…</p>';

  try {
    diag('script.js loaded and running.');
    const queries = buildQueries();
    diag(`Trying ${queries.length} query variants.`);

    for (const q of queries) {
      try {
        const records = await fetchAllForQuery(q);
        if (records.length) {
          render(records, q);
          return;
        } else {
          diag(`No results for <code>${q}</code>.`);
        }
      } catch (err) {
        diag(err.message);
      }
    }

    clearList();
    LIST.innerHTML = `
      <p>Could not find records automatically.</p>
      <p>Open any one of your Zenodo records and copy the exact creator string, then add it to <code>AUTHOR_CANDIDATES</code>.</p>
    `;
  } catch (e) {
    console.error(e);
    clearList();
    LIST.innerHTML = `<p>Could not load Zenodo records. ${e.message}</p>`;
  }
})();
