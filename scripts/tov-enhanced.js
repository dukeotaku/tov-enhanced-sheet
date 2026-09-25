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

  // Header prototype on its own branch; the existing v0.1.25 release is untouched.
  // Retain Black Flag's native progression button so its own action handler opens the screen.
  const nativeHeader = sheet.querySelector(".sheet-header");
  const actorForHeader = app.actor ?? app.document;
  if (nativeHeader && actorForHeader && !nativeHeader.querySelector(".tov-header-shell")) {
    const originalName = nativeHeader.querySelector(".document-name");
    const originalProgression = nativeHeader.querySelector(".progression");
    const shell = document.createElement("div");
    shell.className = "tov-header-shell";
    const top = document.createElement("div");
    top.className = "tov-header-top";
    const left = document.createElement("div");
    left.className = "tov-header-identity";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "tov-header-edit-toggle";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", "Show character progression controls");
    toggle.setAttribute("aria-checked", "false");
    toggle.title = "Show character progression";
    toggle.innerHTML = '<span aria-hidden="true"></span>';
    left.append(toggle);
    if (originalName) left.append(originalName);
    const progression = actorForHeader.system?.progression;
    const lineage = progression?.lineage?.name ?? "";
    const classes = progression?.classes ?? {};
    const classText = Object.values(classes).map(entry => {
      const name = entry?.document?.name ?? entry?.name ?? "";
      const levels = entry?.levels?.length ?? entry?.levels ?? entry?.level ?? "";
      return name ? name + (Number.isInteger(levels) ? " " + levels : "") : "";
    }).filter(Boolean).join(" / ");
    const subtitle = document.createElement("div");
    subtitle.className = "tov-header-subtitle";
    subtitle.textContent = [lineage, classText].filter(Boolean).join(" · ");
    left.append(subtitle);
    const right = document.createElement("div");
    right.className = "tov-header-right";
    for (const [type, icon, title] of [
      ["short", "fa-mug-hot", "Short Rest"],
      ["long", "fa-moon", "Long Rest"]
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tov-header-rest";
      button.dataset.action = "rest";
      button.dataset.type = type;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.innerHTML = '<i class="fa-solid ' + icon + '" aria-hidden="true"></i>';
      right.append(button);
    }
    const level = document.createElement("div");
    level.className = "tov-header-level";
    const badge = document.createElement("span");
    badge.className = "tov-header-level-number";
    badge.textContent = progression?.level ?? "—";
    badge.title = "Character Level";
    level.append(badge);
    const controls = document.createElement("div");
    controls.className = "tov-header-progression-controls";
    if (originalProgression) controls.append(originalProgression);
    if (game.settings.get(game.system.id, "levelingMode") === "xp" && progression?.xp) {
      const xp = progression.xp;
      const xpBox = document.createElement("div");
      xpBox.className = "tov-header-xp";
      const current = Number(xp.value) || 0;
      const maximum = Number(xp.max) || 0;
      const percent = Math.max(0, Math.min(100, Number(xp.percentage) || 0));
      xpBox.innerHTML = '<div class="tov-header-xp-values"></div><div class="tov-header-xp-track"><span></span></div>';
      xpBox.querySelector(".tov-header-xp-values").textContent = current.toLocaleString() + " / " + maximum.toLocaleString() + " XP";
      xpBox.querySelector(".tov-header-xp-track span").style.width = percent + "%";
      controls.prepend(xpBox);
    }
    level.append(controls);
    right.append(level);
    top.append(left, right);
    shell.append(top);
    nativeHeader.append(shell);
    toggle.addEventListener("click", () => {
      const editing = shell.classList.toggle("tov-header-editing");
      toggle.setAttribute("aria-checked", String(editing));
      toggle.title = editing ? "Hide character progression" : "Show character progression";
    });
    sheet.classList.add("tov-header-prototype");
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


  // Favorites v1: actor-owned, persistent embedded-item shortcuts.
  // Foundry's native drag data supplies the item UUID; item sheets remain
  // responsible for their own system-specific usage controls.
  const actor = app.actor ?? app.document;
  const favorites = panel.querySelector(".tov-favorites");
  if (actor?.items && favorites) {
    const MODULE = "tov-enhanced-sheet";
    favorites.innerHTML = `
      <h3><i class="fa-solid fa-bookmark" aria-hidden="true"></i> Favorites</h3>
      <ol class="tov-favorite-list" aria-label="Pinned favorites"></ol>
      <p class="tov-favorite-hint">Drag a weapon, spell, or feature here to pin it.</p>`;
    const list = favorites.querySelector(".tov-favorite-list");
    const hint = favorites.querySelector(".tov-favorite-hint");
    let ids = [...new Set(actor.getFlag(MODULE, "favorites") ?? [])]
      .filter(id => actor.items.get(id));
    const save = async () => {
      if (!actor.isOwner) return;
      try { await actor.setFlag(MODULE, "favorites", ids); }
      catch (error) { console.error("ToV Favorites could not save", error); ui.notifications?.error("Could not save Favorites."); }
    };
    const render = () => {
      list.replaceChildren();
      for (const id of ids) {
        const item = actor.items.get(id);
        if (!item) continue;
        const row = document.createElement("li");
        row.className = "tov-favorite-row";
        row.draggable = !!actor.isOwner;
        row.dataset.itemId = id;
        const img = document.createElement("img");
        img.src = item.img || "icons/svg/item-bag.svg";
        img.alt = "";
        const name = document.createElement("button");
        name.type = "button";
        name.className = "tov-favorite-name";
        name.textContent = item.name;
        name.title = "Open " + item.name;
        name.addEventListener("click", () => item.sheet?.render(true));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "tov-favorite-remove";
        remove.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        remove.title = "Unpin " + item.name;
        remove.setAttribute("aria-label", remove.title);
        remove.hidden = !actor.isOwner;
        remove.addEventListener("click", async () => {
          ids = ids.filter(saved => saved !== id);
          render();
          await save();
        });
        row.append(img, name, remove);
        row.addEventListener("dragstart", event => {
          event.dataTransfer.setData("text/plain", JSON.stringify({
            type: "ToVFavorite", itemId: id
          }));
          event.dataTransfer.effectAllowed = "move";
        });
        list.append(row);
      }
      hint.hidden = ids.length > 0;
    };
    render();
    if (actor.isOwner) {
      favorites.addEventListener("dragover", event => {
        if (!event.dataTransfer?.types.includes("text/plain")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        favorites.classList.add("tov-favorites-dragover");
      });
      favorites.addEventListener("dragleave", event => {
        if (!favorites.contains(event.relatedTarget)) favorites.classList.remove("tov-favorites-dragover");
      });
      favorites.addEventListener("drop", async event => {
        event.preventDefault();
        favorites.classList.remove("tov-favorites-dragover");
        let data;
        try { data = JSON.parse(event.dataTransfer.getData("text/plain")); }
        catch { return; }
        if (data?.type === "ToVFavorite") {
          const from = ids.indexOf(data.itemId);
          if (from < 0) return;
          const target = event.target.closest(".tov-favorite-row")?.dataset.itemId;
          const to = target ? ids.indexOf(target) : ids.length - 1;
          ids.splice(from, 1);
          ids.splice(Math.min(Math.max(to, 0), ids.length), 0, data.itemId);
        } else {
          if (data?.type !== "Item") return;
          let item = actor.items.get(data._id ?? data.id);
          if (!item && data.uuid && typeof fromUuid === "function") {
            const found = await fromUuid(data.uuid);
            if (found?.parent?.id === actor.id) item = actor.items.get(found.id);
          }
          if (!item) {
            ui.notifications?.warn("Add the item to this character before pinning it.");
            return;
          }
          if (ids.includes(item.id)) return;
          ids.push(item.id);
        }
        render();
        await save();
      });
    }
  }

  sheet.classList.add("tov-enhanced-ready");
});
