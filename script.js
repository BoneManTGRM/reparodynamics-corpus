async function load(){
  const res = await fetch('corpus.json'); 
  const data = await res.json();
  const listEl = document.getElementById('list');
  const qEl = document.getElementById('q'); 
  const topicEl = document.getElementById('topic'); 
  const sortEl = document.getElementById('sort');
  const statsEl = document.getElementById('stats');

  function render(items){
    listEl.innerHTML='';
    items.forEach(it=>{
      const el=document.createElement('article'); 
      el.className='card';
      el.innerHTML = `
        <a class="title" href="${it.url}" target="_blank" rel="noopener">${it.title}</a>
        <div class="meta">
          <span class="badge">📅 ${it.date||''}</span>
          ${it.views!=null?`<span class="badge">👁 ${it.views}</span>`:''}
          ${it.downloads!=null?`<span class="badge">⬇︎ ${it.downloads}</span>`:''}
          <span class="badge">🔖 ${it.topic||''}</span>
          <span class="badge">🔗 ${it.doi||''}</span>
        </div>
        <p class="abstract">${it.abstract||''}</p>
        <div class="tags">${(it.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</div>`;
      listEl.appendChild(el);
    });
    statsEl.textContent = `${items.length} records • ${new Date().toLocaleString()}`;
  }

  function apply(){
    const q=(qEl.value||'').toLowerCase(); 
    const topic=topicEl.value; 
    let items=data.slice();
    if(q){ items=items.filter(it=>(it.title+it.abstract+(it.tags||[]).join(' ')).toLowerCase().includes(q)); }
    if(topic){ items=items.filter(it=>it.topic===topic); }
    const key=sortEl.value;
    items.sort((a,b)=>{
      if(key==='date_desc') return (b.date||'').localeCompare(a.date||'');
      if(key==='date_asc') return (a.date||'').localeCompare(b.date||'');
      if(key==='views_desc') return (b.views||0)-(a.views||0);
      if(key==='downloads_desc') return (b.downloads||0)-(a.downloads||0);
      if(key==='title_asc') return (a.title||'').localeCompare(b.title||'');
      return 0;
    });
    render(items);
  }

  qEl.addEventListener('input',apply); 
  topicEl.addEventListener('change',apply); 
  sortEl.addEventListener('change',apply);
  apply();
}
load();
