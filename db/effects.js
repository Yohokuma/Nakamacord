// db/effects.js
const { EmbedBuilder } = require("discord.js");

/**
 * Internal per-side state layout:
 * side._fx = {
 *   // transform boosts
 *   boosted: false,
 *   boostAtk: 0,
 *   boostHpMax: 0,
 *
 *   // evasion
 *   dodgeCharges: 0,         // discrete dodges
 *   dodgeChance: 0,          // 0..1 chance to dodge while form is active
 *   dodgeChanceName: null,   // label (e.g., "Jet Evasion")
 *
 *   // stuns & fails
 *   frozenTurns: 0,          // 1-turn stun
 *   knockedTurns: 0,         // 1-turn stun
 *   failChancePersistent: 0, // 0..1 (e.g., bleed 0.30 whole fight)
 *   failChanceNext: 0,       // 0..1 (e.g., frozen 0.30 next attempt only)
 *
 *   // vulnerability
 *   vulnNext30: false,       // +30% next hit (e.g., knockout)
 *   vulnFromId: null,        // attacker id that armed the vuln (PvP guard)
 *
 *   // DoTs
 *   bleed: false,            // 10% hpMax per turn
 *   poison: false,           // 20% hpMax per turn
 *   burn: false,             // 15% hpMax per turn
 *
 *   // Electrified (new)
 *   electrified: false,      // 10% hpMax per turn + 30% chance to paralyze (1 turn)
 *   electrifiedPct: 10,      // default 10%
 *   electroStunChance: 0.30, // default 30%
 * };
 */

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function pct(x) {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 0;
  if (x <= 1) return x;
  if (x <= 100) return x / 100;
  return 1;
}

function ensureEffectState(side) {
  if (!side._fx) {
    side._fx = {
      boosted: false,
      boostAtk: 0,
      boostHpMax: 0,

      dodgeCharges: 0,
      dodgeChance: 0,
      dodgeChanceName: null,

      frozenTurns: 0,
      knockedTurns: 0,
      failChancePersistent: 0,
      failChanceNext: 0,

      vulnNext30: false,
      vulnFromId: null,

      bleed: false,
      poison: false,
      burn: false,

      // Electrified defaults
      electrified: false,
      electrifiedPct: 10,
      electroStunChance: 0.30,
    };
  }
  return side._fx;
}

/** =================== Evasion =================== */
/**
 * Check order:
 * 1) Ken (kenCharges)
 * 2) Discrete evasion charges (_fx.dodgeCharges)
 * 3) Evasion chance (_fx.dodgeChance) e.g., Jet Evasion
 */
function tryDodge(side) {
  ensureEffectState(side);
  if (side.kenCharges && side.kenCharges > 0) {
    side.kenCharges--;
    return { dodged: true, source: "Kenbunshoku" };
  }
  if (side._fx.dodgeCharges && side._fx.dodgeCharges > 0) {
    side._fx.dodgeCharges--;
    return { dodged: true, source: "Passive" };
  }
  if (side._fx.dodgeChance > 0 && Math.random() < side._fx.dodgeChance) {
    return { dodged: true, source: side._fx.dodgeChanceName || "Evasion" };
  }
  return { dodged: false, source: null };
}

/** =================== Outgoing damage mods =================== */
/**
 * Apply +30% if defender is flagged as vulnerable (knockout → next hit).
 * If PvP-scoped, check attacker id.
 * Clears vulnerability after use.
 */
function applyOutgoingDamageModifiers(att, def, dmg) {
  ensureEffectState(def);
  if (def._fx.vulnNext30) {
    const guard = !def._fx.vulnFromId || def._fx.vulnFromId === att.id;
    if (guard) {
      dmg = Math.floor(dmg * 1.3);
      def._fx.vulnNext30 = false;
      def._fx.vulnFromId = null;
    }
  }
  return Math.max(0, dmg);
}

/** =================== DoTs & turn ticks =================== */
/**
 * Apply DoTs at the beginning of `side`'s turn.
 * Returns a summary for UI.
 */
