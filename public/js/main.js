(function () {
  var cfg = window.KNOSH_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---- editable content: defaults live in the HTML, overrides come from /api/content ---- */
  var track = function () {};
  var IMG_RE = /^\/api\/img\/[a-f0-9]{32}$/;

  function videoId(v) {
    v = (v || '').trim();
    var m = v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    if (m) return m[1];
    return /^[\w-]{11}$/.test(v) ? v : '';
  }
  /* Hero video: our own poster, play button and controls on top of a fully shielded YouTube player,
     so visitors can't click the title, channel name or YouTube links. */
  var ytReady;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytReady) return ytReady;
    ytReady = new Promise(function (res) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); res(); };
      var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
    });
    return ytReady;
  }
  var ICON = {
    play: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    vol: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4zM14 3.2v2.1a7 7 0 010 13.4v2.1a9 9 0 000-17.6z"/></svg>',
    mute: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9zm13.6 3l2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"/></svg>',
    full: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zM5 14h2v3h3v2H5zm12 0h2v5h-5v-2h3z"/></svg>'
  };
  function mk(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; }
  function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }

  function setVideo(el, v) {
    var id = videoId(v);
    if ((el.getAttribute('data-vid') || '') === id) return;
    el.setAttribute('data-vid', id);
    if (el.__cleanup) el.__cleanup();
    el.textContent = '';
    if (!id) return;

    var wrap = mk('div', 'vp'), stage = mk('div', 'vp-stage'), shield = mk('div', 'vp-shield');
    var poster = mk('img', 'vp-poster'); poster.alt = ''; poster.src = 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg';
    poster.onerror = function () { poster.onerror = null; poster.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; };
    var big = mk('button', 'vp-big', ICON.play + '<span>Watch the video</span>'); big.type = 'button'; big.setAttribute('aria-label', 'Play video');
    var bar = mk('div', 'vp-bar'), pp = mk('button', 'vp-btn', ICON.play), mute = mk('button', 'vp-btn', ICON.vol);
    var time = mk('span', 'vp-time mono', '0:00'), seek = mk('input', 'vp-seek'), fs = mk('button', 'vp-btn', ICON.full);
    pp.type = mute.type = fs.type = 'button'; pp.setAttribute('aria-label', 'Play or pause'); mute.setAttribute('aria-label', 'Mute or unmute'); fs.setAttribute('aria-label', 'Full screen');
    seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.value = 0; seek.setAttribute('aria-label', 'Seek');
    bar.appendChild(pp); bar.appendChild(time); bar.appendChild(seek); bar.appendChild(mute);
    var fsTarget = el.parentNode;
    if (fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen) bar.appendChild(fs);
    [stage, poster, shield, big, bar].forEach(function (n) { wrap.appendChild(n); });
    el.appendChild(wrap);

    var player = null, playing = false, started = false, tick = null, counted = false;
    function ui() {
      wrap.classList.toggle('playing', playing);
      wrap.classList.toggle('started', started);
      pp.innerHTML = playing ? ICON.pause : ICON.play;
    }
    function ensure() {
      if (player) return Promise.resolve();
      started = true;
      return loadYT().then(function () {
        return new Promise(function (res) {
          var node = mk('div'); stage.appendChild(node);
          player = new window.YT.Player(node, {
            videoId: id, host: 'https://www.youtube-nocookie.com',
            playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0 },
            events: {
              onReady: function (e) { e.target.playVideo(); res(); },
              onStateChange: function (e) {
                var S = window.YT.PlayerState;
                playing = e.data === S.PLAYING || e.data === S.BUFFERING;
                if (e.data === S.PLAYING && !counted) { counted = true; track('video_play'); }
                if (e.data === S.ENDED) { started = false; player.seekTo(0, true); player.pauseVideo(); }
                ui();
              }
            }
          });
        });
      });
    }
    function toggle() {
      if (!player) { ensure(); return; }
      started = true;
      if (playing) player.pauseVideo(); else player.playVideo();
      ui();
    }
    big.addEventListener('click', toggle); pp.addEventListener('click', toggle); shield.addEventListener('click', toggle);
    mute.addEventListener('click', function () {
      if (!player) return;
      if (player.isMuted()) { player.unMute(); mute.innerHTML = ICON.vol; } else { player.mute(); mute.innerHTML = ICON.mute; }
    });
    fs.addEventListener('click', function () {
      if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
      else (fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen).call(fsTarget);
    });
    seek.addEventListener('input', function () {
      if (player && player.getDuration) player.seekTo(player.getDuration() * seek.value / 1000, true);
    });
    tick = setInterval(function () {
      if (!player || !player.getDuration || !playing) return;
      var d = player.getDuration() || 0, t = player.getCurrentTime() || 0;
      if (d) seek.value = Math.round(t / d * 1000);
      time.textContent = fmt(t) + ' / ' + fmt(d);
    }, 300);
    el.__cleanup = function () { clearInterval(tick); try { if (player && player.destroy) player.destroy(); } catch (e) {} el.__cleanup = null; };
    ui();
  }

  function linesOf(el) {
    return [].map.call(el.childNodes, function (n) { return n.nodeName === 'BR' ? '\n' : n.textContent; }).join('');
  }
  function setLines(el, v) {
    el.textContent = '';
    v.split('\n').forEach(function (line, i) {
      if (i) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));
    });
  }
  function applyContent(values) {
    values = values || {};
    [].forEach.call(document.querySelectorAll('[data-edit]'), function (el) {
      var key = el.getAttribute('data-edit'), type = el.getAttribute('data-type') || 'text', v = values[key];
      if (type === 'video') { setVideo(el, typeof v === 'string' ? v : cfg.heroVideo); return; }
      if (type === 'image') {
        if (el.__def == null) el.__def = el.getAttribute('src');
        el.setAttribute('src', typeof v === 'string' && IMG_RE.test(v) ? v : el.__def);
        return;
      }
      if (el.__def == null) el.__def = type === 'lines' ? linesOf(el) : el.textContent;
      if (typeof v !== 'string' || v === '') v = el.__def;
      if (type === 'lines') setLines(el, v); else if (el.textContent !== v) el.textContent = v;
    });
    var digits = ((values['info.phone'] || '') + '').replace(/\D/g, '');
    var tel = document.querySelector('a.phone');
    if (tel) tel.setAttribute('href', digits.length >= 10 ? 'tel:+' + (digits.length === 10 ? '1' : '') + digits : 'tel:+19897515986');
  }
  window.KnoshApplyContent = applyContent;

  /* ---- anonymous analytics (no cookies; owner's own browser and the editor preview are skipped) ---- */
  (function () {
    var off = /[?&]preview=1/.test(location.search);
    try { if (localStorage.getItem('kb_notrack') === '1') off = true; } catch (e) {}
    function send(e, extra) {
      if (off) return;
      try {
        var body = { e: e }; for (var k in extra) body[k] = extra[k];
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () {});
      } catch (err) {}
    }
    track = function (e) { send(e); };
    var ref = '';
    try {
      if (document.referrer) {
        ref = new URL(document.referrer).hostname.replace(/^www\./, '');
        if (ref === location.hostname.replace(/^www\./, '')) ref = '';
      }
    } catch (e) {}
    var fresh = false;
    try {
      var today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem('kb_seen') !== today) { localStorage.setItem('kb_seen', today); fresh = true; }
    } catch (e) {}
    send('view', { ref: ref, dev: innerWidth < 700 ? 'mobile' : 'desktop', visitor: fresh });
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest ? ev.target.closest('a.phone, .fab, .cta, .nav a[href="#contact"]') : null;
      if (!t) return;
      send(t.matches('a.phone') ? 'call' : 'contact_click');
    });
  })();

  fetch('/api/content', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
    .then(function (j) { applyContent(j && j.values); });

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
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ''); done(d); }); })
        .catch(function (e) { showErr((e.message ? e.message + ' ' : 'Sorry, that didn’t go through.') + phoneMsg); })
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
