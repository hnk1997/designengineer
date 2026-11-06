#!/usr/bin/env python3
"""Builds the Thought leadership articles from Hasan's Medium RSS feed.

Readers never leave the site: every article gets its own page in thoughts/, and the
homepage section (between the "articles" markers in index.html) links only to those.

    curl -sL https://medium.com/feed/@hasannawaz97 -o /tmp/feed.xml
    python3 scripts/build-articles.py /tmp/feed.xml

Article text is used as written. The cleanup only removes Medium extras: the tracking
pixel, embedded images, and the "follow me on LinkedIn" sign-off with its links.
"""
import html
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'thoughts'
FEATURED = 3  # cards on the homepage; the rest are listed as rows

# Short, stable URLs, and each cover's caption. Covers are small looping diagrams of the
# article's idea (markup in COVERS, styles under "Article covers" in styles.css).
ARTICLES = {
    'bd24e88fe184': ('mlp-over-mvp', 'Viable vs lovable'),
    '60e1d267a93f': ('dark-patterns', 'Trick vs trust'),
    'f443dc448bda': ('design-systems', '1 system, every screen'),
    '0129cd3b4b1f': ('accessibility', 'Readable by everyone'),
    '331a0bf365de': ('empty-states', 'The first blank screen'),
    '1c1ccbb4b3ac': ('designing-for-habit', '7 days, 1 habit'),
}

# On Medium but left off the site (user's call)
SKIP = {'4a88e61f8100'}  # When Data Meets Design

# Phrasing elements only: covers sit inside links on the homepage.
UI = '<i class="cv-h"></i><i class="cv-l"></i><i class="cv-l cv-l--s"></i>'
COVERS = {
    # the same screen twice; only the lovable one keeps people (retention bars below)
    'mlp-over-mvp': (
        f'<i class="cv-card ml-a">{UI}<i class="cv-btn cv-btn--mute"></i></i>'
        f'<i class="cv-card ml-b">{UI}<i class="cv-btn"></i><i class="ml-ring"></i></i>'
        '<i class="ml-meter ml-a" style="--to:.3"><b></b></i><i class="ml-meter ml-b" style="--to:.86"><b></b></i>'
        '<i class="cv-tag ml-ta">MVP</i><i class="cv-tag ml-tb">MLP</i>'),
    # a cancel flow, first rigged, then honest
    'dark-patterns': (
        '<i class="cv-card dk-modal">'
        f'<i class="dk-trick">{UI}<i class="dk-box dk-box--on"></i><i class="dk-opt"></i><i class="cv-btn dk-stay"></i><i class="dk-link"></i></i>'
        f'<i class="dk-trust">{UI}<i class="dk-box"></i><i class="dk-opt"></i><i class="dk-eq"></i><i class="dk-eq dk-eq--r"></i></i>'
        '</i><i class="cv-chip dk-chip"><b class="dk-c1">Trick</b><b class="dk-c2">Trust</b></i>'),
    # three components fill screen after screen, faster each time
    'design-systems': (
        '<i class="cv-card ds-kit"><i class="ds-t ds-t--btn"></i><i class="ds-t ds-t--in"></i><i class="ds-t ds-t--card"></i></i>'
        + ''.join(
            f'<i class="cv-card ds-screen" style="left:{30 + 23 * k}%">'
            f'<i class="ds-s ds-s--card" style="--n:{3 * k}"></i><i class="ds-s ds-s--in" style="--n:{3 * k + 1}"></i>'
            f'<i class="ds-s ds-s--btn" style="--n:{3 * k + 2}"></i></i>' for k in range(3))),
    # placeholder becomes a real label; faint text gains contrast; the check passes
    'accessibility': (
        '<i class="cv-card ax-form"><i class="ax-field"></i><i class="ax-label"></i>'
        '<i class="ax-line" style="top:62%"></i><i class="ax-line" style="top:72%;width:62%"></i><i class="ax-line" style="top:82%;width:70%"></i></i>'
        '<i class="cv-card ax-read"><b class="ax-r1">2.1:1</b><b class="ax-r2">7.4:1</b>'
        '<i class="cv-chip ax-pass"><b class="ax-c1">Fail</b><b class="ax-c2">AAA</b></i></i>'),
    # "No reports yet", then a way in, then the reports themselves
    'empty-states': (
        '<i class="cv-card es-frame"><i class="es-top"></i>'
        '<i class="es-a"><b class="es-msg">No reports yet</b></i>'
        '<i class="es-b"><i class="es-art"></i><i class="cv-l es-l1"></i><i class="cv-l es-l2"></i><i class="cv-btn es-btn"></i></i>'
        '<i class="es-c">' + ''.join(f'<i class="es-bar" style="--h:{h};left:{12 + 13 * k}%"></i>' for k, h in enumerate([.42, .6, .5, .74, .66, .92])) + '</i>'
        '</i>'),
    # a streak builds day by day
    'designing-for-habit': (
        '<i class="hb-count"></i>'
        + ''.join(f'<i class="hb-day" style="--n:{k};left:{8 + 12.4 * k}%"><b>{d}</b></i>' for k, d in enumerate('MTWTFSS'))),
}

