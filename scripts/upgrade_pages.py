#!/usr/bin/env python3
"""One-time HTML upgrade for StackSmarter pages.

For every page (index.html, disclosure.html, articles/*.html):
  1. Add <meta name="color-scheme"> + inline theme-init script in <head>
     (sets data-theme before first paint; degrades gracefully without JS).
  2. Add dark-mode toggle button + search form to the header nav.
  3. Replace the page-specific inline nav-toggle <script> with a single
     shared assets/site.js (which also owns the nav toggle).
Idempotent: safe to re-run.
"""
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
PAGES = [SITE / "index.html", SITE / "disclosure.html", *sorted((SITE / "articles").glob("*.html"))]

THEME_META = '<meta name="color-scheme" content="light dark">'
THEME_SCRIPT = """<script>
    /* Set theme before first paint; defaults to OS preference. */
    (function () {
      try {
        var t = localStorage.getItem("ss-theme");
        if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", t);
      } catch (e) { /* private mode etc. -> stay light */ }
    })();
  </script>"""

SEARCH_LI = """<li class="nav-search"><form class="site-search" role="search" aria-label="Site search">
            <label class="visually-hidden" for="site-search-input">Search articles</label>
            <input id="site-search-input" type="search" name="q" placeholder="Search articles\u2026" autocomplete="off" aria-expanded="false" aria-controls="site-search-results">
            <ul id="site-search-results" class="search-results" hidden></ul>
          </form></li>"""

THEME_TOGGLE = """<button class="theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">
        <span class="theme-icon" aria-hidden="true">\u263e</span>
      </button>"""

NAV_SCRIPT_RE = re.compile(r'\s*<script>\s*\(function \(\) \{\s*var btn = document\.querySelector\(\'\.nav-toggle\'\);\s*.*?\}\)\(\);\s*</script>', re.S)


def upgrade(path: Path) -> bool:
    raw = path.read_text(encoding="utf-8")
    orig = raw
    in_articles = path.parent.name == "articles"
    prefix = "../" if in_articles else ""

    # 1. color-scheme meta + theme init script after viewport meta
    if 'name="color-scheme"' not in raw:
        raw = raw.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ' + THEME_META,
            1,
        )
    if 'ss-theme' not in raw:
        raw = raw.replace(
            THEME_META,
            THEME_META + "\n  " + THEME_SCRIPT,
            1,
        )

    # 2a. search form as last <li> of .main-nav ul
    if 'class="site-search"' not in raw:
        m = re.search(r'(<nav class="main-nav"[^>]*>\s*<ul>)(.*?)(</ul>\s*</nav>)', raw, re.S)
        assert m, f"main-nav not found in {path}"
        # fix relative prefix inside the li (search form has no links, so nothing to fix)
        raw = raw[: m.start(2)] + m.group(2).rstrip() + "\n          " + SEARCH_LI + "\n        " + raw[m.end(2):]

    # 2b. theme toggle button after nav-toggle
    if 'class="theme-toggle"' not in raw:
        raw = raw.replace(
            '<button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">\u2630</button>',
            '<button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false">\u2630</button>\n      ' + THEME_TOGGLE,
            1,
        )

    # 3. replace inline nav script with shared site.js
    if "assets/site.js" not in raw:
        new_raw, n = NAV_SCRIPT_RE.subn(
            f'\n  <script src="{prefix}assets/site.js" defer></script>', raw
        )
        assert n == 1, f"expected 1 inline nav script in {path}, found {n}"
        raw = new_raw

    if raw != orig:
        path.write_text(raw, encoding="utf-8")
        return True
    return False


def main():
    changed = [str(p) for p in PAGES if upgrade(p)]
    print(f"Upgraded {len(changed)} pages:")
    for c in changed:
        print("  " + c)
    # sanity: every page has the new bits
    for p in PAGES:
        raw = p.read_text(encoding="utf-8")
        for needle in ('class="site-search"', 'class="theme-toggle"', "assets/site.js"):
            assert needle in raw, f"{p} missing {needle}"
        assert "var btn = document.querySelector('.nav-toggle')" not in raw, f"{p} still has inline script"
    print("All 9 pages verified: search box + theme toggle + site.js present, inline script removed.")


if __name__ == "__main__":
    main()
