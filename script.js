/* Public portfolio: no admin session or database secrets. */
(() => {
  const { validate, safeUrl, configuration } = window.PortfolioData;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text; // Saved content is always text, never HTML.
    return node;
  }
  function externalLink(label, url, className) {
    const link = element('a', className, label);
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${label} (opens in a new tab)`);
    return link;
  }
  function render(portfolio) {
    document.querySelector('#about-text').textContent = portfolio.about;
    document.querySelector('#achievement-text').textContent = portfolio.achievement;
    const skills = document.querySelector('#skill-list');
    const projects = document.querySelector('#project-grid');
    const socials = document.querySelector('#social-links');
    skills.replaceChildren(); projects.replaceChildren(); socials.replaceChildren();
    portfolio.skills.forEach((skill, index) => {
      const row = element('div', 'skill-row');
      row.append(element('span', 'skill-number', String(index + 1).padStart(2, '0')), element('h3', '', skill.name), element('p', '', skill.description));
      skills.append(row);
    });
    portfolio.projects.forEach(project => {
      const card = element('article', 'project-card');
      const visual = element('div', 'project-visual');
      visual.setAttribute('aria-hidden', 'true');
      const sheet = element('div', 'sample-sheet');
      for (let i = 0; i < 4; i++) sheet.append(element('span'));
      visual.append(sheet, element('span', 'sample-label', 'DECORATIVE WORK SAMPLE'));
      card.append(visual, element('h3', '', project.title), element('p', '', project.description));
      const url = safeUrl(project.url);
      if (url) card.append(externalLink('View project ↗', url, 'project-link'));
      projects.append(card);
    });
    const emailLink = document.querySelector('#email-link');
    emailLink.hidden = !portfolio.email; emailLink.removeAttribute('href');
    if (portfolio.email) emailLink.href = `mailto:${encodeURIComponent(portfolio.email)}`;
    document.querySelector('#contact-placeholder').hidden = Boolean(portfolio.email);
    portfolio.links.forEach(item => {
      const url = safeUrl(item.url);
      if (url) socials.append(externalLink(`${item.label} ↗`, url));
    });
  }
  render(validate(window.DEFAULT_PORTFOLIO));
  document.querySelector('#year').textContent = new Date().getFullYear();
  const config = configuration();
  if (!config) return;
  fetch(`${config.supabaseUrl}/rest/v1/portfolio?id=eq.1&select=content`, {
    headers: { apikey: config.supabasePublishableKey }, cache: 'no-store', signal: AbortSignal.timeout(10000)
  }).then(response => {
    if (!response.ok) throw new Error('Unavailable');
    return response.json();
  }).then(rows => {
    if (rows.length === 1) render(validate(rows[0].content));
  }).catch(() => { document.querySelector('#content-status').hidden = false; });

  if (!config.turnstileSiteKey || location.protocol === 'file:') return;
  const form = document.querySelector('#contact-form');
  const submit = form.querySelector('button[type=submit]');
  const status = document.querySelector('#form-status');
  let token = ''; let widgetId; let sending = false;
  form.hidden = false;
  function clearToken() { token = ''; submit.disabled = true; }
  window.onPortfolioTurnstileLoad = () => {
    widgetId = window.turnstile.render('#turnstile-widget', {
      sitekey: config.turnstileSiteKey, action: 'contact', theme: 'light',
      callback: value => { token = value; submit.disabled = sending; },
      'expired-callback': clearToken,
      'error-callback': () => { clearToken(); status.textContent = 'Verification could not load. Try again later or use email.'; }
    });
  };
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onPortfolioTurnstileLoad&render=explicit';
  script.async = true;
  script.onerror = () => { status.textContent = 'Verification is unavailable. Please use email instead.'; };
  document.head.append(script);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity() || !token || sending) return;
    sending = true; submit.disabled = true; status.textContent = 'Sending your message…';
    const fields = new FormData(form);
    try {
      const response = await fetch(`${config.supabaseUrl}/functions/v1/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.supabasePublishableKey },
        body: JSON.stringify({ name: fields.get('name'), email: fields.get('email'), message: fields.get('message'), website: fields.get('website'), consent: fields.get('consent') === 'on', token }),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error(response.status === 429 ? 'Please wait before sending another message.' : 'Your message could not be saved. Try again or use email.');
      form.reset(); status.textContent = 'Thank you. Your message has been saved for Julianne.';
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'The request timed out. Please try again or use email.' : error.message;
    } finally {
      sending = false; clearToken();
      if (widgetId !== undefined) window.turnstile.reset(widgetId);
    }
  });
})();
