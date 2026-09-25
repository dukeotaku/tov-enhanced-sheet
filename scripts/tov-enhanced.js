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

  // Build the compact Portrait Static Panel dashboard.
  const primary = panel.querySelector(".tov-static-primary");
  const vitals = panel.querySelector(".tov-static-vitals");
  const health = panel.querySelector(".tov-static-health");

  const main = sheet.querySelector(".sheet-body");
  const acSource = main?.querySelector(".armor-class");
  const acValue = acSource?.querySelector("input")?.value
    ?? acSource?.querySelector(".value")?.textContent?.trim()
    ?? acSource?.textContent?.match(/\d+/)?.[0]
    ?? "—";

  primary.innerHTML = `
    <div class="tov-core-cluster">
      <div class="tov-exhaustion tov-exhaustion-left" title="Exhaustion">
        <span></span><span></span><span></span>
      </div>
      <div class="tov-ac-medallion" title="Armor Class">
        <span class="tov-ac-value">${acValue}</span>
        
      </div>
      <div class="tov-exhaustion tov-exhaustion-right" title="Exhaustion">
        <span></span><span></span><span></span>
      </div>
    </div>`;

  const initSource = main?.querySelector(".initiative");
  const initValue = initSource?.querySelector("input")?.value
    ?? initSource?.textContent?.match(/[+-]?\d+/)?.[0] ?? "—";
  const profValue = sheet.querySelector(".sheet-header .proficiency-bonus span")?.textContent?.trim() ?? "—";
  const traits = main?.querySelector(".traits");
  const speedSource = traits ? [...traits.querySelectorAll(".trait")].find(el => /speed/i.test(el.textContent)) : null;
  const speedRaw = speedSource?.querySelector(":scope > span:last-child")?.textContent?.trim()
    ?? speedSource?.textContent?.replace(/^.*?Speed\s*/i, "").trim() ?? "—";
  const speedValue = speedRaw.match(/\d+/)?.[0] ?? speedRaw;

  vitals.innerHTML = `
    <div class="tov-vital"><span class="tov-vital-value">${initValue}</span><span class="tov-vital-label">Initiative</span></div>
    <div class="tov-vital tov-vital-speed"><span class="tov-vital-value">${speedValue}</span><span class="tov-vital-label">Speed</span></div>
    <div class="tov-vital"><span class="tov-vital-value">${profValue}</span><span class="tov-vital-label">Proficiency</span></div>`;

  const luckSource = main?.querySelector(".luck");
  let filledLuck = 0;
  if (luckSource) {
    // Black Flag marks spent/owned Luck with .luck-point.selected.
    filledLuck = Math.min(5, luckSource.querySelectorAll(".luck-points .luck-point.selected").length);
  }
  const luck = document.createElement("section");
  luck.className = "tov-luck-feature";
  luck.innerHTML = `
    <div class="tov-luck-title">Luck</div>
    <div class="tov-luck-frame">
      <div class="tov-luck-pips">
        ${Array.from({length:5},(_,i)=>`<span class="${i < filledLuck ? "filled" : ""}"></span>`).join("")}
      </div>
    </div>`;
  health.append(luck);

  const hpSource = main?.querySelector(".hit-points");
  if (hpSource) {
    // Read each HP field by its Black Flag semantic class so temp HP cannot
    // accidentally be mistaken for max HP.
    const current = hpSource.querySelector(".current-hit-points input.value")?.value
      ?? hpSource.querySelector(".current-hit-points .value")?.textContent?.trim()
      ?? "—";
    const max = hpSource.querySelector(".max-hit-points .value")?.textContent?.trim()
      ?? current;
    const temp = hpSource.querySelector(".temp-hit-points input.value")?.value
      ?? hpSource.querySelector(".temp-hit-points .value")?.textContent?.trim()
      ?? "0";

    const hp = document.createElement("section");
    hp.className = "tov-resource tov-hp-resource";
    hp.innerHTML = `
      <div class="tov-resource-label">Hit Points</div>
      <div class="tov-hp-track">
        <div class="tov-hp-main"><strong>${current} / ${max}</strong></div>
        <div class="tov-temp-main"><span>TMP</span><strong>${temp}</strong></div>
      </div>`;
    health.append(hp);

    const diceSource = hpSource.querySelector(".hit-dice");
    // Black Flag exposes each actual Hit Die denomination in the rendered
    // .denomination block (d6, d8, d10, etc.). Read that live source instead
    // of guessing or using a fallback.
    const denominations = [...(diceSource?.querySelectorAll(".denomination") ?? [])];
    const hdRows = denominations.map(row => {
      const denom = row.querySelector(".label")?.textContent?.trim()?.replace(/^d/i, "");
      const available = row.querySelector("input.value")?.value
        ?? row.querySelector(".value")?.textContent?.trim();
      const max = row.querySelector(".max")?.textContent?.trim();
      return { denom, available, max };
    }).filter(d => d.denom && d.available != null && d.max != null);

    const hd = document.createElement("section");
    hd.className = "tov-resource tov-hd-resource";
    hd.innerHTML = `
      <div class="tov-resource-label">Hit Dice</div>
      <div class="tov-hd-track">
        ${hdRows.length
          ? hdRows.map(d => `<strong data-denomination="${d.denom}">${d.available} / ${d.denom}</strong>`).join('<span class="tov-hd-separator">•</span>')
          : '<strong>—</strong>'}
      </div>`;
    health.append(hd);
  }

  // Hidden Death Saves using Black Flag's native component.
  const deathWrap = document.createElement("section");
  deathWrap.className = "tov-death-saves";
  deathWrap.innerHTML = `
    <button type="button" class="tov-death-toggle" aria-expanded="false"
      title="Show Death Saves" aria-label="Show Death Saves">
      <i class="fa-solid fa-skull" aria-hidden="true"></i>
    </button>
    <div class="tov-death-panel" hidden>
      <div class="tov-death-title">Death Saves</div>
      <blackFlag-deathSaves></blackFlag-deathSaves>
    </div>`;
  health.append(deathWrap);

  const deathToggle = deathWrap.querySelector(".tov-death-toggle");
  const deathPanel = deathWrap.querySelector(".tov-death-panel");
  deathToggle.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const open = deathPanel.hasAttribute("hidden");
    deathPanel.toggleAttribute("hidden", !open);
    deathToggle.setAttribute("aria-expanded", String(open));
    deathToggle.title = open ? "Hide Death Saves" : "Show Death Saves";
    deathToggle.setAttribute("aria-label", deathToggle.title);
    deathWrap.classList.toggle("open", open);
  });

  sheet.classList.add("tov-enhanced-ready");
});
