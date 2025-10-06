const { EmbedBuilder } = require("discord.js");

// utils
const roll = (p) => Math.random() * 100 < (p || 0);

/**
 * Crea una instancia viva del boss a partir del template de misión.
 * Copia hp, cds y banderas.
 */
function buildBossInstance(tpl) {
  const b = {
    name: tpl.name || "Boss",
    hpMax: Math.max(1, tpl.hpMax || 1000),
    hp: Math.max(1, tpl.hpMax || 1000),
    atk: Math.max(1, tpl.atk || 50),
    gif: tpl.gif || null,
    // estados
    frozenTurns: 0,
    knockedTurns: 0,
    bleed: false,  bleedPct: 10,
    poison: false, poisonPct: 20,
    burn: false,   burnPct: 15,
    // NEW: electrified (tickeado al inicio del turno del boss)
    electrified: false, electrifiedPct: 12,

    failNextChance: 0,
    failPermChance: 0,
    // logia/buso
    isLogia: !!tpl.isLogia,
    hasBuso: !!tpl.hasBuso,
    // habilidades
    abilities: Array.isArray(tpl.abilities) ? tpl.abilities.map(a => ({ ...a })) : [],
    _cds: Object.create(null), // { name: turnsLeft }
  };
  return b;
}

/** Baja en 1 los cooldowns > 0 */
function tickBossCooldowns(boss) {
  const cds = boss._cds || {};
  for (const k of Object.keys(cds)) {
    if (cds[k] > 0) cds[k]--;
  }
}

/** Aplica DoTs del boss al empezar su turno. Devuelve daño total y si murió. */
function applyBossStartOfTurnDots(boss) {
  const before = boss.hp;

  if (boss.bleed)  boss.hp = Math.max(0, boss.hp - Math.floor(boss.hpMax * (boss.bleedPct  / 100)));
  if (boss.poison) boss.hp = Math.max(0, boss.hp - Math.floor(boss.hpMax * (boss.poisonPct / 100)));
  if (boss.burn)   boss.hp = Math.max(0, boss.hp - Math.floor(boss.hpMax * (boss.burnPct   / 100)));

  // NEW: electrified tick (si está marcado por skills del jugador)
  if (boss.electrified) {
    const ep = Math.max(0, boss.electrifiedPct || 12);
    boss.hp = Math.max(0, boss.hp - Math.floor(boss.hpMax * (ep / 100)));
  }

  const dot = before - boss.hp;
  return { dot, dead: boss.hp <= 0 };
}

/** Selecciona la acción del boss ponderando basic vs abilities (habilidades sin CD activo) */
function chooseBossAction(boss) {
  const ready = boss.abilities.filter(a => !(boss._cds?.[a.name] > 0));
  // Ponderación simple: basic 50, habilidades 50 repartidos
  const choices = [{ t: "basic", w: 50 }];
  const wAb = ready.length ? Math.floor(50 / ready.length) : 0;
  for (const ab of ready) choices.push({ t: "ability", ab, w: wAb || 0 });

  let total = choices.reduce((acc, c) => acc + c.w, 0) || 1;
  let r = Math.random() * total;
  for (const c of choices) {
    r -= c.w;
    if (r <= 0) {
      if (c.t === "basic") return { action: "basic" };
      return { action: "ability", ability: c.ab };
    }
  }
  return { action: "basic" };
}

/**
 * Ejecuta la acción del boss contra un jugador defensor.
 * Defender esperado: { id, hp, hpMax, immortalTurns, kenCharges, isLogia }
 * Retorna { type, damage?, embed }
 */
