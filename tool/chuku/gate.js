// Chuku sign-in gate. Every page under /tool/chuku/ loads this after chuku-config.js and supabase-js.
// It draws the sign-in popup over a blank page, sends the magic link, checks the allowed list,
// logs sign-in events, and only then reveals the page and calls the page's ready callback.
//
// Page contract:
//   <script src="/tool/chuku-config.js"></script>
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
//   <script src="/tool/chuku/gate.js"></script>
//   <script> ChukuGate.ready(({ sb, session, email }) => { /* page starts here */ }); </script>
// Anything in the page with the attribute data-chuku-app stays hidden until the viewer is allowed.
(() => {
  'use strict';
  const cfg = window.CHUKU || {};
  const css = `
    .cg-bg{position:fixed;inset:0;background:var(--bg,#f2f4f6);display:flex;align-items:center;justify-content:center;padding:16px;z-index:1000;font-family:var(--sans,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif);color:var(--fg,#17202b)}
    .cg-bg[hidden]{display:none}
    .cg-card{width:100%;max-width:400px;background:var(--panel,#fff);border:1px solid var(--line,#d3dae2);border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.12)}
    .cg-card h1{font-size:20px;font-weight:600;margin:0}
    .cg-card h2{font-size:13px;font-weight:600;margin:0;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#5c6b7a)}
    .cg-card p{margin:0;color:var(--muted,#5c6b7a);font-size:14px}
    .cg-card input{font:inherit;padding:9px 10px;border:1px solid var(--line-strong,#aab5c1);border-radius:8px;background:var(--panel,#fff);color:inherit}
    .cg-card button{font:inherit;font-weight:500;padding:9px 13px;border-radius:8px;border:1px solid var(--accent,#0d6b70);background:var(--accent,#0d6b70);color:var(--accent-ink,#fff);cursor:pointer}
    .cg-card button:disabled{opacity:.5;cursor:default}
    .cg-msg{min-height:1.4em} .cg-err{color:var(--bad,#b3261e)} .cg-ok{color:var(--good,#1f7a46)}
    [data-chuku-app]:not(.cg-show){display:none !important}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.className = 'cg-bg'; gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-label', 'Sign in');
  gate.innerHTML = `<div class="cg-card">
      <h1>${(document.title || 'Chuku').replace(/</g, '&lt;')}</h1>
      <h2>Sign in</h2>
      <p>Internal page. Enter your email and we send a one-time sign-in link.</p>
      <input type="email" id="cgEmail" placeholder="you@example.com" autocomplete="email">
      <button id="cgSend">Send sign-in link</button>
      <p class="cg-msg" id="cgMsg"></p>
    </div>`;
  const mount = () => document.body.appendChild(gate);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  const $ = id => gate.querySelector('#' + id);
  const msg = (text, cls) => { const m = $('cgMsg'); m.textContent = text; m.className = 'cg-msg ' + (cls || ''); };

  if (!cfg.url || !cfg.key || !window.supabase) {
    document.addEventListener('DOMContentLoaded', () => msg('This page is not connected to Chuku yet (chuku-config.js is empty or supabase-js did not load).', 'cg-err'));
    window.ChukuGate = { ready() {}, signOut() {}, sb: null };
    return;
  }
  const sb = window.supabase.createClient(cfg.url, cfg.key);
  const callbacks = []; let ctx = null, started = false;
  const logEvent = (kind, detail, email_hint) => sb.rpc('log_event', { kind, detail: detail || null, agent: navigator.userAgent.slice(0, 200), email_hint: email_hint || null }).then(() => {}, () => {});

  async function sendLink() {
    const email = $('cgEmail').value.trim(); if (!email) return;
    $('cgSend').disabled = true; msg('Sending…');
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    logEvent('signin_request', { ok: !error, error: error ? error.message : null, page: location.pathname }, email);
    msg(error ? 'Could not send: ' + error.message : 'Check your email and open the link on this device.', error ? 'cg-err' : 'cg-ok');
    $('cgSend').disabled = false;
  }
  gate.addEventListener('click', e => { if (e.target.id === 'cgSend') sendLink(); });
  gate.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'cgEmail') sendLink(); });

  async function start(session) {
    if (started) return; started = true;
    const { data: allowed, error } = await sb.rpc('is_allowed');
    logEvent('signin', { allowed: !!allowed && !error, page: location.pathname });
    if (error || !allowed) {
      started = false;
      msg(`${session.user.email} is signed in but not on the allowed list. Ask the owner to add it.`, 'cg-err');
      $('cgSend').hidden = true; $('cgEmail').hidden = true;
      return;
    }
    ctx = { sb, session, email: session.user.email };
    gate.hidden = true;
    document.querySelectorAll('[data-chuku-app]').forEach(el => el.classList.add('cg-show'));
    callbacks.splice(0).forEach(cb => { try { cb(ctx); } catch (e) { console.error(e); } });
  }
  sb.auth.onAuthStateChange((_evt, session) => { if (session) start(session); });
  sb.auth.getSession().then(({ data }) => { if (data.session) start(data.session); });

  window.ChukuGate = {
    sb,
    ready(cb) { if (ctx) cb(ctx); else callbacks.push(cb); },
    async signOut() { await sb.auth.signOut(); location.reload(); },
    // test hook: reveal the page without a session
    _debugOpen() { gate.hidden = true; document.querySelectorAll('[data-chuku-app]').forEach(el => el.classList.add('cg-show')); ctx = { sb, session: null, email: 'debug' }; callbacks.splice(0).forEach(cb => cb(ctx)); },
  };
})();
