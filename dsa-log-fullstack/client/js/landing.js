/* Landing page: real progress if logged in, a call to action if not. */
(async () => {
  const box = document.getElementById('preview');
  if (!Api.isLoggedIn()) {
    box.innerHTML = '<li><a class="btn" href="login.html">Create a free account</a></li><li>Sign in to see your own progress here.</li>';
    return;
  }
  box.innerHTML = '<li class="loading">Loading your progress...</li>';
  try {
    const { topics } = await Api.get('/topics');
    box.innerHTML = topics.map(t => `<li class="row"><b>${UI.esc(t.title)}</b>
      <div class="bar ${t.progress.percent === 100 ? 'done' : ''}" role="progressbar" aria-label="${UI.esc(t.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${t.progress.percent}"><span data-pct="${t.progress.percent}"></span></div>
      <span>${t.progress.percent}%</span></li>`).join('') || '<li>No topics yet. Add one from the dashboard.</li>';
    UI.bars(box);
  } catch (e) {
    box.innerHTML = `<li>${UI.esc(e.message)}</li>`;
  }
})();