function startOfTurnDOT(side, message) {
  ensureEffectState(side);
  const out = {
    bleed: 0,
    poison: 0,
    burn: 0,
    electrified: 0,
    total: 0,
    dead: false,
  };

  if (!side.hp || side.hp <= 0) return out;

  const applyTick = (percent) => Math.floor(side.hpMax * pct(percent));

  if (side._fx.bleed) {
    out.bleed = applyTick(10);
    side.hp = Math.max(0, side.hp - out.bleed);
    out.total += out.bleed;
  }
  if (side._fx.poison) {
    out.poison = applyTick(20);
    side.hp = Math.max(0, side.hp - out.poison);
    out.total += out.poison;
  }
  if (side._fx.burn) {
    out.burn = applyTick(15);
    side.hp = Math.max(0, side.hp - out.burn);
    out.total += out.burn;
  }
  // Electrified tick + 30% chance to paralyze (1 turn)
  if (side._fx.electrified) {
    const p = Number.isFinite(side._fx.electrifiedPct) ? side._fx.electrifiedPct : 10;
    out.electrified = applyTick(p);
    side.hp = Math.max(0, side.hp - out.electrified);
    out.total += out.electrified;

    const parChance = pct(side._fx.electroStunChance ?? 0.30);
    if (Math.random() < parChance) {
      side._fx.frozenTurns = Math.max(side._fx.frozenTurns, 1);
    }
  }

  if (out.total > 0 && message) {
    const lines = [];
    if (out.bleed) lines.push(`🩸 **Bleed**: -${out.bleed} HP`);
    if (out.poison) lines.push(`☠️ **Poison**: -${out.poison} HP`);
    if (out.burn) lines.push(`🔥 **Burn**: -${out.burn} HP`);
    if (out.electrified) lines.push(`⚡ **Electrified**: -${out.electrified} HP`);
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle("⏳ Damage over Time")
        .setDescription(lines.join("\n"))
        .setColor(0xaa0000)],
    }).catch(() => {});
  }

  if (side.hp <= 0) out.dead = true;
  return out;
}

/**
 * Returns whether the player is stunned (frozen/knocked).
 * Does not consume a turn here; call `consumeStunTurn(side)` afterwards if needed.
 */
function isStunned(side) {
  ensureEffectState(side);
  return (side._fx.frozenTurns > 0) || (side._fx.knockedTurns > 0);
}

function consumeStunTurn(side) {
  ensureEffectState(side);
  if (side._fx.frozenTurns > 0) side._fx.frozenTurns--;
  else if (side._fx.knockedTurns > 0) side._fx.knockedTurns--;
}

/**
 * Whether a skill attempt should fail due to debuffs:
 * - failChancePersistent (e.g., bleed 30% ALWAYS while active)
 * - failChanceNext (e.g., frozen 30% NEXT attempt — consumed)
 */
function willFailSkill(side) {
  ensureEffectState(side);
  const pPersistent = side._fx.failChancePersistent || 0;
  const pNext = side._fx.failChanceNext || 0;
  let fail = false;

  if (pPersistent > 0 && Math.random() < pPersistent) {
    fail = true;
  } else if (pNext > 0 && Math.random() < pNext) {
    fail = true;
  }

  // consume "next" regardless
  side._fx.failChanceNext = 0;
  return fail;
}

/** =================== Apply statuses (on hit) =================== */
/**
 * applyStatus(att, def, name, options)
 * name: 'bleed' | 'poison' | 'burn' | 'frozen' | 'knocked' | 'electrified'
 * options:
 *  - chance: 0..100 or 0..1
 *  - stunTurns: for frozen/knocked (default 1)
 *  - persistentFailChance: 0..100 or 0..1 (bleed → 30%)
 *  - nextFailChance: 0..100 or 0..1 (frozen → 30% next attempt)
 *  - vulnNext30: boolean (knocked → true)
 *  - fromId: attacker id (for PvP guard on vuln)
 *  - pct: % HP per turn (for electrified) default 10
 *  - paralyzeChance: 0..100 or 0..1 (for electrified) default 30%
 */
