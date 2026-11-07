/* Google Tag Manager, which sends to GA4 (G-FHPT21Y31F). It loads after the page so it never competes
   with the hero, and only on the live site, so local testing doesn't pollute the numbers (add ?gtm to
   load it locally). Events go to the data layer; the tags that use them live in Tag Manager.
   Never put what a visitor typed in an event. WhatsApp links carry their question or brief in the
   URL, so whatsapp_click sends only where the click came from. */
(() => {
  const ID = 'GTM-TCNQ8QDS';
  const dl = (window.dataLayer = window.dataLayer || []);
  const live = /(^|\.)hasannawaz\.com$/.test(location.hostname) || /[?&](gtm|gtm_debug)\b/.test(location.search);

  /* Consent, with no banner: for visitors in Europe (judged from the browser's time zone, so approximate)
     analytics stays off unless they turn it on from the privacy page. Everyone else can turn it off there. */
  const KEY = 'hn-consent';
  const saved = () => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  };
  const store = (v) => {
    try { localStorage.setItem(KEY, v); } catch {}
  };
  const zone = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const europe = /^Europe\/|^Atlantic\/(Reykjavik|Canary|Faroe|Madeira|Azores)/.test(zone);
  function gtag() { dl.push(arguments); }

  let loaded = false;
  const load = () => {
    if (loaded || !live) return;
    loaded = true;
    gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    dl.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${ID}`;
    document.head.append(s);
  };
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(load, { timeout: 3000 }) : setTimeout(load, 1500));

  const isOn = () => saved() === 'yes' || (!europe && saved() !== 'no');
  if (document.readyState === 'complete') { if (isOn()) later(); }
  else window.addEventListener('load', () => { if (isOn()) later(); });

  // the switch on the privacy page
  const paint = (b) => { b.textContent = isOn() ? 'Turn analytics off' : 'Turn analytics on'; };
  const toggle = document.querySelector('[data-consent-toggle]');
  if (toggle) {
    paint(toggle);
    toggle.addEventListener('click', () => {
      store(isOn() ? 'no' : 'yes');
      paint(toggle);
      if (isOn()) load();
    });
  }

  const PLACES = [
    ['.yalla', 'yalla'], ['.plan', 'pricing_plan'], ['#pricing', 'pricing'], ['.menu', 'menu'], ['.contact', 'footer'],
    ['#services', 'services'], ['#process', 'how_i_work'], ['#faq', 'faq'], ['.art-cta', 'article_aside'],
    ['.nav-cta', 'nav'],
  ];
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href*="wa.me"]');
    if (!link) return;
    const place = PLACES.find(([sel]) => link.closest(sel));
    const plan = link.closest('.plan');
    dl.push({
      event: 'whatsapp_click',
      cta_location: place ? place[1] : 'other',
      plan_name: plan ? plan.querySelector('.plan-name').textContent : undefined,
    });
  });
})();
