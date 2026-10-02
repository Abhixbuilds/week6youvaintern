/* Dashboard: stats + topic list from the API, with server-side search and filter. */
if (UI.requireAuth()) {
  const $ = id => document.getElementById(id);
  let filter = 'all', query = '', timer, latest = 0;

  const card = t => `<li><a class="card" href="topic.html?id=${t.id}">
    <h3>${UI.esc(t.title)}</h3><p>${UI.esc(t.description)}</p>
    <div class="bar ${t.progress.percent === 100 ? 'done' : ''}" role="progressbar" aria-label="${UI.esc(t.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${t.progress.percent}"><span data-pct="${t.progress.percent}"></span></div>
    <p class="meta">${t.progress.solved} of ${t.progress.total} solved</p></a></li>`;

  async function load() {
    const ticket = ++latest; // ignore out-of-order responses when the user types quickly
    $('loading').hidden = false; $('error').hidden = true;
    const qs = new URLSearchParams();
    if (query) qs.set('search', query);
    if (filter !== 'all') qs.set('status', filter);
    try {
      const [list, stats] = await Promise.all([Api.get(`/topics?${qs}`), Api.get('/stats')]);
      if (ticket !== latest) return;
      $('s-solved').textContent = stats.solved;
      $('s-pct').textContent = stats.percent + '%';
      $('s-topics').textContent = `${stats.topicsFinished}/${stats.totalTopics}`;
      $('grid').innerHTML = list.topics.map(card).join('');
      UI.bars($('grid'));
      $('empty').hidden = list.count > 0;
    } catch (e) {
      if (ticket !== latest) return;
      $('grid').innerHTML = '';
      $('error-text').textContent = e.message;
      $('error').hidden = false;
    } finally {
      if (ticket === latest) $('loading').hidden = true;
    }
  }

  $('search').oninput = e => { clearTimeout(timer); timer = setTimeout(() => { query = e.target.value.trim(); load(); }, 300); };
  document.querySelectorAll('.chip').forEach(b => { b.onclick = () => {
    filter = b.dataset.f;
    document.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b));
    load();
  }; });
  $('retry').onclick = load;

  $('add-topic').onsubmit = async e => {
    e.preventDefault();
    const btn = e.submitter || e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      await Api.post('/topics', { title: $('new-title').value });
      $('new-title').value = '';
      UI.toast('Topic added.', 'ok');
      load();
    } catch (err) {
      UI.toast(err.details?.[0]?.message || err.message);
    } finally { btn.disabled = false; }
  };
  load();
}
