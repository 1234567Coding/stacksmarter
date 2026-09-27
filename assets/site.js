/* StackSmarter shared site JS — vanilla, progressive enhancement.
   Every feature degrades gracefully: with JS disabled or failed, the site
   remains fully readable and navigable. */
(function () {
  "use strict";

  var doc = document;

  /* ---------- Mobile nav toggle ---------- */
  (function () {
    var btn = doc.querySelector(".nav-toggle");
    var nav = doc.querySelector(".main-nav");
    if (!btn || !nav) return;
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  })();

  /* ---------- Dark mode toggle (persisted, OS default) ---------- */
  (function () {
    var btn = doc.querySelector(".theme-toggle");
    if (!btn) return;
    var icon = btn.querySelector(".theme-icon");

    function apply(theme) {
      doc.documentElement.setAttribute("data-theme", theme);
      if (icon) icon.textContent = theme === "dark" ? "\u2600" : "\u263E"; /* sun / moon */
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
    function current() {
      return doc.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    }
    apply(current()); /* sync icon with the pre-paint init script */
    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      try { localStorage.setItem("ss-theme", next); } catch (e) { /* ignore */ }
      apply(next);
    });
  })();

  /* ---------- Site search (live dropdown over search-index.json) ---------- */
  (function () {
    var form = doc.querySelector(".site-search");
    var input = doc.querySelector("#site-search-input");
    var list = doc.querySelector("#site-search-results");
    if (!form || !input || !list) return;

    var base = /\/articles\//.test(location.pathname) ? "../" : "./";
    var index = null;

    function hide() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }

    function score(item, q) {
      var t = item.title.toLowerCase(), e = item.excerpt.toLowerCase();
      if (t.indexOf(q) === 0) return 3;
      if (t.indexOf(q) > -1) return 2;
      if (e.indexOf(q) > -1) return 1;
      for (var i = 0; i < item.headings.length; i++) {
        if (item.headings[i].toLowerCase().indexOf(q) > -1) return 1;
      }
      return 0;
    }

    function render(q) {
      q = q.trim().toLowerCase();
      list.innerHTML = "";
      if (!q || q.length < 2 || !index) { hide(); return; }
      var hits = [];
      for (var i = 0; i < index.length; i++) {
        var s = score(index[i], q);
        if (s > 0) hits.push({ item: index[i], s: s });
      }
      hits.sort(function (a, b) { return b.s - a.s; });
      hits = hits.slice(0, 6);
      if (!hits.length) {
        var li = doc.createElement("li");
        li.className = "search-no-results";
        li.textContent = "No articles match \u201C" + q + "\u201D.";
        list.appendChild(li);
      } else {
        hits.forEach(function (h) {
          var li = doc.createElement("li");
          var a = doc.createElement("a");
          a.href = base + h.item.url;
          var strong = doc.createElement("strong");
          strong.textContent = h.item.title;
          var span = doc.createElement("span");
          span.textContent = h.item.excerpt;
          a.appendChild(strong);
          a.appendChild(span);
          li.appendChild(a);
          list.appendChild(li);
        });
      }
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    fetch(base + "search-index.json")
      .then(function (r) { if (!r.ok) throw new Error("no index"); return r.json(); })
      .then(function (data) { index = data; })
      .catch(function () { index = null; /* search box stays, but yields nothing */ });

    var t;
    input.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () { render(input.value); }, 120);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { hide(); input.blur(); }
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    doc.addEventListener("click", function (e) {
      if (!form.contains(e.target)) hide();
    });
  })();

  /* ---------- Article table of contents + scroll-spy ---------- */
  (function () {
    var body = doc.querySelector(".article-body");
    if (!body) return;
    var headings = [];
    body.querySelectorAll("h2, h3").forEach(function (h) {
      if (h.closest(".faq")) return; /* skip FAQ questions */
      headings.push(h);
    });
    if (headings.length < 2) return;

    function slugify(text) {
      return text.toLowerCase().trim()
        .replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-")
        .slice(0, 60) || "section";
    }
    var used = {};
    headings.forEach(function (h) {
      if (!h.id) {
        var base = slugify(h.textContent), id = base, n = 2;
        while (used[id] || doc.getElementById(id)) { id = base + "-" + (n++); }
        used[id] = true;
        h.id = id;
      }
    });

    var nav = doc.createElement("nav");
    nav.className = "toc";
    nav.setAttribute("aria-label", "On this page");
    var title = doc.createElement("p");
    title.className = "toc-title";
    title.textContent = "On this page";
    var ul = doc.createElement("ul");
    var links = [];
    headings.forEach(function (h) {
      var li = doc.createElement("li");
      if (h.tagName === "H3") li.className = "toc-sub";
      var a = doc.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent.trim();
      li.appendChild(a);
      ul.appendChild(li);
      links.push({ a: a, h: h });
    });
    nav.appendChild(title);
    nav.appendChild(ul);
    body.insertBefore(nav, body.firstChild);

    if ("IntersectionObserver" in window) {
      var active = null;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            if (active) active.classList.remove("active");
            var pair = links.filter(function (l) { return l.h === en.target; })[0];
            if (pair) { pair.a.classList.add("active"); active = pair.a; }
          }
        });
      }, { rootMargin: "-80px 0px -70% 0px" });
      headings.forEach(function (h) { obs.observe(h); });
    }
  })();

  /* ---------- Reading progress bar (article pages) ---------- */
  (function () {
    var body = doc.querySelector(".article-body");
    if (!body) return;
    var bar = doc.createElement("div");
    bar.className = "reading-progress";
    bar.setAttribute("aria-hidden", "true");
    var fill = doc.createElement("span");
    bar.appendChild(fill);
    doc.body.appendChild(bar);

    var ticking = false;
    function update() {
      ticking = false;
      var max = doc.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fill.style.width = (p * 100).toFixed(1) + "%";
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  })();

  /* ---------- Sortable comparison tables (article pages) ---------- */
  (function () {
    var tables = doc.querySelectorAll(".article-body table");
    if (!tables.length) return;

    function numVal(text) {
      var m = text.replace(/[$,\s]/g, "").match(/^(-?\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : null;
    }

    tables.forEach(function (table) {
      var thead = table.querySelector("thead");
      if (!thead) return;
      var ths = thead.querySelectorAll("th");
      var dirs = [];
      ths.forEach(function (th, col) {
        dirs[col] = 1;
        var btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "sort-btn";
        btn.title = "Sort by " + th.textContent.trim();
        while (th.firstChild) btn.appendChild(th.firstChild);
        var arrow = doc.createElement("span");
        arrow.className = "sort-arrow";
        arrow.setAttribute("aria-hidden", "true");
        btn.appendChild(arrow);
        th.appendChild(btn);
        btn.addEventListener("click", function () { sortBy(table, col, ths, dirs); });
      });
      table.classList.add("sortable");
    });

    function sortBy(table, col, ths, dirs) {
      var dir = dirs[col] * -1; /* toggle */
      dirs[col] = dir;
      ths.forEach(function (th) { th.removeAttribute("aria-sort"); });
      ths[col].setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");

      var rows = Array.prototype.slice.call(table.querySelectorAll("tbody tr"));
      var numeric = rows.every(function (r) {
        var cell = r.children[col];
        return cell && numVal(cell.textContent) !== null;
      });

      rows.sort(function (a, b) {
        var at = a.children[col] ? a.children[col].textContent.trim() : "";
        var bt = b.children[col] ? b.children[col].textContent.trim() : "";
        var cmp;
        if (numeric) cmp = numVal(at) - numVal(bt);
        else cmp = at.toLowerCase().localeCompare(bt.toLowerCase());
        return cmp * dir;
      });

      var tbody = table.querySelector("tbody");
      rows.forEach(function (r) { tbody.appendChild(r); });
    }
  })();

  /* ---------- FAQ accordions ---------- */
  (function () {
    var items = doc.querySelectorAll(".faq-item");
    if (!items.length) return;
    items.forEach(function (item, i) {
      var h3 = item.querySelector("h3");
      if (!h3) return;
      var panel = doc.createElement("div");
      panel.className = "faq-panel";
      var panelId = "faq-panel-" + i;
      panel.id = panelId;
      var next = h3.nextElementSibling;
      while (next) {
        var cur = next;
        next = next.nextElementSibling;
        panel.appendChild(cur);
      }
      var btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "faq-toggle";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", panelId);
      while (h3.firstChild) btn.appendChild(h3.firstChild);
      h3.appendChild(btn);
      item.appendChild(panel);

      var open = i === 0; /* first question open by default */
      function setOpen(v) {
        btn.setAttribute("aria-expanded", v ? "true" : "false");
        panel.hidden = !v;
        item.classList.toggle("open", v);
      }
      btn.addEventListener("click", function () {
        setOpen(btn.getAttribute("aria-expanded") !== "true");
      });
      setOpen(open);
    });
  })();

  /* ---------- Back-to-top button ---------- */
  (function () {
    var btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "back-to-top";
    btn.setAttribute("aria-label", "Back to top");
    btn.textContent = "\u2191";
    btn.hidden = true;
    doc.body.appendChild(btn);

    var ticking = false;
    function update() {
      ticking = false;
      btn.hidden = window.scrollY < 600;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    update();
  })();
})();
