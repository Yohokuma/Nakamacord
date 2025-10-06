// db/passives.js
// Shared passives (Ope Ope, Nika, reactive on-hit, elementals, etc.)
const { EmbedBuilder } = require("discord.js");
const { ensureEffectState, applyStatus } = require("./effects");

// Helper to pick passives by type
const passivesOf = (side, type) => (side.item?.passives || []).filter(p => p.type === type);

/**
 * Apply start-of-battle passives (call once per side when battle starts):
 * - Ope Ope: ROOM banner (roomOnStart)
 * - Nika: initialize ultimate charge tracker (ultimateChargeOnStart)
 */
async function applyStartPassives(side, message) {
  ensureEffectState(side);

  // Ope Ope — ROOM
  const room = passivesOf(side, "roomOnStart")[0];
  if (room && !side._roomShown) {
    side._roomShown = true;
    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("ROOM")
          .setDescription(`${side.tag} sets up a **Room**.`)
          .setImage(room.gif || null)
          .setColor(0x8e44ad),
      ],
    }).catch(()=>{});
  }

  // Nika — ultimate charge seed
  const ult = passivesOf(side, "ultimateChargeOnStart")[0];
  if (ult && !side._ult) {
    side._ult = {
      name: ult.name || "Bajarang Gun",
      needed: Math.max(1, ult.turns || 15),          // total turns to charge
      requiresForm: ult.requiresForm || "gear5",     // must be in this form to fire
      executeGif: ult.executeGif || null,
      progress: 0,
      fired: false,
    };
  }
}

/**
 * Defensive passive checks before Ken/Immortal/Logia resolution:
 * - Nika Gear5: chance to nullify ANY incoming damage/effect
 * - Ope Ope: Shambles dodge (20%), optionally followed by Amputation (30%) that stuns attacker
 *
 * Return shape:
 *   { blocked: boolean, dodged: boolean }
 * If blocked or dodged, the caller should abort the incoming action.
 */
async function checkDefenderPassiveDefense(def, att, skillName, message) {
  ensureEffectState(def);
  ensureEffectState(att);

  // 1) Nika Gear 5 — nullify all incoming (damage AND effects)
  const nullify = passivesOf(def, "gear5NullifyChance")[0];
  if (nullify && def.form === (nullify.form || "gear5")) {
    const chance = Number.isFinite(nullify.chance) ? nullify.chance : 40;
    if (Math.random() * 100 < Math.max(0, chance)) {
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${att.item?.name || "Enemy"} used ${skillName}!`)
            .setDescription(`😶‍🌫️ **Reality Bend!** Damage and effects were **nullified**.`)
            .setImage(nullify.gif || null)
            .setColor(0xffffff),
        ],
      }).catch(()=>{});
      return { blocked: true, dodged: false };
    }
  }

  // 2) Ope Ope — Shambles (20% dodge)
  const shambles = passivesOf(def, "dodgeShambles")[0];
  if (shambles) {
    const chance = Number.isFinite(shambles.chance) ? shambles.chance : 20;
    if (Math.random() * 100 < Math.max(0, chance)) {
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${att.item?.name || "Enemy"} used ${skillName}!`)
            .setDescription(`💨 **Shambles!** ${def.tag} swaps and **evades** the attack.`)
            .setImage(shambles.gif || null)
            .setColor(0x00ffcc),
        ],
      }).catch(()=>{});

      // Amputation follow-up (30%): stun the attacker (paralysis)
      const amp = passivesOf(def, "amputationPassive")[0];
      if (amp) {
        const aChance = Number.isFinite(amp.chance) ? amp.chance : 30;
        if (Math.random() * 100 < Math.max(0, aChance)) {
          // Paralysis = 1-turn stun → we use "frozen" channel in effects
          ensureEffectState(att);
          att._fx.frozenTurns = Math.max(att._fx.frozenTurns || 0, Math.max(1, amp.stunTurns || 1));
          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("⚡ Amputation (passive)")
                .setDescription(`${att.tag} is **paralyzed** for **${Math.max(1, amp.stunTurns || 1)}** turn(s).`)
                .setImage(amp.gif || null)
                .setColor(0xff006e),
            ],
          }).catch(()=>{});
        }
      }
      return { blocked: false, dodged: true };
    }
  }

  return { blocked: false, dodged: false };
}

/**
 * Reactive passives that trigger AFTER the defender has been hit for damage.
 * Call with didDamage=true iff damage actually landed (hp decreased).
 *
 * Includes:
 *  - poisonOnHitWhileForm (e.g., Moku transform → 50% poison to attacker on being hit)
 *  - burnOnHitWhileForm   (e.g., Dragon/fire form → 30% burn to attacker on being hit)
 */
async function applyReactiveOnHitPassives(def, att, didDamage, message) {
  if (!didDamage) return;
  ensureEffectState(def);
  ensureEffectState(att);

  // Poison on hit while in specific form (e.g., "moku")
  for (const p of passivesOf(def, "poisonOnHitWhileForm")) {
    const formName = p.form || def.form;
    if (def.form === formName) {
      const chance = Number.isFinite(p.chance) ? p.chance : 50;   // default 50%
      if (Math.random() * 100 < Math.max(0, chance)) {
        applyStatus(def, att, "poison", { chance: 1 }, message);
      }
    }
  }

  // Burn on hit while in specific form (e.g., dragon/fire)
  for (const p of passivesOf(def, "burnOnHitWhileForm")) {
    const formName = p.form || def.form;
    if (def.form === formName) {
      const chance = Number.isFinite(p.chance) ? p.chance : 30;   // default 30%
      if (Math.random() * 100 < Math.max(0, chance)) {
        applyStatus(def, att, "burn", { chance: 1 }, message);
      }
    }
  }
}

/**
 * Ultimate charging (Nika):
 * - Call once per turn for the side currently acting (or at a consistent turn tick).
 * - When progress >= needed AND side is in required form (gear5), it fires:
 *   Instakill (sets foe.hp = 0), ignoring immortality/ken/haki/etc.
 */
async function tickAndMaybeFireUltimate(side, foe, message) {
  if (!side?._ult || side._ult.fired) return;

  side._ult.progress++;

  if (side._ult.progress >= side._ult.needed &&
      side.form === (side._ult.requiresForm || "gear5")) {

    side._ult.fired = true;
    foe.hp = 0; // instakill

    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🌀 Bajarang Gun — ULTIMATE")
          .setDescription(`**${foe.tag}** was **annihilated**. (Ignores immortality, Ken, Haki, etc.)`)
          .setImage(side._ult.executeGif || null)
          .setColor(0xffd700),
      ],
    }).catch(()=>{});
  }
}

module.exports = {
  applyStartPassives,
  checkDefenderPassiveDefense,
  applyReactiveOnHitPassives,
  tickAndMaybeFireUltimate,
};
