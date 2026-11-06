/* Google Tag Manager, which sends to GA4 (G-FHPT21Y31F). It loads after the page so it never competes
   with the hero, and only on the live site, so local testing doesn't pollute the numbers (add ?gtm to
   load it locally). Events go to the data layer; the tags that use them live in Tag Manager.
   Never put what a visitor typed in an event. WhatsApp links carry their question or brief in the
   URL, so whatsapp_click sends only where the click came from. */
(() => {
  const ID = 'GTM-KHWQFJGB';
  const dl = (window.dataLayer = window.dataLayer || []);
  const live = /(^|\.)hasannawaz\.com$/.test(location.hostname) || /[?&](gtm|gtm_debug)\b/.test(location.search);

  const load = () => {
    dl.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${ID}`;
    document.head.append(s);
  };
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(load, { timeout: 3000 }) : setTimeout(load, 1500));
  if (live) {
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later);
  }

  const PLACES = [
    ['.yalla', 'yalla'], ['.plan', 'pricing_plan'], ['#pricing', 'pricing'], ['.menu', 'menu'], ['.contact', 'footer'],
    ['#services', 'services'], ['#process', 'how_i_work'], ['#faq', 'faq'], ['.art-cta', 'article_aside'],
    ['.cta-float', 'sticky_button'], ['.nav-cta', 'nav'],
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
