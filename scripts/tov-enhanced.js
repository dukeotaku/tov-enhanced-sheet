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
    if (originalProgression) {
      // Replace Black Flag's intrusive badge with a status color on its native action icon.
      const progressionLegend = originalProgression.querySelector("legend");
      const hasProgressionNotice = Boolean(progressionLegend?.querySelector("*"));
      if (progressionLegend) progressionLegend.textContent = "PROGRESSION";
      const actionIcon = originalProgression.querySelector('[data-action="toggleProgression"] .icon');
      if (actionIcon) {
        actionIcon.classList.toggle("tov-progression-notice", hasProgressionNotice);
        actionIcon.title = hasProgressionNotice ? "Character progression needs attention" : "Open character progression";
      }
      controls.append(originalProgression);
    }
    // Show XP in play mode, matching the 5e reference; only for XP leveling.
    // Display only: native Black Flag progression remains responsible for XP editing.
    const xpMode = game.settings.get(game.system.id, "levelingMode") === "xp";
    const xp = progression?.xp;
    if (xpMode && xp) {
      const xpDisplay = document.createElement("div");
      xpDisplay.className = "tov-header-play-xp";
      xpDisplay.setAttribute("role", "group");
      xpDisplay.setAttribute("aria-label", "Experience points");
      const xpValues = document.createElement("span");
      xpValues.className = "tov-header-play-xp-values";
      const xpTrack = document.createElement("div");
      xpTrack.className = "tov-header-play-xp-track";
      xpTrack.setAttribute("role", "progressbar");
      const xpFill = document.createElement("span");
      xpTrack.append(xpFill);
      const refreshXP = () => {
        const current = actorForHeader.system?.progression?.xp;
        if (!current) return;
        const value = Number(current.value) || 0;
        const max = Number(current.max) || 0;
        const min = Number(current.min) || 0;
        const percentage = Math.max(0, Math.min(100,
          Number.isFinite(Number(current.percentage)) ? Number(current.percentage) :
          (max > min ? (value - min) / (max - min) * 100 : 0)));
        xpValues.textContent = value.toLocaleString() + " / " + max.toLocaleString();
        xpFill.style.width = percentage + "%";
        xpTrack.setAttribute("aria-valuenow", String(value));
        xpTrack.setAttribute("aria-valuemin", String(min));
        xpTrack.setAttribute("aria-valuemax", String(max));
      };
      refreshXP();
      const xpHook = Hooks.on("updateActor", updated => {
        if (updated.id === actorForHeader.id && xpDisplay.isConnected) refreshXP();
        else if (!xpDisplay.isConnected) Hooks.off("updateActor", xpHook);
      });
      xpDisplay.append(xpValues, xpTrack);
      right.append(xpDisplay);
    }
    right.append(level, controls);
    top.append(left, right);
    // Six abilities stay visible on every tab and use Black Flag's own roll action.
    const abilities = document.createElement("div");
    abilities.className = "tov-header-abilities";
    for (const [key, label] of [
      ["strength", "STR"], ["dexterity", "DEX"], ["constitution", "CON"],
      ["intelligence", "INT"], ["wisdom", "WIS"], ["charisma", "CHA"]
    ]) {
      const data = actorForHeader.system?.abilities?.[key];
      const tile = document.createElement("div");
      tile.className = "tov-header-ability";
      const title = document.createElement("span");
      title.className = "tov-header-ability-label";
      title.textContent = label;
      const roll = document.createElement("button");
      roll.type = "button";
      roll.className = "tov-header-ability-roll";
      roll.dataset.action = "roll";
      roll.dataset.subAction = "ability-check";
      roll.dataset.ability = key;
      roll.title = label + " ability check";
      const modifier = Number(data?.mod);
      roll.textContent = Number.isFinite(modifier) ? (modifier >= 0 ? "+" : "") + modifier : "—";
      const score = document.createElement("span");
      score.className = "tov-header-ability-score";
      score.textContent = data?.value ?? data?.base ?? "—";
      tile.append(title, roll, score);
      abilities.append(tile);
    }
    shell.append(top, abilities);
    nativeHeader.append(shell);
    // Preserve the switch through Black Flag's first unlock/re-render.
    const initialEditing = app._tovHeaderEditing ?? (sheet.dataset.tovHeaderEditing === "true");
    if (initialEditing) {
      shell.classList.add("tov-header-editing");
      toggle.setAttribute("aria-checked", "true");
      toggle.title = "Hide character progression";
    }
    toggle.addEventListener("click", event => {
      // This custom control is not a native Black Flag sheet action.
      event.preventDefault();
      event.stopPropagation();
      const editing = shell.classList.toggle("tov-header-editing");
      app._tovHeaderEditing = editing;
      sheet.dataset.tovHeaderEditing = String(editing);
      toggle.setAttribute("aria-checked", String(editing));
      toggle.title = editing ? "Hide character progression" : "Show character progression";
    });
    sheet.dataset.tovHeaderEditing = String(Boolean(initialEditing));
    sheet.classList.add("tov-header-prototype");
  }

  // Black Flag re-renders the Main part when returning from progression.
  // Reapply our layout even when the persistent portrait rail already exists.
  const body = sheet.querySelector(".sheet-body");
  if (body) {
    // Main tab: native Skills and native Saving Throw controls in two columns.
    // Reparenting retains Black Flag's delegated roll and configuration actions.
    const mainTab = body.querySelector('.tab[data-tab="main"]');
    if (mainTab && !mainTab.querySelector(".tov-main-layout")) {
      const nativeSkills = mainTab.querySelector("fieldset.skills");
      const nativeAbilities = mainTab.querySelector("fieldset.abilities");
      if (nativeSkills && nativeAbilities) {
        const layout = document.createElement("div");
        layout.className = "tov-main-layout";
        const skillsColumn = document.createElement("section");
        skillsColumn.className = "tov-main-skills";
        const detailsColumn = document.createElement("section");
        detailsColumn.className = "tov-main-details";
        skillsColumn.append(nativeSkills);

        const saves = document.createElement("fieldset");
        saves.className = "tov-main-saves";
        const saveLegend = document.createElement("legend");
        saveLegend.textContent = "Saving Throws";
        saves.append(saveLegend);
        const names = {
          strength: "Strength", dexterity: "Dexterity", constitution: "Constitution",
          intelligence: "Intelligence", wisdom: "Wisdom", charisma: "Charisma"
        };
        for (const [key, name] of Object.entries(names)) {
          const source = nativeAbilities.querySelector('.ability[data-key="' + key + '"]');
          const selector = source?.querySelector(".ability-save .proficiency-selector");
          const button = source?.querySelector(".ability-save button");
          if (!button) continue;
          const row = document.createElement("div");
          row.className = "tov-main-save-row";
          if (selector) row.append(selector);
          const label = document.createElement("span");
          label.textContent = name;
          row.append(label, button);
          saves.append(row);
        }
        detailsColumn.append(saves);

        const actorMain = app.actor ?? app.document;
        const progressionMain = actorMain?.system?.progression;
        const namedItem = kind => {
          const items = actorMain?.items ? Array.from(actorMain.items) : [];
          return items.find(item => item.type === kind)?.name ?? "";
        };
        const info = [
          ["Lineage", progressionMain?.lineage?.name || namedItem("lineage")],
          ["Heritage", progressionMain?.heritage?.name || namedItem("heritage")],
          ["Background", progressionMain?.background?.name || namedItem("background")]
        ];
        const nativeTraits = mainTab.querySelector("fieldset.traits");
        const traitRows = [...(nativeTraits?.querySelectorAll(".trait") ?? [])];
        const traitValue = keyword => traitRows
          .filter(row => new RegExp(keyword, "i").test(row.querySelector("label")?.textContent ?? ""))
          .map(row => row.querySelector(":scope > span")?.textContent?.trim() ?? "")
          .filter(Boolean).join(", ");
        info.push(
          ["Senses", traitValue("sense|vision")],
          ["Armor", traitValue("armor")],
          ["Weapons", traitValue("weapon")],
          ["Languages", traitValue("language")]
        );
        for (const [title, value] of info) {
          const section = document.createElement("fieldset");
          section.className = "tov-main-info tov-main-info-" + title.toLowerCase();
          const legend = document.createElement("legend");
          legend.textContent = title;
          const proficiencyIcons = { Senses: "fa-eye", Armor: "fa-shield-halved", Weapons: "fa-swords", Languages: "fa-flag" };
          if (proficiencyIcons[title]) {
            const icon = document.createElement("i");
            icon.className = "fa-solid " + (title === "Weapons" ? "fa-hand-fist" : proficiencyIcons[title]);
            icon.setAttribute("aria-hidden", "true");
            legend.prepend(icon);
          }
          const content = document.createElement("div");
          content.className = "tov-main-info-value";
          if (["Lineage", "Heritage", "Background"].includes(title)) {
            const item = [...(actorMain?.items ?? [])].find(entry =>
              entry.name === value || entry.type === title.toLowerCase());
            section.classList.add("tov-main-identity-card");
            if (item?.img) {
              const img = document.createElement("img");
              img.className = "tov-main-identity-art";
              img.src = item.img;
              img.alt = "";
              content.append(img);
            }
            const identity = document.createElement("span");
            identity.className = "tov-main-identity-label";
            identity.textContent = value || "—";
            content.append(identity);
          } else {
            section.classList.add("tov-main-proficiency-section");
            const values = (value || "").split(/,\s*/).map(v => v.trim()).filter(Boolean);
            for (const entry of values.length ? values : ["—"]) {
              const chip = document.createElement("span");
              chip.className = "tov-main-chip";
              chip.textContent = entry;
              content.append(chip);
            }
          }
          section.append(legend, content);
          detailsColumn.append(section);
        }
        layout.append(skillsColumn, detailsColumn);
        mainTab.prepend(layout);
        mainTab.classList.add("tov-main-reorganized");
      }
    }


  }

  // Persistent character rail: clone live Black Flag controls rather than
  // reimplementing actor updates/roll handlers.
  if (sheet.querySelector(".tov-static-panel")) return;
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
  // Mount handle outside the scrolling portrait panel so it stays visible.\n  panel.parentElement.append(collapse);

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
      <div class="tov-exhaustion tov-exhaustion-left" role="group" aria-label="Exhaustion levels 1 through 3">
        ${[1,2,3].map(n => `<button type="button" class="tov-exhaustion-pip" data-exhaustion-level="${n}" aria-label="Set exhaustion level ${n}" title="Exhaustion ${n}"></button>`).join("")}
      </div>
      <div class="tov-ac-medallion" title="Armor Class">
        <span class="tov-ac-value">${acValue}</span>
        
      </div>
      <div class="tov-exhaustion tov-exhaustion-right" role="group" aria-label="Exhaustion levels 4 through 6">
        ${[4,5,6].map(n => `<button type="button" class="tov-exhaustion-pip" data-exhaustion-level="${n}" aria-label="Set exhaustion level ${n}" title="Exhaustion ${n}"></button>`).join("")}
      </div>
    </div>`;

  // Native Black Flag exhaustion: write its actor attribute so system effects
  // and automation stay authoritative. Click the active level again to clear.
  const exhaustionActor = actorForHeader;
  // Tales of the Valiant exhaustion ladder: cumulative detriments.
  // Native Black Flag applies its own effect/roll notes; descriptions do not
  // imply that movement, HP maximum, or death are automatically enforced.
  const exhaustionDetriments = [
    "Disadvantage on ability checks",
    "Speed halved",
    "Disadvantage on attack rolls and saving throws",
    "Hit point maximum halved",
    "Speed reduced to 0",
    "Death"
  ];
  const exhaustionPips = [...primary.querySelectorAll("[data-exhaustion-level]")];
  let displayedExhaustion = Math.max(0, Math.min(6, Number(exhaustionActor.system?.attributes?.exhaustion) || 0));
  let exhaustionPending = false;
  const paintExhaustion = level => {
    for (const pip of exhaustionPips) {
      const n = Number(pip.dataset.exhaustionLevel);
      pip.classList.toggle("filled", n <= level);
      pip.setAttribute("aria-pressed", String(n === level));
      pip.disabled = !exhaustionActor.isOwner || exhaustionPending;
      pip.title = `Exhaustion ${n} — ${exhaustionDetriments[n - 1]}${n > 1 ? "\\nCumulative: all lower-level effects also apply." : ""}`;
    }
  };
  paintExhaustion(displayedExhaustion);
  for (const pip of exhaustionPips) pip.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    if (!exhaustionActor.isOwner || exhaustionPending) return;
    const selected = Number(pip.dataset.exhaustionLevel);
    const previous = displayedExhaustion;
    const next = previous === selected ? 0 : selected;
    // Paint immediately; the native actor update/effect synchronization runs afterward.
    displayedExhaustion = next;
    exhaustionPending = true;
    paintExhaustion(next);
    try {
      await exhaustionActor.update({ "system.attributes.exhaustion": next });
      // Black Flag synchronizes its Exhaustion ActiveEffect asynchronously.
      // Reading prepared actor data here can still return the OLD effect level,
      // which made the pip flash off and require a second click.
      // Keep the requested level painted; the next native render reads the effect.
      displayedExhaustion = next;
    } catch (error) {
      displayedExhaustion = Math.max(0, Math.min(6, Number(exhaustionActor.system?.attributes?.exhaustion) || previous));
      console.error("ToV: unable to update native exhaustion", error);
      ui.notifications?.error("Could not update exhaustion.");
    } finally {
      exhaustionPending = false;
      paintExhaustion(displayedExhaustion);
    }
  });

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
        ${Array.from({length:5},(_,i)=>`<button type="button" class="tov-luck-pip ${i < filledLuck ? "filled" : ""}" data-luck-value="${i+1}" aria-label="Set Luck to ${i+1}" title="Luck ${i+1}"></button>`).join("")}
      </div>
    </div>`;
  health.append(luck);
  // Edit the actual Black Flag Luck resource; the native sheet can re-render
  // without losing these controls because they are reconstructed from actor data.
  const resourceActor = app.actor ?? app.document;
  for (const pip of luck.querySelectorAll("[data-luck-value]")) {
    pip.disabled = !resourceActor?.isOwner;
    pip.addEventListener("click", async event => {
      event.preventDefault();
      if (!resourceActor?.isOwner) return;
      const currentLuck = Number(resourceActor.system?.attributes?.luck?.value) || 0;
      const selected = Number(pip.dataset.luckValue);
      const next = selected === currentLuck ? selected - 1 : selected;
      const all = [...luck.querySelectorAll("[data-luck-value]")];
      all.forEach(p => p.classList.toggle("filled", Number(p.dataset.luckValue) <= next));
      try { await resourceActor.update({ "system.attributes.luck.value": next }); }
      catch (error) {
        console.error("ToV Luck update failed", error);
        ui.notifications?.error("Could not update Luck.");
        all.forEach(p => p.classList.toggle("filled", Number(p.dataset.luckValue) <= currentLuck));
      }
    });
  }


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
    // Inline resource editing, saved through native Black Flag actor fields.
    // Click the HP total or TMP number; Enter commits, Escape cancels.
    const editResource = (element, field, initial, maximum) => {
      if (!resourceActor?.isOwner || element.querySelector("input")) return;
      const label = element.querySelector("strong");
      if (!label) return;
      const original = label.textContent;
      const input = document.createElement("input");
      input.type = "number";
      input.className = "tov-inline-resource-input";
      input.min = "0";
      if (Number.isFinite(maximum)) input.max = String(maximum);
      input.value = String(initial);
      input.setAttribute("aria-label", field.includes("temp") ? "Temporary hit points" : "Current hit points");
      label.replaceWith(input);
      input.focus();
      input.select();
      let finished = false;
      const finish = async commit => {
        if (finished) return;
        finished = true;
        if (!commit || !input.value.trim() || !Number.isFinite(Number(input.value))) {
          input.replaceWith(label);
          return;
        }
        const next = Math.max(0, Math.min(Number(input.value), Number.isFinite(maximum) ? maximum : Infinity));
        label.textContent = field.includes("temp") ? String(next) : `${next} / ${max}`;
        input.replaceWith(label);
        try { await resourceActor.update({ [field]: next }); }
        catch (error) {
          console.error("ToV resource update failed", error);
          ui.notifications?.error("Could not update hit points.");
          label.textContent = original;
        }
      };
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") { event.preventDefault(); finish(true); }
        if (event.key === "Escape") { event.preventDefault(); finish(false); }
        event.stopPropagation();
      });
      input.addEventListener("blur", () => finish(true));
    };
    const currentHpControl = hp.querySelector(".tov-hp-main");
    const tempHpControl = hp.querySelector(".tov-temp-main");
    for (const [control, field, value, limit] of [
      [currentHpControl, "system.attributes.hp.value", Number(current), Infinity],
      [tempHpControl, "system.attributes.hp.temp", Number(temp), Infinity]
    ]) {
      control.classList.add("tov-editable-resource");
      control.title = field.includes("temp") ? "Click to edit temporary HP" : "Click to edit current HP";
      control.addEventListener("click", () => editResource(control, field, value, limit));
    }


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
          ? hdRows.map(d => `<strong data-denomination="${d.denom}" data-die-max="${d.max}" data-die-available="${d.available}">${d.available} / ${d.denom}</strong>`).join('<span class="tov-hd-separator">•</span>')
          : '<strong>—</strong>'}
      </div>`;
    health.append(hd);
    // Hit Dice are normally spent/restored by Black Flag features and rests.
    // Manual correction is deliberately an edit, not an accidental die roll.
    for (const display of hd.querySelectorAll("[data-denomination]")) {
      const denomination = display.dataset.denomination;
      display.classList.add("tov-hit-die-action");
      display.title = `Click to correct available d${denomination} hit dice`;
      display.setAttribute("role", "button");
      display.tabIndex = 0;
      if (!resourceActor?.isOwner) {
        display.removeAttribute("role");
        display.tabIndex = -1;
        continue;
      }
      const edit = () => {
        if (display.querySelector("input")) return;
        const previous = Number(resourceActor.system?.attributes?.hd?.d?.[denomination]?.available ?? display.dataset.dieAvailable);
        const maximum = Number(resourceActor.system?.attributes?.hd?.d?.[denomination]?.max ?? display.dataset.dieMax);
        const input = document.createElement("input");
        input.type = "number";
        input.className = "tov-inline-resource-input tov-hit-die-input";
        input.min = "0";
        input.step = "1";
        if (Number.isFinite(maximum)) input.max = String(maximum);
        input.value = String(previous);
        input.setAttribute("aria-label", `Available d${denomination} hit dice`);
        display.replaceChildren(input, document.createTextNode(` / ${denomination}`));
        input.focus();
        input.select();
        let finished = false;
        const finish = async save => {
          if (finished) return;
          finished = true;
          const valid = input.value.trim() !== "" && Number.isInteger(Number(input.value));
          const next = save && valid
            ? Math.max(0, Math.min(Number(input.value), Number.isFinite(maximum) ? maximum : Infinity))
            : previous;
          display.textContent = `${next} / ${denomination}`;
          if (!save || !valid || next === previous) return;
          try {
            await resourceActor.update({ [`system.attributes.hd.d.${denomination}.available`]: next });
            display.dataset.dieAvailable = String(next);
          } catch (error) {
            console.error("ToV hit-die correction failed", error);
            ui.notifications?.error("Could not update hit dice.");
            display.textContent = `${previous} / ${denomination}`;
          }
        };
        input.addEventListener("click", event => event.stopPropagation());
        input.addEventListener("keydown", event => {
          if (event.key === "Enter") { event.preventDefault(); finish(true); }
          if (event.key === "Escape") { event.preventDefault(); finish(false); }
          event.stopPropagation();
        });
        input.addEventListener("blur", () => finish(true));
      };
      display.addEventListener("click", edit);
      display.addEventListener("keydown", event => {
        if (event.target !== display) return;
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); edit(); }
      });
    }

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
        // Match the compact 5e favorite row. The entire item body activates
        // Black Flag's native action, not its item sheet.
        const body = document.createElement("button");
        body.type = "button";
        body.className = "tov-favorite-body";
        body.disabled = !actor.isOwner;
        const label = document.createElement("span");
        label.className = "tov-favorite-label";
        const title = document.createElement("strong");
        title.textContent = item.name;
        const subtitle = document.createElement("small");
        const activities = [...(item.system?.activities?.values?.() ?? [])];
        const activity = activities[0];
        const spell = item.type === "spell";
        const weapon = item.type === "weapon";
        const components = spell ? [...(item.system?.components?.required ?? [])]
          .map(value => String(value).slice(0,1).toUpperCase()).filter(value => "VSM".includes(value)) : [];
        const actionType = spell
          ? String(item.system?.casting?.type ?? item.system?.casting?.activation?.type ?? "Action")
          : "Attack";
        subtitle.textContent = weapon
          ? (item.system?.type?.value === "ranged" ? "Ranged Weapon Attack" : "Melee Weapon Attack")
          : spell ? [components.join(", "), actionType.replace(/^(.)/, letter => letter.toUpperCase())].filter(Boolean).join(" · ")
          : (activity?.name && activity.name !== item.name ? activity.name : (item.system?.type?.value || item.type || ""));
        label.append(title, subtitle);
        const meta = document.createElement("span");
        meta.className = "tov-favorite-meta";
        const nativeRows = () => [...(main?.querySelectorAll('.actions tr[data-item-id]') ?? [])]
          .filter(nativeRow => nativeRow.dataset.itemId === id
            && nativeRow.querySelector('button[data-action="activate"]'));
        const rows = nativeRows();
        const nativeRow = rows[0];
        const challenge = nativeRow?.querySelector(".challenge")?.textContent?.trim();
        const systemRange = item.system?.range;
        const range = weapon
          ? (item.system?.type?.value === "ranged"
            ? [systemRange?.short, systemRange?.long].filter(Number.isFinite).join("/")
            : String(5 + (Number(systemRange?.reach) || 0)))
          : spell && systemRange?.type !== "touch"
            ? (systemRange?.value ? String(systemRange.value) : "")
            : "";
        const unit = systemRange?.unit === "meters" ? "m" : "ft";
        const numericRange = range && !/touch|self/i.test(range) ? range + " " + unit : "";
        if (challenge) {
          const strong = document.createElement("strong");
          strong.textContent = challenge;
          meta.append(strong);
        }
        // A saving-throw spell shows its save attribute and DC rather than
        // mislabeling that number as an attack bonus.
        const saveActivity = activities.find(candidate =>
          candidate?.system?.save?.ability || candidate?.save?.ability);
        if (spell && saveActivity) {
          const save = saveActivity.system?.save ?? saveActivity.save;
          const ability = String(save.ability ?? "").toUpperCase();
          const rawDC = save.dc?.value ?? save.dc;
          const resolvedDC = typeof rawDC === "number" || typeof rawDC === "string"
            ? rawDC : actor.system?.attributes?.spellcasting?.dc;
          const dc = Number(resolvedDC);
          if (ability) {
            const strong = document.createElement("strong");
            strong.textContent = ability;
            meta.replaceChildren(strong);
          }
          if (Number.isFinite(dc) && dc > 0) {
            const small = document.createElement("small");
            small.textContent = String(dc);
            meta.append(small);
          }
        }
        if (numericRange) {
          const small = document.createElement("small");
          small.textContent = numericRange;
          meta.append(small);
        }
        body.append(img, label, meta);
        body.title = "Activate " + item.name;
        body.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          const currentRows = nativeRows();
          // Weapons commonly expose more than one native action (e.g. attack
          // and damage). Select the ATTACK row, never the item sheet.
          const attackRows = currentRows.filter(nativeRow =>
            /attack/i.test(nativeRow.querySelector(".name")?.textContent ?? "")
            || /attack/i.test(nativeRow.querySelector(".control")?.textContent ?? "")
            || /attack/i.test(nativeRow.querySelector('button[data-action="activate"]')?.dataset.tooltip ?? ""));
          const selected = item.type === "weapon"
            ? (attackRows[0] ?? currentRows[0])
            : (currentRows.length === 1 ? currentRows[0] : null);
          if (selected) {
            const button = selected.querySelector('button[data-action="activate"]');
            if (button && !button.disabled) button.click();
          } else if (activity && typeof activity.use === "function") {
            activity.use();
          } else {
            ui.notifications?.warn("No single native action is available for this favorite.");
          }
        });
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
        row.append(body, remove);
        // Native Black Flag hover cards are exposed by its item components.
        // Provide a standalone equivalent for custom sidebar entries.
        const preview = document.createElement("aside");
        preview.className = "tov-favorite-preview";
        preview.setAttribute("role", "tooltip");
        const previewHeading = document.createElement("header");
        const previewImg = img.cloneNode(true);
        const previewName = document.createElement("strong");
        previewName.textContent = item.name;
        previewHeading.append(previewImg, previewName);
        const previewText = document.createElement("div");
        previewText.className = "tov-favorite-preview-text";
        const description = item.system?.description?.value
          ?? item.system?.description ?? "";
        if (typeof description === "string") {
          // Description is already Foundry-authored HTML; do not inject
          // arbitrary markup into a custom hover surface.
          const safe = document.createElement("div");
          safe.innerHTML = description;
          safe.querySelectorAll("script,iframe,object,embed,style").forEach(el => el.remove());
          previewText.textContent = safe.textContent?.trim() || item.type;
        } else previewText.textContent = item.type;
        preview.append(previewHeading, previewText);
        // Sidebar and sheet containers clip overflow. Portal the preview
        // to document.body and position it against the hovered row.
        let previewTimer;
        const hidePreview = () => {
          clearTimeout(previewTimer);
          preview.remove();
        };
        const showPreview = () => {
          if (!row.isConnected) return;
          document.body.append(preview);
          const rect = row.getBoundingClientRect();
          const width = 290;
          // Position outside the LEFT edge of the character sheet, rather
          // than between the portrait and the Main tab.
          const sheetRect = sheet.getBoundingClientRect();
          const left = Math.max(8, Math.min(window.innerWidth - width - 8,
            sheetRect.left - width - 12));
          preview.style.left = left + "px";
          preview.style.top = Math.max(8, Math.min(rect.top, window.innerHeight - Math.min(preview.scrollHeight, 340) - 8)) + "px";
        };
        row.addEventListener("mouseenter", () => {
          clearTimeout(previewTimer);
          previewTimer = setTimeout(showPreview, 400);
        });
        row.addEventListener("mouseleave", hidePreview);
        row.addEventListener("dragstart", hidePreview, { once: true });
        row.addEventListener("dragstart", event => {
          event.dataTransfer.setData("text/plain", JSON.stringify({
            type: "ToVFavorite", itemId: id
          }));
          event.dataTransfer.effectAllowed = "move";
        });
        list.append(row);
      }
      // Keep a visible drop target even when favorites are populated.
      hint.hidden = false;
      hint.textContent = ids.length ? "DROP FAVORITE" : "Drag a weapon, spell, or feature here to pin it.";
    };
    render();
    if (actor.isOwner) {
      favorites.addEventListener("dragover", event => {
        if (!["text/plain", "application/json"].some(type => event.dataTransfer?.types.includes(type))) return;
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
        try {
          // Foundry uses text/plain for document drags; some components also
          // publish application/json. Accept both without requiring either.
          const raw = event.dataTransfer.getData("text/plain")
            || event.dataTransfer.getData("application/json");
          data = JSON.parse(raw);
        } catch (error) {
          console.warn("ToV Favorites: unrecognized drag payload", error);
          return;
        }
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
            // Dragging a compendium/world item is supported only when that
            // item already exists on the character. Do not create duplicates.
            if (!item && found?.name) item = [...actor.items].find(owned =>
              owned.name === found.name && owned.type === found.type);
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
