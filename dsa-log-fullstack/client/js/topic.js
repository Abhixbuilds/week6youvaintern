/* Topic detail: problems, progress, notes. Every change is saved through the API. */
if (UI.requireAuth()) {
  const $ = id => document.getElementById(id);
  const topicId = Number(new URLSearchParams(location.search).get('id'));
  let topic, level = 'all', noteTimer;

  const percent = () => topic.problems.length ? Math.round(topic.problems.filter(p => p.solved).length / topic.problems.length * 100) : 0;

  function updateProgress() {
    const solved = topic.problems.filter(p => p.solved).length;
    $('bar').setAttribute('aria-valuenow', percent());
    $('bar').classList.toggle('done', percent() === 100);
    $('bar').firstElementChild.style.width = percent() + '%';
    $('count').textContent = `${solved} of ${topic.problems.length} solved`;
  }

  function renderList() {
    const list = topic.problems.filter(p => level === 'all' || p.level === level);
    $('plist').innerHTML = list.map(p => `<li class="prob ${p.solved ? 'is-done' : ''}">
      <input type="checkbox" id="p${p.id}" data-id="${p.id}" ${p.solved ? 'checked' : ''}>
      <label for="p${p.id}">${UI.esc(p.name)}</label><span class="tag ${p.level}">${p.level}</span>
      <button type="button" class="del" data-del="${p.id}" aria-label="Delete ${UI.esc(p.name)}">Delete</button></li>`).join('')
      || '<li>No problems here yet. Add one above.</li>';
  }

  async function load() {
    $('loading').hidden = false; $('error').hidden = true; $('content').hidden = true;
    try {
      const [one, all] = await Promise.all([Api.get(`/topics/${topicId}`), Api.get('/topics')]);
      topic = one.topic;
      document.title = `${topic.title} - DSA Log`;
      $('title').textContent = topic.title;
      $('desc').textContent = topic.description;
      $('note').value = topic.notes;
      const i = all.topics.findIndex(t => t.id === topicId);
      const prev = all.topics[i - 1], next = all.topics[i + 1];
      $('pager').innerHTML =
        (prev ? `<a class="btn alt" href="topic.html?id=${prev.id}">Previous: ${UI.esc(prev.title)}</a>` : '<span></span>') +
        (next ? `<a class="btn" href="topic.html?id=${next.id}">Next: ${UI.esc(next.title)}</a>` : '');
      updateProgress(); renderList();
      $('content').hidden = false;
    } catch (e) {
      $('error-text').textContent = e.status === 404 || e.status === 400 ? 'Topic not found.' : e.message;
      $('retry').hidden = e.status === 404 || e.status === 400;
      $('error').hidden = false;
    } finally { $('loading').hidden = true; }
  }

  // Tick / untick: update the screen first, save in the background, undo if the save fails.
  $('plist').onchange = async e => {
    const p = topic.problems.find(x => x.id === Number(e.target.dataset.id));
    const wanted = e.target.checked;
    p.solved = wanted; updateProgress(); e.target.closest('.prob').classList.toggle('is-done', wanted);
    try { await Api.patch(`/problems/${p.id}`, { solved: wanted }); }
    catch (err) {
      p.solved = !wanted; e.target.checked = !wanted; updateProgress();
      e.target.closest('.prob').classList.toggle('is-done', !wanted);
      UI.toast(`Could not save: ${err.message}`);
    }
  };

  $('plist').onclick = async e => {
    const id = Number(e.target.dataset.del);
    if (!id || !confirm('Delete this problem?')) return;
    try {
      await Api.del(`/problems/${id}`);
      topic.problems = topic.problems.filter(p => p.id !== id);
      updateProgress(); renderList();
    } catch (err) { UI.toast(err.message); }
  };

  $('add-problem').onsubmit = async e => {
    e.preventDefault();
    const btn = e.submitter || e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      const { problem } = await Api.post(`/topics/${topicId}/problems`, { name: $('p-name').value, level: $('p-level').value });
      topic.problems.push(problem);
      $('p-name').value = '';
      updateProgress(); renderList();
    } catch (err) { UI.toast(err.details?.[0]?.message || err.message); }
    finally { btn.disabled = false; }
  };

  document.querySelectorAll('.chip').forEach(b => { b.onclick = () => {
    level = b.dataset.l;
    document.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b));
    renderList();
  }; });

  $('note').oninput = () => {
    $('status').textContent = 'Saving...';
    clearTimeout(noteTimer);
    noteTimer = setTimeout(async () => {
      try { await Api.patch(`/topics/${topicId}`, { notes: $('note').value }); $('status').textContent = 'Note saved.'; }
      catch { $('status').textContent = 'Could not save the note. Check your connection.'; }
    }, 500);
  };

  $('delete-topic').onclick = async () => {
    if (!confirm(`Delete "${topic.title}" and all its problems?`)) return;
    try { await Api.del(`/topics/${topicId}`); location.href = 'dashboard.html'; }
    catch (err) { UI.toast(err.message); }
  };

  $('retry').onclick = load;
  load();
}