function applyStatus(att, def, name, options = {}, message) {
  ensureEffectState(def);
  const roll = pct(options.chance ?? 1);
  if (Math.random() > roll) return false; // did not apply

  switch (name) {
    case "bleed": {
      def._fx.bleed = true;
      const p = pct(options.persistentFailChance ?? 0.3);
      def._fx.failChancePersistent = Math.max(def._fx.failChancePersistent, p);
      if (message) {
        message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("🩸 Bleed inflicted")
          .setDescription("Lose 10% HP per turn. 30% chance your skill fails (persistent).")
          .setColor(0xcc1133)]}).catch(()=>{});
      }
      return true;
    }
    case "poison": {
      def._fx.poison = true;
      if (message) {
        message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("☠️ Poisoned")
          .setDescription("Lose 20% HP per turn.")
          .setColor(0x3fbb3f)]}).catch(()=>{});
      }
      return true;
    }
    case "burn": {
      def._fx.burn = true;
      if (message) {
        message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("🔥 Burned")
          .setDescription("Lose 15% HP per turn.")
          .setColor(0xff6600)]}).catch(()=>{});
      }
      return true;
    }
    case "frozen": {
      const st = Math.max(1, options.stunTurns ?? 1);
      def._fx.frozenTurns = Math.max(def._fx.frozenTurns, st);
      const pNext = pct(options.nextFailChance ?? 0.3);
      def._fx.failChanceNext = Math.max(def._fx.failChanceNext, pNext);
      if (message) {
        message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("❄️ Frozen")
          .setDescription(`Stunned for ${st} turn(s). 30% chance your next skill fails.`)
          .setColor(0x66ccff)]}).catch(()=>{});
      }
      return true;
    }
    case "knocked": {
      const st = Math.max(1, options.stunTurns ?? 1);
      def._fx.knockedTurns = Math.max(def._fx.knockedTurns, st);
      if (options.vulnNext30) {
        def._fx.vulnNext30 = true;
        def._fx.vulnFromId = att?.id || null;
      }
      if (message) {
        message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("💫 Knocked")
          .setDescription(`Stunned for ${st} turn(s). Next hit against you deals +30% damage.`)
          .setColor(0xff99cc)]}).catch(()=>{});
      }
      return true;
    }
    case "electrified": {
      def._fx.electrified = true;
      if (Number.isFinite(options.pct)) def._fx.electrifiedPct = options.pct;
      if (options.paralyzeChance != null) def._fx.electroStunChance = pct(options.paralyzeChance);
      if (message) {
        message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("⚡ Electrified")
          .setDescription(`Lose ${def._fx.electrifiedPct}% HP per turn. ${Math.round((def._fx.electroStunChance||0)*100)}% chance to be paralyzed each turn.`)
          .setColor(0x3498db)]}).catch(()=>{});
      }
      return true;
    }
    default:
      return false;
  }
}

/** =================== Transform boosts & passives =================== */
/**
 * If item has `transformBoosts`:
 *  { form: 'gear2', atkPercent: 20, hpPercent: 10 }
 * apply when the corresponding form activates.
 * Only once per active form (flagged via _fx.boosted).
 */
function applyTransformBoosts(side, transformSkill, message) {
  ensureEffectState(side);
  const item = side.item || {};
  const boosts = Array.isArray(item.transformBoosts) ? item.transformBoosts : [];
  const form = transformSkill?.form || side.form;
  if (!form || !boosts.length) return;

  for (const b of boosts) {
    if (b.form !== form) continue;

    if (!side._fx.boosted) side._fx.boosted = true;

    // ATK
    const addAtk = Math.floor(side.atk * pct(b.atkPercent || 0));
    if (addAtk > 0) {
      side.atk += addAtk;
      side._fx.boostAtk += addAtk;
    }

    // HP Max / current HP
    const addHpMax = Math.floor(side.hpMax * pct(b.hpPercent || 0));
    if (addHpMax > 0) {
      side.hpMax += addHpMax;
      side._fx.boostHpMax += addHpMax;
      side.hp = clamp(side.hp + addHpMax, 0, side.hpMax);
    }

    if (message && (addAtk > 0 || addHpMax > 0)) {
      const lines = [];
      if (addAtk > 0) lines.push(`⚔️ +${b.atkPercent || 0}% Attack`);
      if (addHpMax > 0) lines.push(`❤️ +${b.hpPercent || 0}% HP`);
      message.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle("📈 Transformation Boost")
          .setDescription(lines.join("\n"))
          .setColor(0xff77aa)],
      }).catch(()=>{});
    }
  }
}

