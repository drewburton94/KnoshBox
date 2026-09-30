(function () {
  var cfg = window.KNOSH_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };

  document.getElementById('yr').textContent = new Date().getFullYear();

  /* hero video */
  (function () {
    var v = (cfg.heroVideo || '').trim(), id = '';
    var m = v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    if (m) id = m[1]; else if (/^[\w-]{11}$/.test(v)) id = v;
    if (!id) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube.com/embed/' + id + '?autoplay=1&mute=1&loop=1&playlist=' + id +
      '&controls=0&modestbranding=1&playsinline=1&rel=0';
    f.title = 'Knosh Box shop video';
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.setAttribute('loading', 'lazy');
    $('#heroVideo').appendChild(f);
  })();

  /* clamshells: hover opens on mouse devices, tap/Enter toggles, one open at a time */
  (function () {
    var shells = [].slice.call(document.querySelectorAll('.shell'));
    var canHover = window.matchMedia('(hover:hover)').matches;
    function set(el, on) { el.classList.toggle('open', on); el.setAttribute('aria-expanded', on ? 'true' : 'false'); }
    function only(el) { shells.forEach(function (s) { set(s, s === el); }); }
    shells.forEach(function (s) {
      if (canHover) {
        s.addEventListener('mouseenter', function () { only(s); });
        s.addEventListener('mouseleave', function () { set(s, false); });
      }
      s.addEventListener('click', function () { only(s.classList.contains('open') ? null : s); });
    });
  })();

  /* floating contact button: shake after 2.5s, then every 30s */
  (function () {
    var f = $('#fab');
    if (!f.animate || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    var t = 'translateY(-10px) scale(1.08) rotate(';
    function shake() {
      f.animate([{ transform: 'none' }, { transform: t + '-6deg)' }, { transform: t + '6deg)' },
        { transform: t + '-5deg)' }, { transform: t + '4deg)' }, { transform: 'none' }],
        { duration: 900, easing: 'ease-in-out' });
    }
    setTimeout(shake, 2500); setInterval(shake, 30000);
  })();

  /* contact form */
  (function () {
    var form = $('#form'), sent = $('#sent'), err = $('#formError'), btn = $('#sendBtn');
    function showErr(msg) { err.textContent = msg; err.hidden = !msg; }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); showErr('');
      form.classList.add('tried');
      var d = new FormData(form);
      var bad = ['name', 'email', 'phone', 'message'].some(function (k) { return !String(d.get(k) || '').trim(); });
      if (bad || !form.checkValidity()) { form.reportValidity && form.reportValidity(); return; }
      if (d.get('_gotcha')) { done(d); return; } // honeypot: pretend success
      var phoneMsg = ' Please call us at (989) 751 5986 instead.';
      if (!cfg.formEndpoint) { showErr('The message form isn’t connected yet.' + phoneMsg); return; }
      var body = {}; d.forEach(function (v, k) { body[k] = v; });
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch(cfg.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); done(d); })
        .catch(function () { showErr('Sorry, that didn’t go through.' + phoneMsg); })
        .then(function () { btn.disabled = false; btn.textContent = 'Send message →'; });
    });
    function done(d) {
      var first = String(d.get('name') || '').trim().split(/\s+/)[0] || 'there';
      $('#sentTitle').textContent = 'Thanks, ' + first + '. Message received.';
      form.hidden = true; sent.hidden = false;
    }
    $('#again').addEventListener('click', function () {
      form.reset(); form.classList.remove('tried'); sent.hidden = true; form.hidden = false; showErr('');
    });
  })();
})();
