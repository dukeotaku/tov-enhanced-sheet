/* Optional weapon effects on native Black Flag attack cards. */
(() => {
const descriptions = {
 bash:"On a hit, the target has disadvantage on its next attack roll.",
 disarm:"On a hit, the target chooses STR or DEX save. On failure, it drops a wielded weapon, shield, or object into a free space within 5 feet, or at its feet.",
 hamstring:"On a hit, reduce base speed by 10 feet for 1 minute (non-stacking). WIS (Medicine) against option DC, or any magical healing, ends it.",
 pinningShot:"Large or smaller target: on a hit, target chooses STR or DEX save. On failure, speed is 0 until end of its next turn. A creature can use its action for STR (Athletics) or DEX (Acrobatics) against option DC to free it.",
 pull:"Large or smaller target: on a hit, pull up to 5 feet closer. If this moves it into damaging terrain, it may choose STR or DEX save to avoid the pull.",
 ricochetShot:"Target visible behind half or three-quarters cover and within 10 feet of a separate object or structure: ignore cover AC bonus. On a hit, deal normal weapon damage and expend normal ammunition.",
 trip:"Large or smaller target: on a hit, target chooses STR or DEX save. On failure, it falls prone; mounted targets have advantage."
};
const saveKeys = new Set(["disarm","pinningShot","pull","trip"]);
const label = k => ({pinningShot:"Pinning Shot",ricochetShot:"Ricochet Shot"}[k] ?? k[0].toUpperCase()+k.slice(1));
const numeric = x => x != null && x !== "" && Number.isFinite(Number(x)) ? Number(x) : null;
const ability = (actor,k) => {
 const a=actor?.system?.abilities?.[k];
 if(!a)return null;
 for(const x of [a.mod,a.modifier,a.bonus]) {const n=numeric(x);if(n!==null)return n;}
 const score=numeric(a.value);return score===null?null:Math.floor((score-10)/2);
};
const proficiency = actor => {
 const s=actor?.system;
 for(const x of [s?.attributes?.proficiency,s?.attributes?.prof,s?.proficiency?.bonus,s?.proficiencyBonus]){
  const n=numeric(x?.total ?? x);if(n!==null&&n>0)return n;
 }
 const level=numeric(s?.progression?.level ?? s?.details?.level ?? s?.level);
 return level>0?Math.ceil(level/4)+1:null;
};
const directSaveKeys = ["disarm", "pinningShot", "trip"];
const escapeHTML = value => String(value).replace(/&/g, "&amp;")
 .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const saveOption = activity => {
 if (activity?.item?.type !== "weapon" || activity.type !== "attack") return null;
 return directSaveKeys.find(key => {
  const config = CONFIG.BlackFlag?.weaponOptions?.[key];
  const localized = config?.label ? game.i18n.localize(config.label) : "";
  return [key, label(key), localized].filter(Boolean)
   .some(name => normalize(name) === normalize(activity.name));
 }) ?? null;
};
const saveDetails = activity => {
 const key = saveOption(activity);
 if (!key) return null;
 const actor = activity.actor ?? activity.item.actor;
 const pb = proficiency(actor);
 const dcs = pb === null ? [] : ["strength", "dexterity"].flatMap(id => {
  const mod = ability(actor, id);
  return mod === null ? [] : [{ ability: id, dc: 8 + pb + mod }];
 });
 return { key, dc: dcs.length ? Math.max(...dcs.map(entry => entry.dc)) : null };
};
// Lock the higher attacker STR/DEX DC when the attack is rolled.
Hooks.on("blackFlag.preRollAttack", (config, dialog, message) => {
 const details = saveDetails(config.subject);
 if (!details) return;
 message.data ??= {};
 message.data.flags ??= {};
 message.data.flags["tov-enhanced-sheet"] ??= {};
 message.data.flags["tov-enhanced-sheet"].weaponSave = details;
});
async function promptWeaponSave(message, details, event) {
 // A defender can select their token; a GM can target the affected token.
 const targeted = [...(game.user.targets ?? [])];
 const tokens = targeted.length ? targeted : [...(canvas.tokens?.controlled ?? [])];
 const eligible = tokens.filter(token => token.actor
  && (game.user.isGM || token.actor.isOwner)
  && typeof token.actor.rollAbilitySave === "function");
 if (!eligible.length) {
  ui.notifications?.warn("Target a token you can roll for, or select your own token. The GM can roll for other targets.");
  return;
 }
 // Older attack messages stored both DC candidates; use their higher value too.
 const dc = numeric(details.dc) ?? Math.max(...(details.dcs ?? [])
  .map(entry => numeric(entry.dc)).filter(value => value !== null));
 if (!Number.isFinite(dc)) {
  ui.notifications?.warn("Cannot determine this weapon option's save DC from its attacker.");
  return;
 }
 const content = `<p><strong>Attacker's DC: ${dc}</strong> (8 + proficiency bonus + higher STR/DEX modifier).</p>
  <p>The defender chooses STR or DEX for the saving throw.</p>
  <label>Save for <select name="tov-save-target">${eligible.map((token, index) =>
   `<option value="${index}">${escapeHTML(token.name ?? token.actor.name)}</option>`).join("")}</select></label>
  ${details.key === "trip" ? "<p>Large or smaller targets. Mounted targets have advantage; choose Advantage in the roll window.</p>"
   : details.key === "pinningShot" ? "<p>Large or smaller targets.</p>" : ""}`;
 const selection = await new Promise(resolve => {
  const choose = (html, saveAbility) => {
   const root = html instanceof HTMLElement ? html : html[0];
   resolve({ target: Number(root.querySelector('[name="tov-save-target"]').value),
    saveAbility });
  };
  new Dialog({ title: `${label(details.key)} — Save vs`, content,
   buttons: {
    strength: { label: "STR Save", callback: html => choose(html, "strength") },
    dexterity: { label: "DEX Save", callback: html => choose(html, "dexterity") }
   }, close: () => resolve(null)
  }).render(true);
 });
 if (!selection) return;
 const token = eligible[selection.target];
 if (!token?.actor || !(game.user.isGM || token.actor.isOwner) || !Number.isFinite(dc)) return;
 await token.actor.rollAbilitySave({ ability: selection.saveAbility, target: dc, event }, {}, {
  data: { speaker: ChatMessage.getSpeaker({ actor: token.actor, token: token.document }),
   "flags.black-flag.originatingMessage": message.id }
 });
}
function renderWeaponSave(message, html) {
 const root = html instanceof HTMLElement ? html : html?.[0];
 if (!root || message.getFlag?.("black-flag", "roll.type") !== "attack"
  || root.querySelector(".tov-weapon-save")) return;
 const details = message.getFlag("tov-enhanced-sheet", "weaponSave")
  ?? saveDetails(message.getAssociatedActivity?.());
 if (!details || !directSaveKeys.includes(details.key)) return;
 const content = root.querySelector(".message-content");
 if (!content) return;
 const button = document.createElement("button");
 button.type = "button";
 button.className = "light-button tov-weapon-save";
 button.textContent = "Save vs — STR / DEX";
 button.title = `${label(details.key)}: defender chooses Strength or Dexterity`;
 button.addEventListener("click", async event => {
  event.preventDefault(); event.stopImmediatePropagation();
  if (button.disabled) return;
  button.disabled = true;
  try { await promptWeaponSave(message, details, event); }
  catch (error) {
   console.error("ToV weapon option save", error);
   ui.notifications?.error("Unable to roll weapon option save.");
  } finally { button.disabled = false; }
 });
 content.append(button);
}
Hooks.on("renderChatMessageHTML", renderWeaponSave);
Hooks.on("renderChatMessage", renderWeaponSave);
function render(message,html){
 const root=html instanceof HTMLElement?html:html?.[0];
 if(!root||root.querySelector(".tov-weapon-options"))return;
 const item=message?.getAssociatedItem?.();
 if(item?.type!=="weapon")return;
 const keys=[...(item.system?.options??[])].filter(k=>descriptions[k]);
 if(!keys.length)return;
 const actor=message.getAssociatedActor?.()??item.actor;
 if(!(game.user.isGM||actor?.isOwner||message.author?.id===game.user.id))return;
 const menu=root.querySelector(".chat-card.item ul.menu");
 if(!menu)return;
 const li=document.createElement("li");li.className="tov-weapon-options";
 const or=document.createElement("div");or.className="tov-weapon-or";or.textContent="OR — WEAPON OPTIONS";li.append(or);
 const pb=proficiency(actor),str=ability(actor,"strength"),dex=ability(actor,"dexterity");
 const dcText=pb===null||(str===null&&dex===null)?"DC = 8 + PB + higher attacker STR/DEX modifier":
  "DC "+(8+pb+Math.max(...[str,dex].filter(value=>value!==null)));
 for(const key of keys){
  const wrap=document.createElement("div");wrap.className="tov-option";
  const btn=document.createElement("button");btn.type="button";btn.className="light-button";btn.textContent=label(key);
  btn.title="Post "+label(key)+" effect to chat";
  btn.addEventListener("click",async event=>{
   event.preventDefault();event.stopPropagation();btn.disabled=true;
   try{
    const escape=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const save=saveKeys.has(key)?"<p><strong>Save:</strong> Target chooses STR or DEX. "+escape(dcText)+"</p>":
      key==="hamstring"?"<p>"+escape(dcText)+"</p>":"";
    await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),
      content:"<h3>"+escape(item.name)+" — "+escape(label(key))+"</h3>"+save+"<p>"+escape(descriptions[key])+"</p><p><em>GM adjudicates and applies the effect; no condition is automatically changed.</em></p>"});
   }catch(error){console.error("ToV weapon option",error);ui.notifications?.error("Unable to post weapon option.");}
   finally{btn.disabled=false;}
  });
  wrap.append(btn);li.append(wrap);
 }
 menu.append(li);
}
Hooks.on("renderChatMessageHTML",render);
Hooks.on("renderChatMessage",render);
})();
