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
    <section class="tov-static-stats"></section>
    <section class="tov-favorites">
      <h3><i class="fa-solid fa-bookmark" aria-hidden="true"></i> Favorites</h3>
      <div class="tov-favorites-empty">Favorites coming next</div>
    </section>`;

  body.before(panel);

  const portrait = sheet.querySelector(".sheet-header .profile");
  if (portrait) {
    const copy = portrait.cloneNode(true);
    copy.classList.add("tov-static-portrait");
    panel.querySelector(".tov-portrait-slot").append(copy);
  }

  // These are display mirrors for the first sidebar checkpoint. The original
  // Black Flag controls remain authoritative and functional in Main.
  const statTarget = panel.querySelector(".tov-static-stats");
  const statSources = [
    [".armor-class", "Armor Class"],
    [".luck", "Luck"],
    [".hit-points", "Hit Points"],
    [".initiative", "Initiative"]
  ];
  for (const [selector, label] of statSources) {
    const source = sheet.querySelector(`.sheet-body ${selector}`);
    if (!source) continue;
    const card = document.createElement("section");
    card.className = "tov-static-card";
    card.dataset.source = selector;
    card.innerHTML = `<h3>${label}</h3><div class="tov-static-card-content">${source.innerHTML}</div>`;
    statTarget.append(card);
  }

  const traits = sheet.querySelector(".sheet-body .traits");
  if (traits) {
    const speed = [...traits.querySelectorAll(".trait")].find(el => /speed/i.test(el.textContent));
    if (speed) {
      const card = document.createElement("section");
      card.className = "tov-static-card tov-speed-card";
      card.innerHTML = `<h3>Speed</h3><div class="tov-static-card-content">${speed.innerHTML}</div>`;
      statTarget.append(card);
    }
  }

  sheet.classList.add("tov-enhanced-ready");
});
