// script.js — pulls ALL your Zenodo records and renders them

const LIST = document.getElementById('list');

// Change this to your exact name as it appears on Zenodo
const AUTHOR = 'Cody Ryan Jenkins';

// how many per page Zenodo should return (max 200)
const PAGE_SIZE = 200;

async function fetchAllZenodo(author) {
  // We’ll pull pages until Zenodo returns fewer than PAGE_SIZE
  let page = 1;
  let all = [];

  while (true) {
    const url = new URL('https://zenodo.org/api/records');
    url.searchParams.set('q', `creators.name:"${author.replace(/"/g, '\\"')}"`);
    url.searchParams.set('size', PAGE_SIZE.toString());
    url.searchParams.set('page', page.toString());
    url.searchParams.set('sort', 'mostrecent');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Zenodo error: ${res.status}`);
    const data = await res.json();

    const hits = Array.isArray(data.hits?.hits) ? data.hits.hits : [];
    all = all.concat(hits);
    if (hits.length < PAGE_SIZE) break; // no more pages
    page++;
  }

  return all;
}

function render(records) {
  if (!records.length) {
    LIST.innerHTML = `<p>No records found for ${AUTHOR}.</p>`;
    return;
  }

  const html = records.map(r => {
    const title = r.metadata?.title || 'Untitled';
    const doi = r.metadata?.doi ? `https://doi.org/${r.metadata.doi}` : null;
    const link = r.links?.html || doi || '#';
    const date = r.metadata?.publication_date || r.created || '';
    const desc = r.metadata?.description
      ? r.metadata.description.replace(/<[^>]*>/g, '').slice(0, 280) + '…'
      : '';

    return `
      <article class="card">
        <h3><a href="${link}" target="_blank" rel="noopener noreferrer">${title}</a></h3>
        <p class="meta">${date}${doi ? ` · <a href="${doi}" target="_blank" rel="noopener noreferrer">DOI</a>` : ''}</p>
        ${desc ? `<p>${desc}</p>` : ''}
        ${Array.isArray(r.files) && r.files.length
          ? `<p class="files">${r.files.slice(0,3).map(f => 
              `<a href="${f.links?.self}" target="_blank" rel="noopener noreferrer">${f.key}</a>`
            ).join(' · ')}${r.files.length > 3 ? ' · …' : ''}</p>`
          : ''
        }
      </article>
    `;
  }).join('');

  LIST.innerHTML = html;
}

(async () => {
  LIST.innerHTML = '<p>Loading your Zenodo corpus…</p>';
  try {
    const records = await fetchAllZenodo(AUTHOR);
    render(records);
  } catch (e) {
    console.error(e);
    LIST.innerHTML = `<p>Couldn’t load Zenodo records. ${e.message}</p>`;
  }
})();