NS = {'content': 'http://purl.org/rss/1.0/modules/content/'}
# Shown over the cover on hover: the site's own button, sliding up into the corner
READ = ('<span class="post-read" aria-hidden="true"><span class="pill pill--light">Read</span>'
        '<span class="ico"><svg viewBox="0 0 16 16"><path d="M2 8h11M9 4l4 4-4 4"/></svg>'
        '<svg viewBox="0 0 16 16"><path d="M2 8h11M9 4l4 4-4 4"/></svg></span></span>')
ARROW = ('<span class="ico" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M2 8h11M9 4l4 4-4 4"/></svg>'
         '<svg viewBox="0 0 16 16"><path d="M2 8h11M9 4l4 4-4 4"/></svg></span>')


def clean(body):
    body = re.sub(r'<img[^>]*medium\.com/_/stat[^>]*>', '', body)
    body = re.sub(r'<figure>.*?</figure>', '', body, flags=re.S)
    body = re.sub(r'<p>(💡|🔗).*?</p>', '', body, flags=re.S)

    # "Intro:<br> • one<br> • two" paragraphs become a paragraph and a real list
    def bullets(m):
        parts = [p.strip() for p in re.split(r'<br\s*/?>', m.group(1))]
        if sum(p.startswith('•') for p in parts) < 2:
            return m.group(0)
        lead = [p for p in parts if not p.startswith('•')]
        items = [p.lstrip('• ').strip() for p in parts if p.startswith('•')]
        out = ''.join(f'<p>{p}</p>' for p in lead if p)
        return out + '<ul>' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'
    body = re.sub(r'<p>(.*?)</p>', bullets, body, flags=re.S)

    body = re.sub(r'<(/?)h3>', r'<\1h2>', body)  # the page title is the h1
    body = re.sub(r'<br>\s*', '<br>', body)
    # Nothing in an article may send readers elsewhere
    body = re.sub(r'<a [^>]*>(.*?)</a>', r'\1', body, flags=re.S)
    return body.strip()


def text_of(fragment):
    return html.unescape(re.sub(r'<[^>]+>', ' ', fragment))


def load(feed):
    items = []
    for it in ET.parse(feed).getroot().iter('item'):
        post_id = it.findtext('link').split('?')[0].rsplit('-', 1)[-1]
        if post_id in SKIP:
            continue
        if post_id not in ARTICLES:
            sys.exit(f'New article {post_id} ({it.findtext("title")}): add a slug and caption to ARTICLES, and a cover to COVERS.')
        slug, caption = ARTICLES[post_id]
        body = clean(it.findtext('content:encoded', namespaces=NS))
        words = len(text_of(body).split())
        date = parsedate_to_datetime(it.findtext('pubDate'))
        first = re.search(r'<p>(.*?)</p>', body, flags=re.S)
        summary = ' '.join(text_of(first.group(1)).split()) if first else ''
        summary = re.sub(r'\s+([,.;:!?])', r'\1', summary)
        items.append({
            'slug': slug,
            'title': it.findtext('title').strip(),
            'caption': caption,
            'body': body,
            'date': date,
            'when': date.strftime('%b %Y'),
            'iso': date.strftime('%Y-%m-%d'),
            'mins': max(1, math.ceil(words / 230)),
            'summary': summary if len(summary) <= 155 else summary[:152].rsplit(' ', 1)[0] + '…',
        })
    items.sort(key=lambda a: a['date'], reverse=True)
    for i, a in enumerate(items):
        a['fig'] = f'{i + 1:02d}'
        a['tone'] = i % 3 + 1  # cover colourway: blue, rose, orange
    return items


