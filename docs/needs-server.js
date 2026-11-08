// Pages that render in the browser load ES modules, which browsers refuse to load from file://
// addresses, so opened from disk they would stay blank. This classic script (classic scripts do
// load from disk) puts an explanation in every [data-needs-server] element instead.
(function () {
  if (location.protocol !== 'file:') return;
  function explain() {
    var targets = document.querySelectorAll('[data-needs-server]');
    for (var i = 0; i < targets.length; i++) {
      var box = document.createElement('div');
      box.className = 'needs-server';
      var title = document.createElement('strong');
      title.textContent = 'This page needs a web server.';
      var text = document.createElement('p');
      text.textContent = 'It was opened from disk (file://), and browsers do not load JavaScript modules from there. In the bindpress-manual folder, run:';
      var command = document.createElement('code');
      command.textContent = 'npm run docs';
      var after = document.createElement('p');
      after.textContent = 'then open http://localhost:8000' + location.pathname.replace(/^.*?(\/(docs|examples)\/)/, '$1') + ' instead.';
      box.append(title, text, command, after);
      targets[i].replaceChildren(box);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', explain);
  else explain();
})();
