#!/usr/bin/env python3
"""Build search-index.json for StackSmarter (ai-tools-small-biz) from article HTML.

For each article/<slug>.html:
  - title:   text of the first <h1> (fallback: <title>)
  - url:     "articles/<slug>.html"
  - excerpt: first ~160 chars of the first paragraph in .article-body
  - headings: list of h2 heading texts

Writes search-index.json to the site root, then validates that the JSON
parses and every URL resolves to a real local file.
"""
import html
import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
ARTICLES = SITE / "articles"
OUT = SITE / "search-index.json"


def strip_tags(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", strip_tags(s)).strip()


def excerpt_of(p_text: str, limit: int = 160) -> str:
    t = p_text
    if len(t) <= limit:
        return t
    cut = t[:limit].rsplit(" ", 1)[0] or t[:limit]
    return cut + "\u2026"


def main() -> int:
    entries = []
    for f in sorted(ARTICLES.glob("*.html")):
        raw = f.read_text(encoding="utf-8")

        m = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.S)
        if m:
            title = clean_text(m.group(1))
        else:
            m = re.search(r"<title>(.*?)</title>", raw, re.S | re.I)
            title = clean_text(m.group(1)).split(" | ")[0] if m else f.stem

        m = re.search(r'<div class="article-body">', raw)
        body = raw[m.end():] if m else raw

        paras = [clean_text(p) for p in re.findall(r"<p[^>]*>(.*?)</p>", body, re.S)]
        paras = [p for p in paras if p]
        excerpt = excerpt_of(paras[0]) if paras else ""

        headings = [clean_text(h) for h in re.findall(r"<h2[^>]*>(.*?)</h2>", body, re.S)]
        headings = [h for h in headings if h and h.lower() != "faq"]

        entries.append(
            {
                "title": title,
                "url": f"articles/{f.name}",
                "excerpt": excerpt,
                "headings": headings,
            }
        )

    OUT.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} with {len(entries)} entries")

    # ---- VALIDATION ----
    data = json.loads(OUT.read_text(encoding="utf-8"))
    assert isinstance(data, list) and len(data) == 7, f"expected 7 entries, got {len(data)}"
    for e in data:
        assert set(e) == {"title", "url", "excerpt", "headings"}, f"bad keys: {set(e)}"
        assert e["title"] and e["url"] and e["excerpt"], f"empty field in {e['url']}"
        target = SITE / e["url"]
        assert target.is_file(), f"URL does not resolve to a local file: {e['url']}"
    print("VALIDATED: JSON parses; all 7 URLs resolve to real local files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
