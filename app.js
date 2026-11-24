(() => {
  const STORAGE_KEYS = {
    theme: "ttl_theme",
    fontSize: "ttl_font_size",
    lineHeight: "ttl_line_height",
    lastCh: "ttl_last_chapter",
    readSet: "ttl_read_set",
  };

  let manifest = null;
  let currentChapterNum = null;
  let sortAsc = true;
  let chapterCache = new Map();

  const els = {
    homeView: document.getElementById("home-view"),
    readerView: document.getElementById("reader-view"),
    progress: document.getElementById("reading-progress"),
    brandBtn: document.getElementById("brand-btn"),
    btnToc: document.getElementById("btn-toc"),
    btnLore: document.getElementById("btn-lore"),
    btnSettings: document.getElementById("btn-settings"),
    settingsPopover: document.getElementById("settings-popover"),
    fontDec: document.getElementById("font-dec"),
    fontInc: document.getElementById("font-inc"),
    fontSizeVal: document.getElementById("font-size-val"),
    statChapters: document.getElementById("stat-chapters"),
    statWords: document.getElementById("stat-words"),
    statLatest: document.getElementById("stat-latest"),
    statUpdated: document.getElementById("stat-updated"),
    btnStartRead: document.getElementById("btn-start-read"),
    btnContinueRead: document.getElementById("btn-continue-read"),
    btnLatestRead: document.getElementById("btn-latest-read"),
    tocSearch: document.getElementById("toc-search"),
    tocSort: document.getElementById("toc-sort"),
    tocGroups: document.getElementById("toc-groups"),
    btnBackHome: document.getElementById("btn-back-home"),
    readerActLabel: document.getElementById("reader-act-label"),
    chapterTitle: document.getElementById("chapter-title"),
    chapterWordcount: document.getElementById("chapter-wordcount"),
    chapterReadtime: document.getElementById("chapter-readtime"),
    chapterBody: document.getElementById("chapter-body"),
    btnPrevCh: document.getElementById("btn-prev-ch"),
    btnMidToc: document.getElementById("btn-mid-toc"),
    btnNextCh: document.getElementById("btn-next-ch"),
    backdrop: document.getElementById("drawer-backdrop"),
    drawer: document.getElementById("toc-drawer"),
    drawerClose: document.getElementById("drawer-close"),
    drawerSearch: document.getElementById("drawer-search"),
    drawerList: document.getElementById("drawer-list"),
    loreModal: document.getElementById("lore-modal"),
    loreClose: document.getElementById("lore-close"),
    btnTop: document.getElementById("btn-top"),
  };

  function getReadSet() {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.readSet) || "[]"));
    } catch {
      return new Set();
    }
  }

  function markRead(num) {
    const s = getReadSet();
    s.add(num);
    localStorage.setItem(STORAGE_KEYS.readSet, JSON.stringify([...s]));
    localStorage.setItem(STORAGE_KEYS.lastCh, String(num));
  }

  function applySettings() {
    const theme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
    const fontSize = Number(localStorage.getItem(STORAGE_KEYS.fontSize) || 19);
    const lh = Number(localStorage.getItem(STORAGE_KEYS.lineHeight) || 2.05);

    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.setProperty("--reader-font", `${fontSize}px`);
    document.documentElement.style.setProperty("--reader-lh", String(lh));
    els.fontSizeVal.textContent = `${fontSize}px`;

    document.querySelectorAll("[data-set-theme]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-set-theme") === theme);
    });
    document.querySelectorAll("[data-set-lh]").forEach((b) => {
      b.classList.toggle("active", Number(b.getAttribute("data-set-lh")) === lh);
    });
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString("zh-Hant");
  }

  function renderHome() {
    if (!manifest) return;
    const chs = manifest.chapters || [];
    els.statChapters.textContent = `共 ${chs.length} 章`;
    els.statWords.textContent = `${formatNumber(manifest.total_cjk)} 字`;
    els.statLatest.textContent = chs.length ? `第 ${chs[chs.length - 1].number} 章` : "—";
    els.statUpdated.textContent = manifest.updated_at || "—";

    const lastCh = Number(localStorage.getItem(STORAGE_KEYS.lastCh) || 0);
    if (lastCh > 0 && chs.some((c) => c.number === lastCh)) {
      els.btnContinueRead.textContent = `繼續閱讀（第 ${lastCh} 章）`;
      els.btnContinueRead.classList.remove("hidden");
    } else {
      els.btnContinueRead.classList.add("hidden");
    }

    renderTocGroups();
  }

  function renderTocGroups() {
    if (!manifest) return;
    const q = (els.tocSearch.value || "").trim().toLowerCase();
    const readSet = getReadSet();
    const lastCh = Number(localStorage.getItem(STORAGE_KEYS.lastCh) || 0);

    let list = [...(manifest.chapters || [])];
    if (q) {
      list = list.filter(
        (c) =>
          String(c.number).includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.act || "").toLowerCase().includes(q)
      );
    }
    if (!sortAsc) list.reverse();

    const groups = new Map();
    for (const ch of list) {
      const act = ch.act || "第一卷・北境血衣";
      if (!groups.has(act)) groups.set(act, []);
      groups.get(act).push(ch);
    }

    els.tocGroups.innerHTML = "";
    if (list.length === 0) {
      els.tocGroups.innerHTML = `<p style="color:var(--text-dim);text-align:center;padding:24px;">查無符合條件的章節。</p>`;
      return;
    }

    for (const [actTitle, items] of groups.entries()) {
      const sec = document.createElement("div");
      sec.className = "act-group";
      const totalCjk = items.reduce((a, b) => a + (b.cjk || 0), 0);
      sec.innerHTML = `
        <h3 class="act-group-title">${actTitle}<span>${items.length} 章・${formatNumber(totalCjk)} 字</span></h3>
        <div class="chapter-grid"></div>
      `;
      const grid = sec.querySelector(".chapter-grid");
      for (const ch of items) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chapter-card" + (ch.number === lastCh ? " is-current" : "");
        btn.innerHTML = `
          <div class="ch-card-top">
            <span>第 ${String(ch.number).padStart(3, "0")} 章・${formatNumber(ch.cjk)} 字</span>
            ${readSet.has(ch.number) ? '<span class="read-badge">已讀</span>' : ""}
          </div>
          <div class="ch-card-title">${escapeHtml(ch.short_title || ch.title)}</div>
        `;
        btn.addEventListener("click", () => openChapter(ch.number));
        grid.appendChild(btn);
      }
      els.tocGroups.appendChild(sec);
    }
  }

  function renderDrawerList() {
    if (!manifest) return;
    const q = (els.drawerSearch.value || "").trim().toLowerCase();
    const list = (manifest.chapters || []).filter(
      (c) => !q || String(c.number).includes(q) || c.title.toLowerCase().includes(q)
    );
    els.drawerList.innerHTML = "";
    for (const ch of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "drawer-item" + (ch.number === currentChapterNum ? " active" : "");
      btn.innerHTML = `<span>第 ${ch.number} 章 ${escapeHtml(ch.short_title || "")}</span><small>${formatNumber(ch.cjk)}字</small>`;
      btn.addEventListener("click", () => {
        closeOverlays();
        openChapter(ch.number);
      });
      els.drawerList.appendChild(btn);
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showHome(pushHash = true) {
    currentChapterNum = null;
    els.readerView.classList.add("hidden");
    els.homeView.classList.remove("hidden");
    els.progress.style.width = "0%";
    if (pushHash && location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
    document.title = "《通天錄》線上閱讀｜五國修仙爭霸・百藝神話史詩";
    renderHome();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function openChapter(num, pushHash = true) {
    if (!manifest) return;
    const idx = manifest.chapters.findIndex((c) => c.number === num);
    if (idx === -1) {
      showHome();
      return;
    }
    const meta = manifest.chapters[idx];
    currentChapterNum = num;

    els.homeView.classList.add("hidden");
    els.readerView.classList.remove("hidden");
    els.chapterTitle.textContent = meta.title;
    els.readerActLabel.textContent = meta.act || "第一卷・北境血衣";
    els.chapterWordcount.textContent = `純中文字數：${formatNumber(meta.cjk)} 字`;
    els.chapterReadtime.textContent = `約 ${Math.max(1, Math.round(meta.cjk / 550))} 分鐘閱讀`;
    els.chapterBody.innerHTML = `<p style="text-align:center;text-indent:0;color:var(--text-dim);">章節載入中…</p>`;

    if (pushHash) {
      location.hash = `ch=${num}`;
    }
    document.title = `${meta.title} — 《通天錄》`;

    els.btnPrevCh.disabled = idx <= 0;
    els.btnNextCh.disabled = idx >= manifest.chapters.length - 1;
    els.btnPrevCh.onclick = () => idx > 0 && openChapter(manifest.chapters[idx - 1].number);
    els.btnNextCh.onclick = () =>
      idx < manifest.chapters.length - 1 && openChapter(manifest.chapters[idx + 1].number);

    try {
      let data = chapterCache.get(num);
      if (!data) {
        const res = await fetch(`./data/chapters/${meta.file}?v=${encodeURIComponent(manifest.build_id || "1")}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        chapterCache.set(num, data);
      }
      els.chapterBody.innerHTML = data.html;
      markRead(num);
      window.scrollTo({ top: 0, behavior: "instant" });
      updateScrollProgress();

      // 預載下一章
      if (idx + 1 < manifest.chapters.length) {
        const nextMeta = manifest.chapters[idx + 1];
        if (!chapterCache.has(nextMeta.number)) {
          fetch(`./data/chapters/${nextMeta.file}?v=${encodeURIComponent(manifest.build_id || "1")}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && chapterCache.set(nextMeta.number, d))
            .catch(() => {});
        }
      }
    } catch (err) {
      els.chapterBody.innerHTML = `<p style="text-align:center;text-indent:0;color:var(--seal);">章節載入失敗：${escapeHtml(err.message)}</p>`;
    }
  }

  function closeOverlays() {
    els.backdrop.classList.add("hidden");
    els.drawer.classList.add("hidden");
    els.loreModal.classList.add("hidden");
    els.settingsPopover.classList.add("hidden");
  }

  function updateScrollProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    els.btnTop.classList.toggle("hidden", scrollTop < 360);
    if (currentChapterNum === null) {
      els.progress.style.width = "0%";
      return;
    }
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const pct = maxScroll > 0 ? Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100)) : 0;
    els.progress.style.width = `${pct.toFixed(1)}%`;
  }

  function handleHashRoute() {
    const m = location.hash.match(/ch=(\d+)/);
    if (m) {
      openChapter(Number(m[1]), false);
    } else {
      showHome(false);
    }
  }

  async function init() {
    applySettings();

    // Events
    els.brandBtn.addEventListener("click", () => showHome());
    els.btnBackHome.addEventListener("click", () => showHome());
    els.btnTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    els.btnSettings.addEventListener("click", (e) => {
      e.stopPropagation();
      els.settingsPopover.classList.toggle("hidden");
    });

    document.querySelectorAll("[data-set-theme]").forEach((b) => {
      b.addEventListener("click", () => {
        localStorage.setItem(STORAGE_KEYS.theme, b.getAttribute("data-set-theme"));
        applySettings();
      });
    });
    document.querySelectorAll("[data-set-lh]").forEach((b) => {
      b.addEventListener("click", () => {
        localStorage.setItem(STORAGE_KEYS.lineHeight, b.getAttribute("data-set-lh"));
        applySettings();
      });
    });
    els.fontDec.addEventListener("click", () => {
      const cur = Number(localStorage.getItem(STORAGE_KEYS.fontSize) || 19);
      localStorage.setItem(STORAGE_KEYS.fontSize, String(Math.max(15, cur - 1)));
      applySettings();
    });
    els.fontInc.addEventListener("click", () => {
      const cur = Number(localStorage.getItem(STORAGE_KEYS.fontSize) || 19);
      localStorage.setItem(STORAGE_KEYS.fontSize, String(Math.min(28, cur + 1)));
      applySettings();
    });

    const openDrawer = () => {
      closeOverlays();
      renderDrawerList();
      els.backdrop.classList.remove("hidden");
      els.drawer.classList.remove("hidden");
    };
    els.btnToc.addEventListener("click", openDrawer);
    els.btnMidToc.addEventListener("click", openDrawer);
    els.drawerClose.addEventListener("click", closeOverlays);
    els.drawerSearch.addEventListener("input", renderDrawerList);

    els.btnLore.addEventListener("click", () => {
      closeOverlays();
      els.backdrop.classList.remove("hidden");
      els.loreModal.classList.remove("hidden");
    });
    els.loreClose.addEventListener("click", closeOverlays);
    els.backdrop.addEventListener("click", closeOverlays);

    document.addEventListener("click", (e) => {
      if (!els.settingsPopover.classList.contains("hidden") && !els.settingsPopover.contains(e.target) && e.target !== els.btnSettings) {
        els.settingsPopover.classList.add("hidden");
      }
    });

    els.tocSearch.addEventListener("input", renderTocGroups);
    els.tocSort.addEventListener("click", () => {
      sortAsc = !sortAsc;
      els.tocSort.textContent = sortAsc ? "目前：正序" : "目前：最新優先";
      renderTocGroups();
    });

    els.btnStartRead.addEventListener("click", () => {
      if (manifest && manifest.chapters.length) openChapter(manifest.chapters[0].number);
    });
    els.btnContinueRead.addEventListener("click", () => {
      const last = Number(localStorage.getItem(STORAGE_KEYS.lastCh) || 1);
      openChapter(last);
    });
    els.btnLatestRead.addEventListener("click", () => {
      if (manifest && manifest.chapters.length) {
        openChapter(manifest.chapters[manifest.chapters.length - 1].number);
      }
    });

    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("hashchange", handleHashRoute);
    window.addEventListener("keydown", (e) => {
      if (currentChapterNum === null || !manifest) return;
      if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const idx = manifest.chapters.findIndex((c) => c.number === currentChapterNum);
      if (e.key === "ArrowLeft" && idx > 0) openChapter(manifest.chapters[idx - 1].number);
      if (e.key === "ArrowRight" && idx >= 0 && idx < manifest.chapters.length - 1) {
        openChapter(manifest.chapters[idx + 1].number);
      }
      if (e.key === "Escape") closeOverlays();
    });

    try {
      const res = await fetch(`./data/manifest.json?t=${Date.now()}`);
      manifest = await res.json();
      handleHashRoute();
    } catch (err) {
      els.tocGroups.innerHTML = `<p style="color:var(--seal);text-align:center;">無法載入章節目錄：${escapeHtml(err.message)}</p>`;
    }
  }

  init();
})();