function applyBossAbilityOnPlayer(boss, defender, ctx) {
  // Ken / Immortal primero
  if (defender.kenCharges > 0) {
    defender.kenCharges--;
    return {
      type: "dodge",
      embed: new EmbedBuilder()
        .setTitle(`${boss.name} attacks!`)
        .setDescription(`💨 **Dodged by Kenbunshoku!** (${3 - defender.kenCharges}/3)`)
        .setColor(0x00ffcc),
    };
  }
  if (defender.immortalTurns > 0) {
    defender.immortalTurns--;
    return {
      type: "blocked",
      embed: new EmbedBuilder()
        .setTitle(`${boss.name} attacks!`)
        .setDescription(`🛡️ **Immortal!** No damage to <@${defender.id}>.`)
        .setColor(0x00e5ff),
    };
  }

  // Fallos del boss
  if (boss.failNextChance > 0 && roll(boss.failNextChance)) {
    boss.failNextChance = 0;
    return {
      type: "fail",
      embed: new EmbedBuilder()
        .setTitle(`${boss.name} attacks!`)
        .setDescription(`❌ The attack **failed** due to status effect.`)
        .setColor(0x999999),
    };
  }
  if (boss.failPermChance > 0 && roll(boss.failPermChance)) {
    return {
      type: "fail",
      embed: new EmbedBuilder()
        .setTitle(`${boss.name} attacks!`)
        .setDescription(`❌ The attack **failed** due to bleeding.`)
        .setColor(0x999999),
    };
  }

  // Elegir acción
  const pick = chooseBossAction(boss);

  // ---- REGLA LOGIA (defensa del jugador) ----
  const actionUsesBuso = !!(boss.hasBuso || (pick.action === "ability" && pick.ability?.usesBuso));
  const defenderIsLogia = !!defender.isLogia;

  if (defenderIsLogia && !actionUsesBuso && (pick.action === "basic" || (pick.action === "ability" && pick.ability?.type === "damage"))) {
    return {
      type: "logia_block",
      embed: new EmbedBuilder()
        .setTitle(`${boss.name} attacks!`)
        .setDescription(`🌀 **Logia immunity!** No damage to <@${defender.id}>.`)
        .setImage((pick.action === "ability" ? pick.ability?.gif : boss.gif) || null)
        .setColor(0x00a1ff),
    };
  }
  // -------------------------------------------

  if (pick.action === "basic") {
    const base = Math.max(1, Math.floor(boss.atk * (0.9 + Math.random() * 0.3)));
    defender.hp = Math.max(0, defender.hp - base);
    return {
      type: "basic",
      damage: base,
      embed: new EmbedBuilder()
        .setTitle(`🗡️ ${boss.name} — Basic Attack`)
        .setDescription(`<@${defender.id}> takes **${base}** damage. (${defender.hp}/${defender.hpMax})`)
        .setImage(boss.gif || null)
        .setColor(0xe67e22),
    };
  }

  // Habilidad (CD, chance)
  const ab = pick.ability;
  if (ab.cooldown && ab.cooldown > 0) boss._cds[ab.name] = ab.cooldown;
  if (ab.chance && !roll(ab.chance)) {
    return {
      type: "miss",
      embed: new EmbedBuilder()
        .setTitle(`${boss.name} used ${ab.name}!`)
        .setDescription(`❌ The move missed.`)
        .setImage(ab.gif || null)
        .setColor(0x999999),
    };
  }

  if (ab.type === "stun") {
    const turns = Math.max(1, ab.stunTurns || 1);
    defender.stunTurns = (defender.stunTurns || 0) + turns;
    return {
      type: "stun",
      embed: new EmbedBuilder()
        .setTitle(`⚡ ${boss.name} — ${ab.name}`)
        .setDescription(`<@${defender.id}> is **stunned for ${turns} turns**.`)
        .setImage(ab.gif || null)
        .setColor(0xff00aa),
    };
  }

  if (ab.type === "dot") {
    if (ab.bleed)  { defender.bleed = true;  defender.bleedPct  = Math.max(defender.bleedPct  || 0, ab.bleedPct  || 10); }
    if (ab.poison) { defender.poison = true; defender.poisonPct = Math.max(defender.poisonPct || 0, ab.poisonPct || 20); }
    if (ab.burn)   { defender.burn = true;   defender.burnPct   = Math.max(defender.burnPct   || 0, ab.burnPct   || 15); }
    return {
      type: "dot",
      embed: new EmbedBuilder()
        .setTitle(`🔥 ${boss.name} — ${ab.name}`)
        .setDescription(`Over-time effects applied to <@${defender.id}>.`)
        .setImage(ab.gif || null)
        .setColor(0xcc3333),
    };
  }

  if (ab.type === "applyFailNext") {
    boss.failNextChance = Math.max(boss.failNextChance || 0, ab.nextFailChance || 30);
    return {
      type: "failnext",
      embed: new EmbedBuilder()
        .setTitle(`✨ ${boss.name} — ${ab.name}`)
        .setDescription(`Boss's next attack may **fail** (${boss.failNextChance}%).`)
        .setImage(ab.gif || null)
        .setColor(0x8888ff),
    };
  }

  if (ab.type === "damage") {
    let dmg = Math.max(1, Math.floor(boss.atk * (ab.multiplier || 1.2)));
    if (ab.randomFactor) {
      dmg = Math.max(1, Math.floor(dmg * (1 - ab.randomFactor + Math.random() * (2 * ab.randomFactor))));
    }
    defender.hp = Math.max(0, defender.hp - dmg);
    // onHit simples
    if (ab.onHit) {
      if (ab.onHit.knockout) defender.knockedTurns = Math.max(defender.knockedTurns || 0, 1);
      if (ab.onHit.failNextChance) defender.failNextChance = Math.max(defender.failNextChance || 0, ab.onHit.failNextChance);
      if (ab.onHit.stunTurns) defender.stunTurns = (defender.stunTurns || 0) + ab.onHit.stunTurns;
    }

    return {
      type: "damage",
      damage: dmg,
      embed: new EmbedBuilder()
        .setTitle(`💥 ${boss.name} — ${ab.name}`)
        .setDescription(`<@${defender.id}> takes **${dmg}** damage. (${defender.hp}/${defender.hpMax})`)
        .setImage(ab.gif || null)
        .setColor(0xff4500),
    };
  }

  // fallback → basic
  const base = Math.max(1, Math.floor(boss.atk * (0.9 + Math.random() * 0.3)));
  defender.hp = Math.max(0, defender.hp - base);
  return {
    type: "basic",
    damage: base,
    embed: new EmbedBuilder()
      .setTitle(`🗡️ ${boss.name} — Basic Attack`)
      .setDescription(`<@${defender.id}> takes **${base}** damage. (${defender.hp}/${defender.hpMax})`)
      .setImage(boss.gif || null)
      .setColor(0xe67e22),
  };
}

module.exports = {
  buildBossInstance,
  tickBossCooldowns,
  applyBossStartOfTurnDots,
  chooseBossAction,
  applyBossAbilityOnPlayer,
};