def cover(a, cls, tag='span'):
    """Animated cover; it only plays while on screen (ui.js initBento watches [data-play]).
    A cursor acts out each article's key moment (its path is per cover, in styles.css)."""
    e = html.escape
    return (f'<{tag} class="cover cover--{a["tone"]} {cls}" aria-hidden="true" data-play>'
            f'<span class="cover-stage"><span class="cv cv--{a["slug"]}">{COVERS[a["slug"]]}<i class="cv-cur"></i></span></span>'
            f'<span class="label cover-cap">{e(a["caption"])}</span></{tag}>')


def homepage(items):
    e = html.escape
    pad = ' ' * 6
    cards = []
    for i, a in enumerate(items[:FEATURED]):
        cards.append(
            f'{pad}  <a class="post reveal" style="--d:{0.08 * (i + 1):.2f}s" href="thoughts/{a["slug"]}.html">\n'
            f'{pad}    <span class="post-media">{cover(a, "post-cover")}{READ}</span>\n'
            f'{pad}    <span class="label post-meta"><time datetime="{a["iso"]}">{a["when"]}</time> · {a["mins"]} min read</span>\n'
            f'{pad}    <span class="post-title"><span>{e(a["title"])}</span></span>\n'
            f'{pad}  </a>')
    rows = []
    for a in items[FEATURED:]:
        rows.append(
            f'{pad}  <li data-reveal><a class="post-row reveal" href="thoughts/{a["slug"]}.html" data-roll-host>\n'
            f'{pad}    <span class="label post-row-date"><time datetime="{a["iso"]}">{a["when"]}</time></span>\n'
            f'{pad}    <span class="post-row-title">{e(a["title"])}</span>\n'
            f'{pad}    <span class="label post-row-mins">{a["mins"]} min read</span>\n'
            f'{pad}    {ARROW}\n'
            f'{pad}  </a></li>')
    return (f'<!-- articles:start -->\n'
            f'{pad}<div class="posts" data-reveal>\n' + '\n'.join(cards) + f'\n{pad}</div>\n'
            f'{pad}<p class="label posts-more">More writing</p>\n'
            f'{pad}<ol class="post-list" role="list">\n' + '\n'.join(rows) + f'\n{pad}</ol>\n'
            f'{pad}<!-- articles:end -->')


WA_URL = 'https://wa.me/971547945306?text=Hi%20Hasan%2C%20can%20we%20talk%3F'
WA_GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>'


def site_nav(index):
    """The homepage nav and menu, pointed back at the homepage, on its light bar from the start."""
    start = index.index('<header class="nav" data-nav>')
    end = index.index('<main>')
    nav = index[start:end].rstrip()
    nav = nav.replace('<header class="nav" data-nav>', '<header class="nav on-light" data-nav>')
    nav = nav.replace('href="#top"', 'href="../index.html"')
    nav = re.sub(r'href="#([\w-]+)"', r'href="../index.html#\1"', nav)
    return whatsapp_ctas(nav)


def whatsapp_ctas(nav):
    """Articles lead to WhatsApp, not the homepage's contact section."""
    link = f'href="{WA_URL}" target="_blank" rel="noopener"'
    icon = f'<span class="ico ico--wa" aria-hidden="true">{WA_GLYPH}</span>'
    nav = re.sub(r'(<a class="(?:nav-cta intro|cta-float)"[^>]*?)href="[^"]*"([^>]*>)\s*(<span class="pill pill--light"><span data-roll>)Get in touch(</span></span>)\s*<span class="ico" aria-hidden="true">.*?</span>\s*</a>',
                 lambda m: f'{m[1]}{link}{m[2]}{m[3]}WhatsApp me{m[4]}{icon}</a>', nav, flags=re.S)
    nav = nav.replace('this copy of its Get in touch button stays', 'this copy of its WhatsApp button stays')
    return re.sub(r'<a class="menu-cta" href="[^"]*">Get in touch</a>', f'<a class="menu-cta" {link}>WhatsApp me</a>', nav)


