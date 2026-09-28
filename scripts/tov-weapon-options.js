/* v0.1.75: native Black Flag weapon option chat buttons. */
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
 for(const x of [s?.attributes?.prof,s?.attributes?.proficiency,s?.proficiency?.bonus,s?.proficiencyBonus,s?.details?.proficiencyBonus]){
  const n=numeric(x?.total ?? x);if(n!==null&&n>0)return n;
 }
 const level=numeric(s?.details?.level ?? s?.level);
 return level>0?Math.ceil(level/4)+1:null;
};
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
 const pb=proficiency(actor),str=ability(actor,"str"),dex=ability(actor,"dex");
 const dcText=pb===null||(str===null&&dex===null)?"DC = 8 + PB + attacker-chosen STR or DEX modifier":
  [str===null?null:"STR DC "+(8+pb+str),dex===null?null:"DEX DC "+(8+pb+dex)].filter(Boolean).join(" / ");
 for(const key of keys){
  const wrap=document.createElement("div");wrap.className="tov-option";
  const btn=document.createElement("button");btn.type="button";btn.className="light-button";btn.textContent=label(key);
  const detail=document.createElement("div");detail.className="tov-option-detail";detail.hidden=true;
  const text=document.createElement("p");
  text.textContent=saveKeys.has(key)?"Target chooses STR or DEX save. "+dcText:key==="hamstring"?dcText:"Choose instead of normal damage.";
  detail.append(text);
  const apply=document.createElement("button");apply.type="button";apply.className="light-button";apply.textContent="Apply Effect";
  apply.addEventListener("click",async event=>{
   event.stopPropagation();apply.disabled=true;
   try{
    const escape=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const save=saveKeys.has(key)?"<p><strong>Save:</strong> Target chooses STR or DEX. "+escape(dcText)+"</p>":
      key==="hamstring"?"<p>"+escape(dcText)+"</p>":"";
    await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),
      content:"<h3>"+escape(item.name)+" — "+escape(label(key))+"</h3>"+save+"<p>"+escape(descriptions[key])+"</p><p><em>GM adjudicates and applies the effect; no condition is automatically changed.</em></p>"});
   }catch(error){console.error("ToV weapon option",error);ui.notifications?.error("Unable to post weapon option.");}
   finally{apply.disabled=false;}
  });
  btn.addEventListener("click",event=>{event.stopPropagation();detail.hidden=!detail.hidden;btn.setAttribute("aria-expanded",String(!detail.hidden));});
  detail.append(apply);wrap.append(btn,detail);li.append(wrap);
 }
 menu.append(li);
}
Hooks.on("renderChatMessageHTML",render);
Hooks.on("renderChatMessage",render);
})();