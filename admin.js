/* Managed Supabase authentication. Database RLS is the authorization boundary. */
(() => {
  const $ = selector => document.querySelector(selector);
  const { validate, configuration, limits } = window.PortfolioData;
  const config = configuration();
  const status = $('#admin-status');
  if (!config || !window.supabase) {
    status.textContent = 'Database setup is required. Follow SETUP-DATABASE.md, then add your public project settings in config.js.';
    return;
  }
  if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    status.textContent = 'Use an HTTPS website or a localhost preview to sign in.';
    return;
  }
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false }
  });
  let factorId = null;
  let lastActivity = Date.now();
  let signedIn = false;
  let page = 0;
  let generation = 0;
  let contentReady = false;
  let baseUpdatedAt = null;
  const pageSize = 20;
  const timeout = 15 * 60 * 1000;
  $('#login-panel').hidden = false;
  status.textContent = 'Sign in to manage your portfolio.';

  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text) result.textContent = text;
    if (className) result.className = className;
    return result;
  }
  async function lock(message = 'You have signed out.') {
    generation++; signedIn = false; contentReady = false; factorId = null; baseUpdatedAt = null;
    $('#dashboard').hidden = true; $('#mfa-panel').hidden = true;
    $('#login-panel').hidden = false; $('#sign-out').hidden = true;
    $('#inquiry-list').replaceChildren(); $('#portfolio-form').reset(); $('#mfa-form').reset();
    for (const kind of Object.keys(limits)) $(`#edit-${kind}`).replaceChildren();
    $('#mfa-secret').textContent = ''; $('#enrollment').hidden = true;
    status.textContent = message;
    // Wipe the in-memory session even if the network is unavailable.
    try { await client.auth.signOut({ scope: 'local' }); } catch { /* No persisted session exists. */ }
    client.auth.stopAutoRefresh();
  }
  $('#sign-out').addEventListener('click', () => lock());
  function activity() {
    if (!signedIn) return;
    if (Date.now() - lastActivity >= timeout) { void lock('Session locked after inactivity. Please sign in again.'); return; }
    lastActivity = Date.now();
  }
  for (const event of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(event, activity, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && signedIn && Date.now() - lastActivity >= timeout) void lock('Session locked. Please sign in again.');
  });
  setInterval(() => {
    if (signedIn && Date.now() - lastActivity >= timeout) void lock('Session locked after inactivity. Please sign in again.');
  }, 15000);
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT' && signedIn) void lock('Please sign in again.');
  });
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button'); button.disabled = true;
    status.textContent = 'Checking your account…';
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: form.elements.email.value.trim(), password: form.elements.password.value });
      form.elements.password.value = '';
      if (error || !data.user) throw new Error('Unable to sign in. Check your details or try again later.');
      const allowed = await client.rpc('is_portfolio_admin');
      if (allowed.error || allowed.data !== true) {
        await lock('This account is not approved for the dashboard.'); return;
      }
      signedIn = true; lastActivity = Date.now(); client.auth.startAutoRefresh();
      $('#login-panel').hidden = true; $('#sign-out').hidden = false;
      const factors = await client.auth.mfa.listFactors();
      if (factors.error) throw new Error('Could not start two-step verification. Sign out and try again.');
      const verified = factors.data.totp.find(item => item.status === 'verified');
      $('#enrollment').hidden = Boolean(verified);
      if (verified) factorId = verified.id;
      else {
        // Clean up interrupted enrollments. Never remove a verified factor here.
        for (const factor of factors.data.all.filter(item => item.status === 'unverified' && item.factor_type === 'totp')) {
          const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
          if (removed.error) throw new Error('Could not restart authenticator setup. Sign out and try again.');
        }
        const enrollment = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Julianne portfolio' });
        if (enrollment.error) throw new Error('Could not enroll your authenticator. Check the MFA settings in Supabase.');
        factorId = enrollment.data.id;
        $('#mfa-secret').textContent = enrollment.data.totp.secret;
      }
      $('#mfa-panel').hidden = false;
      status.textContent = verified ? 'Enter the code from your authenticator app.' : 'Set up your authenticator app to protect this account.';
      $('#mfa-form').elements.code.focus();
    } catch (error) { status.textContent = error.message; }
    finally { form.elements.password.value = ''; button.disabled = false; }
  });
  $('#mfa-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!signedIn || !factorId) return;
    const version = generation;
    const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
    try {
      const result = await client.auth.mfa.challengeAndVerify({ factorId, code: form.elements.code.value });
      form.elements.code.value = '';
      if (result.error) throw new Error('That code could not be verified. Try the current code from your app.');
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== 'aal2') throw new Error('Two-step verification is required.');
      if (version !== generation || !signedIn) return;
      $('#mfa-secret').textContent = ''; $('#mfa-panel').hidden = true;
      $('#dashboard').hidden = false; status.textContent = 'Signed in with two-step verification.';
      await Promise.all([loadPortfolio(version), loadInquiries(true, version)]);
    } catch (error) { if (version === generation) status.textContent = error.message; }
    finally { button.disabled = false; }
  });

  const fields = {
    skills: [['name', 'Skill / service', 100], ['description', 'Description', 1000]],
    projects: [['title', 'Project title', 150], ['description', 'Description', 2000], ['url', 'Project link (optional, https://)', 2000]],
    links: [['label', 'Link label', 100], ['url', 'Link (https://)', 2000]]
  };
  function addRow(kind, value = {}) {
    const container = $(`#edit-${kind}`);
    if (container.children.length >= limits[kind]) return;
    const row = node('div', '', 'editor-row');
    for (const [key, label, max] of fields[kind]) {
      const wrapper = node('label', label);
      const input = node(key === 'description' ? 'textarea' : 'input');
      input.dataset.key = key; input.maxLength = max;
      input.value = value[key] || ''; input.required = key !== 'url';
      if (key === 'url') input.type = 'url';
      wrapper.append(input); row.append(wrapper);
    }
    const remove = node('button', 'Remove item', 'text-button'); remove.type = 'button';
    remove.addEventListener('click', () => row.remove()); row.append(remove); container.append(row);
  }
  document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => addRow(button.dataset.add)));
  async function loadPortfolio(version) {
    contentReady = false;
    const result = await client.from('portfolio').select('content,updated_at').eq('id', 1).single();
    if (generation !== version || !signedIn) return;
    if (result.error) { $('#save-status').textContent = 'Could not load portfolio. Run the seed SQL and check database permissions.'; return; }
    try {
      const content = validate(result.data.content); baseUpdatedAt = result.data.updated_at;
      const form = $('#portfolio-form');
      for (const key of ['about', 'email', 'achievement']) form.elements[key].value = content[key];
      for (const kind of Object.keys(limits)) {
        $(`#edit-${kind}`).replaceChildren(); content[kind].forEach(value => addRow(kind, value));
      }
      contentReady = true; $('#save-status').textContent = '';
    } catch { $('#save-status').textContent = 'Stored content is invalid. Restore a valid database backup before editing.'; }
  }
  $('#portfolio-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!contentReady || !signedIn) return;
    const version = generation; const form = event.currentTarget;
    const button = form.querySelector('button[type=submit]'); button.disabled = true;
    $('#save-status').textContent = 'Saving…';
    try {
      const content = {};
      for (const key of ['about', 'email', 'achievement']) content[key] = form.elements[key].value;
      for (const kind of Object.keys(limits)) content[kind] = Array.from($(`#edit-${kind}`).children, row => Object.fromEntries(Array.from(row.querySelectorAll('[data-key]'), input => [input.dataset.key, input.value])));
      const normalized = validate(content);
      const saved = await client.from('portfolio').update({ content: normalized, updated_at: new Date().toISOString() }).eq('id', 1).eq('updated_at', baseUpdatedAt).select('id,updated_at').single();
      if (version !== generation || !signedIn) return;
      if (saved.error || !saved.data) throw new Error('Not saved. Your session may have expired, or another tab changed this portfolio. Sign in again to reload.');
      baseUpdatedAt = saved.data.updated_at;
      $('#save-status').textContent = 'Saved. Your public portfolio now uses these details.';
    } catch (error) { if (version === generation) $('#save-status').textContent = error.message; }
    finally { button.disabled = false; }
  });

  async function loadInquiries(reset = false, version = generation) {
    if (!signedIn) return;
    if (reset) { page = 0; $('#inquiry-list').replaceChildren(); }
    $('#inquiry-status').textContent = 'Loading messages…'; $('#load-more').disabled = true;
    const result = await client.from('inquiries').select('id,name,email,message,status,created_at').order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
    if (version !== generation || !signedIn) return;
    if (result.error) { $('#inquiry-status').textContent = 'Messages could not load. Check your session and database permissions.'; $('#load-more').disabled = false; return; }
    for (const item of result.data) {
      const card = node('article', '', 'inquiry-card');
      const heading = node('h3', item.name); const state = node('span', item.status === 'new' ? 'New inquiry' : 'Read', 'message-state');
      card.append(heading, state, node('p', `${item.email} · ${new Date(item.created_at).toLocaleString()}`), node('p', item.message, 'message-body'));
      const actions = node('div', '', 'message-actions');
      const read = node('button', 'Mark as read', 'text-button'); read.type = 'button'; read.disabled = item.status === 'read';
      read.addEventListener('click', async () => {
        read.disabled = true;
        const updated = await client.from('inquiries').update({ status: 'read' }).eq('id', item.id).select('id').single();
        if (version !== generation) return;
        if (updated.error) { read.disabled = false; $('#inquiry-status').textContent = 'Could not update this message.'; }
        else state.textContent = 'Read';
      });
      const remove = node('button', 'Delete message', 'text-button'); remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!window.confirm('Delete this inquiry from the active database? This cannot be undone here. Provider backups may retain it until they expire.')) return;
        remove.disabled = true;
        const deleted = await client.from('inquiries').delete().eq('id', item.id).select('id').single();
        if (version !== generation) return;
        if (deleted.error) { remove.disabled = false; $('#inquiry-status').textContent = 'Could not delete this message.'; }
        else { card.remove(); $('#inquiry-status').textContent = 'Message deleted.'; }
      });
      actions.append(read, remove); card.append(actions); $('#inquiry-list').append(card);
    }
    page++; $('#load-more').hidden = result.data.length < pageSize; $('#load-more').disabled = false;
    $('#inquiry-status').textContent = $('#inquiry-list').children.length ? 'Messages loaded.' : 'No inquiries yet.';
  }
  $('#refresh-inquiries').addEventListener('click', () => loadInquiries(true));
  $('#load-more').addEventListener('click', () => loadInquiries());
})();