# Quick answers under each article. Plain restatements of what the article says; keep them to it.
FAQS = {
    'accessibility': [
        ('Why does accessibility matter in product design?', 'An inaccessible product silently excludes people: anyone who can’t read low-contrast text, struggles with confusing navigation or relies on a screen reader. Designing for them improves the experience for everyone.'),
        ('What are the easiest accessibility improvements to make?', 'Use strong colour contrast, replace placeholder text with clear labels that stay visible, and keep navigation predictable across the product.'),
        ('Does accessibility limit design?', 'No. It opens doors. The more people who can use your product with ease, the more valuable it becomes.'),
    ],
    'dark-patterns': [
        ('What are dark patterns?', 'Design choices that trick people into doing something they didn’t intend. Examples are subscriptions that are nearly impossible to cancel, pre-checked marketing boxes and confusing button labels.'),
        ('Why do dark patterns backfire?', 'They can lift short-term metrics, but the moment someone feels tricked, the trust is gone. Retention, NPS and referrals only thrive on trust.'),
        ('What should teams do instead?', 'Align business goals with user goals. Make cancelling as clear as signing up, be transparent about pricing, use plain language and give people control of their data.'),
    ],
    'design-systems': [
        ('What is a design system really for?', 'Momentum. It isn’t a set of rules or a Figma file of buttons. It’s a growth tool that makes every team member faster, more aligned and more focused.'),
        ('What does a product lose without a design system?', 'Every new screen starts from scratch. Designers debate spacing, engineers question colours and handoffs turn into long threads, so product growth slows down.'),
        ('How much time can a design system save?', 'On 1 product I worked on, design time on new features dropped by almost 40%, and engineers spent less time clarifying specs.'),
    ],
    'designing-for-habit': [
        ('How do you design a product people come back to?', 'Fit it into their routine. Identify the key moments, reduce friction, reward consistency, build feedback loops, then measure and iterate.'),
        ('Which metrics show a habit is forming?', 'Retention, daily active users and drop-off points. Let them guide your UX tweaks, because even a tiny adjustment can make a difference.'),
        ('How do you encourage habits without being pushy?', 'Keep the guidance subtle. Show progress, offer gentle nudges and small rewards, and keep the experience seamless.'),
    ],
    'empty-states': [
        ('What is an empty state?', 'The screen people see before there’s any data. In a new product, it’s usually the first impression.'),
        ('Why do empty states matter?', 'They set expectations about the product’s value, guide the first meaningful action, and either build momentum or kill it.'),
        ('What makes a good empty state?', 'It shows what the space will look like once it’s active, gives a clear next step and reassures people through tone and microcopy. Think of it as a mini onboarding moment.'),
    ],
    'mlp-over-mvp': [
        ('What is the difference between an MVP and an MLP?', 'An MVP asks what’s the least you can ship that works. A Minimum Lovable Product asks what’s the least you can ship that someone would be glad to use. The scope stays tight and the quality bar goes up.'),
        ('Does lovable mean more features or more polish?', 'No. It means picking the 1 or 2 moments that matter most, making those genuinely good and keeping everything else deliberately small.'),
        ('Why is an MLP the better business bet?', 'Retention is what makes the business work, and people come back to things that felt good. Lovable products also get recommended, which is distribution you didn’t pay for.'),
    ],
}

PLUS = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>'


def faq_list(items):
    e = html.escape
    rows = ''.join(
        f'\n          <details class="faq-item"{" open" if i == 0 else ""}><summary><h3 class="faq-q">{e(q)}</h3>{PLUS}</summary><p class="faq-a">{e(a)}</p></details>'
        for i, (q, a) in enumerate(items))
    return f'''<section class="art-faq" aria-labelledby="art-faq-title">
          <h2 id="art-faq-title">Quick answers</h2>
          <div class="faq-list">{rows}
          </div>
        </section>'''


def schema(a):
    """The article and where it sits, for search engines and AI assistants."""
    url = f'https://hasannawaz.com/thoughts/{a["slug"]}'
    author = {'@type': 'Person', '@id': 'https://hasannawaz.com/#hasan', 'name': 'Hasan Nawaz', 'url': 'https://hasannawaz.com/'}
    data = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'BlogPosting', 'headline': a['title'], 'description': a['summary'], 'url': url,
         'mainEntityOfPage': url, 'image': f'https://hasannawaz.com/assets/og/{a["slug"]}.jpg',
         'datePublished': a['iso'], 'inLanguage': 'en', 'author': author, 'publisher': author},
        {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Hasan Nawaz', 'item': 'https://hasannawaz.com/'},
            {'@type': 'ListItem', 'position': 2, 'name': a['title'], 'item': url}]},
        {'@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': ans}}
            for q, ans in FAQS[a['slug']]]},
    ]}
    return json.dumps(data, ensure_ascii=False).replace('</', '<\\/')