/**
 * Clear boosts and evasion chance when form ends.
 */
function endTransformBoosts(side) {
  ensureEffectState(side);

  if (side._fx.boostAtk) {
    side.atk = Math.max(1, side.atk - side._fx.boostAtk);
    side._fx.boostAtk = 0;
  }

  if (side._fx.boostHpMax) {
    side.hpMax = Math.max(1, side.hpMax - side._fx.boostHpMax);
    side.hp = clamp(side.hp, 0, side.hpMax);
    side._fx.boostHpMax = 0;
  }

  side._fx.boosted = false;

  side._fx.dodgeChance = 0;
  side._fx.dodgeChanceName = null;
}

/**
 * Passives that trigger on transform. On item:
 * passives: [
 *   { type: "dodgeOnForm", form: "gear2", charges: 1, name: "Evasion" },
 *   { type: "dodgeChanceOnForm", form: "gear2", chance: 10, name: "Jet Evasion" }
 * ]
 */
function applyPassivesOnTransform(side, tSkill, item, message) {
  ensureEffectState(side);
  const list = Array.isArray(item?.passives) ? item.passives : [];
  const nowForm = tSkill?.form || side.form;
  if (!nowForm || !list.length) return;

  for (const p of list) {
    if (p.type === "dodgeOnForm" && p.form === nowForm) {
      const add = Number.isFinite(p.charges) ? Math.max(0, Math.floor(p.charges)) : 1;
      side._fx.dodgeCharges += add;
      if (message) {
        message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("🌀 Passive Ready")
          .setDescription(`${p.name || "Evasion"}: ${add} charge(s)`)
          .setColor(0x00ffcc)]}).catch(()=>{});
      }
    }
    if (p.type === "dodgeChanceOnForm" && p.form === nowForm) {
      side._fx.dodgeChance = pct(p.chance || 0);
      side._fx.dodgeChanceName = p.name || "Evasion";
      if (message) {
        message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("🌀 Passive Ready")
          .setDescription(`${side._fx.dodgeChanceName}: ${(p.chance || 0)}% chance to dodge`)
          .setColor(0x00ffcc)]}).catch(()=>{});
      }
    }
  }
}

/** =================== Helpers (e.g., HIE) =================== */
function applyHieOnHit(att, def, skillName, message) {
  const name = (skillName || "").toLowerCase();

  if (name.includes("ice age")) {
    applyStatus(att, def, "frozen", { chance: 1, stunTurns: 1, nextFailChance: 0.30 }, message);
    return;
  }
  if (name.includes("pheasant")) {
    applyStatus(att, def, "frozen", { chance: 0.30, stunTurns: 1, nextFailChance: 0.30 }, message);
    return;
  }
  if (name.includes("partisan")) {
    return;
  }
  if (name.includes("ice ball")) {
    applyStatus(att, def, "frozen", { chance: 0.10, stunTurns: 1, nextFailChance: 0.30 }, message);
    return;
  }
  if (name.includes("ice time")) {
    applyStatus(att, def, "frozen", { chance: 0.20, stunTurns: 1, nextFailChance: 0.30 }, message);
    return;
  }
}

/** =================== End-of-turn cleanup =================== */
function endOfTurnCleanup(_side) {
  // reserved for single-turn flags if needed later
}

module.exports = {
  ensureEffectState,

  tryDodge,
  applyOutgoingDamageModifiers,

  startOfTurnDOT,
  isStunned,
  consumeStunTurn,
  willFailSkill,

  applyStatus,
  applyHieOnHit,

  applyTransformBoosts,
  endTransformBoosts,
  applyPassivesOnTransform,

  endOfTurnCleanup,
};
