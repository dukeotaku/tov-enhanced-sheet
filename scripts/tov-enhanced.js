Hooks.on("renderApplicationV2", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;

  const sheet = root.closest?.(".application.sheet.black-flag.actor.pc") ?? root;
  if (!sheet.matches?.(".application.sheet.black-flag.actor.pc")) return;

  // Give the existing Black Flag tabs clear icons without replacing its tab logic.
  const icons = {
    main: "fa-solid fa-gear",
    spellcasting: "fa-solid fa-bolt",
    inventory: "fa-solid fa-box",
    features: "fa-solid fa-list",
    biography: "fa-solid fa-book",
    effects: "fa-solid fa-star"
  };
  for (const tab of sheet.querySelectorAll(".sheet-navigation [data-tab]")) {
    const key = tab.dataset.tab;
    if (!icons[key]) continue;
    tab.dataset.tovLabel = tab.textContent.trim();
    let icon = tab.querySelector(":scope > i.tov-tab-icon");
    if (!icon) {
      icon = document.createElement("i");
      icon.className = `tov-tab-icon ${icons[key]}`;
      icon.setAttribute("aria-hidden", "true");
      tab.prepend(icon);
    }
    tab.title ||= tab.dataset.tovLabel;
  }

  // Persistent character rail: clone live Black Flag controls rather than
  // reimplementing actor updates/roll handlers.
  if (sheet.querySelector(".tov-static-panel")) return;
  const body = sheet.querySelector(".sheet-body");
  if (!body) return;

  const panel = document.createElement("aside");
  panel.className = "tov-static-panel";
  panel.innerHTML = `
    <section class="tov-portrait-slot"></section>
    <section class="tov-static-stats">
      <section class="tov-static-primary"></section>
      <section class="tov-static-vitals"></section>
      <section class="tov-static-health"></section>
    </section>
    <section class="tov-favorites">
      <h3><i class="fa-solid fa-bookmark" aria-hidden="true"></i> Favorites</h3>
      <div class="tov-favorites-empty">Favorites coming next</div>
    </section>`;

  body.before(panel);

  // Collapse control for the Portrait Static Panel.
  const collapse = document.createElement("button");
  collapse.type = "button";
  collapse.className = "tov-static-collapse";
  collapse.title = "Collapse Portrait Static Panel";
  collapse.setAttribute("aria-label", "Collapse Portrait Static Panel");
  collapse.innerHTML = '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>';
  panel.append(collapse);

  const setCollapsed = collapsed => {
    sheet.classList.toggle("tov-static-collapsed", collapsed);
    collapse.title = collapsed ? "Expand Portrait Static Panel" : "Collapse Portrait Static Panel";
    collapse.setAttribute("aria-label", collapse.title);
    collapse.innerHTML = collapsed
      ? '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>';
  };

  setCollapsed(false);
  collapse.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    setCollapsed(!sheet.classList.contains("tov-static-collapsed"));
  });

  const portrait = sheet.querySelector(".sheet-header .profile");
  if (portrait) {
    const copy = portrait.cloneNode(true);
    copy.classList.add("tov-static-portrait");
    panel.querySelector(".tov-portrait-slot").append(copy);
  }

  // Build the Portrait Static Panel from Black Flag's live Main-tab values.
  // Main remains authoritative for now; this checkpoint is about locking layout.
  const primary = panel.querySelector(".tov-static-primary");
  const vitals = panel.querySelector(".tov-static-vitals");
  const health = panel.querySelector(".tov-static-health");

  const mirror = (selector, label, target, extraClass = "") => {
    const source = sheet.querySelector(`.sheet-body ${selector}`);
    if (!source) return null;
    const card = document.createElement("section");
    card.className = `tov-static-card ${extraClass}`.trim();
    card.dataset.source = selector;
    card.innerHTML = `<h3>${label}</h3><div class="tov-static-card-content">${source.innerHTML}</div>`;
    target.append(card);
    return card;
  };

  mirror(".armor-class", "Armor Class", primary, "tov-ac-card");
  mirror(".luck", "Luck", primary, "tov-luck-card");
  mirror(".initiative", "Initiative", vitals, "tov-initiative-card");

  const prof = document.createElement("section");
  prof.className = "tov-static-card tov-prof-card";
  const profValue = sheet.querySelector(".sheet-header .proficiency-bonus span")?.textContent?.trim() ?? "—";
  prof.innerHTML = `<h3>Proficiency</h3><div class="tov-big-value">${profValue}</div>`;
  vitals.append(prof);

  const traits = sheet.querySelector(".sheet-body .traits");
  const speed = traits ? [...traits.querySelectorAll(".trait")].find(el => /speed/i.test(el.textContent)) : null;
  if (speed) {
    const card = document.createElement("section");
    card.className = "tov-static-card tov-speed-card";
    const value = speed.querySelector(":scope > span:last-child")?.textContent?.trim() ?? speed.textContent.trim();
    card.innerHTML = `<h3>Speed</h3><div class="tov-big-value">${value.replace(/^Speed\s*/i, "")}</div>`;
    vitals.append(card);
  }

  const hp = mirror(".hit-points", "Hit Points", health, "tov-hp-card");
  if (hp) {
    const dice = hp.querySelector(".hit-dice");
    if (dice) {
      const hd = document.createElement("section");
      hd.className = "tov-static-card tov-hd-card";
      hd.innerHTML = `<h3>Hit Dice</h3><div class="tov-static-card-content">${dice.outerHTML}</div>`;
      health.append(hd);
      dice.remove();
    }
  }

  sheet.classList.add("tov-enhanced-ready");
});