def page(a, nxt, nav):
    e = html.escape
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{e(a["title"])} | Hasan Nawaz</title>
  <meta name="description" content="{e(a["summary"])}">
  <link rel="canonical" href="https://hasannawaz.com/thoughts/{a["slug"]}">
  <meta property="og:url" content="https://hasannawaz.com/thoughts/{a["slug"]}">
  <meta property="og:type" content="article">
  <meta property="article:published_time" content="{a["iso"]}">
  <meta property="og:site_name" content="Hasan Nawaz">
  <meta property="og:title" content="{e(a["title"])} | Hasan Nawaz">
  <meta property="og:description" content="{e(a["summary"])}">
  <!-- each article has its own preview card at assets/og/<slug>.jpg; a new article needs one made -->
  <meta property="og:image" content="https://hasannawaz.com/assets/og/{a["slug"]}.jpg">
  <meta property="og:image:alt" content="{e(a["title"])}, by Hasan Nawaz">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://hasannawaz.com/assets/og/{a["slug"]}.jpg">
  <meta name="theme-color" content="#eceef1">
  <link rel="icon" href="../favicon.ico" sizes="48x48">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
  <script type="application/ld+json">{schema(a)}</script>
  <link rel="stylesheet" href="../styles.css">
  <link rel="preload" href="../assets/fonts/inter-tight-v9-latin.woff2" as="font" type="font/woff2" crossorigin>
</head>
<body class="article-page">
  <!-- Generated by scripts/build-articles.py from the Medium feed. Edit the script, not this file. -->

  {nav}

  <main class="article">
    <header class="art-head">
      <a class="art-back label" href="../index.html#thought-leadership">
        <svg class="art-back-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M14 8H3M7 4L3 8l4 4"/></svg>
        <span>Thought leadership</span>
      </a>
      <div class="art-titles">
        <h1 class="art-title">{e(a["title"])}</h1>
        <p class="label art-meta"><time datetime="{a["iso"]}">{a["when"]}</time> · {a["mins"]} min read</p>
      </div>
    </header>

    {cover(a, "art-cover", "div")}

    <div class="art-body">
      <aside class="art-aside">
        <p class="label art-aside-label">Written by</p>
        <p class="art-author">Hasan Nawaz</p>
        <p class="art-role">Design engineering partner</p>
        <a class="art-cta" href="{WA_URL}" target="_blank" rel="noopener" data-roll-host><span class="pill pill--light"><span data-roll>WhatsApp me</span></span><span class="ico ico--wa" aria-hidden="true">{WA_GLYPH}</span></a>
      </aside>
      <article class="prose">
        {a["body"]}
        {faq_list(FAQS[a["slug"]])}
      </article>
    </div>

    <a class="art-next" href="{nxt["slug"]}.html" data-roll-host>
      <span class="label art-next-label"><span class="sq"></span>Next article</span>
      <span class="art-next-title">{e(nxt["title"])}</span>
      {ARROW}
    </a>
  </main>

  <script src="../js/analytics.js"></script>
  <script src="../js/ui.js"></script>
  <script>window.HC.initRolls(); window.HC.initMenu(); window.HC.initBento(); window.HC.initCtaFloat();</script>
  <!-- WhatsApp, always a thumb away -->
</body>
</html>
'''


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    items = load(sys.argv[1])
    index_path = ROOT / 'index.html'
    index = index_path.read_text()
    nav = site_nav(index)

    OUT.mkdir(exist_ok=True)
    for old in OUT.glob('*.html'):
        old.unlink()
    for i, a in enumerate(items):
        (OUT / f'{a["slug"]}.html').write_text(page(a, items[(i + 1) % len(items)], nav))

    index, n = re.subn(r'<!-- articles:start -->.*?<!-- articles:end -->', lambda _: homepage(items), index, flags=re.S)
    if n != 1:
        sys.exit('index.html needs exactly one <!-- articles:start --> … <!-- articles:end --> block.')
    index_path.write_text(index)
    print(f'{len(items)} articles → thoughts/, homepage updated.')


if __name__ == '__main__':
    main()
