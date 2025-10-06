const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} = require("discord.js");

const { loadPlayers, getEffectiveStats } = require("../db/players");
const { findItem, resolveItemByInput } = require("../db/itemsHelper");
const hakis = require("../db/hakis");
const { loadPvP, savePvP, findPendingFor, removePair } = require("../db/pvp");

// NEW: centralized effects & passives
const {
  startOfTurnDOT,
  isStunned,
  consumeStunTurn,
  applyPassivesOnTransform,
  endTransformBoosts,
  applyStatus, // electrified
} = require("../db/effects");
const {
  applyStartPassives,
  checkDefenderPassiveDefense,
  applyReactiveOnHitPassives,
  tickAndMaybeFireUltimate,
} = require("../db/passives");

// ---------- helpers ----------
const roll   = (p) => Math.random() * 100 < (p || 0);
const clamp  = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const mkSide = (user, p, item, stats) => ({
  id: user.id,
  tag: user.username,
  p,
  item,                 // { name, type, stats, skills, isLogia? }
  hp: stats.hp,
  hpMax: stats.hp,
  atk: stats.attack,
  spd: stats.speed,
  mst: stats.mastery ?? 1,

  // base for transform boosts
  baseHpMax: stats.hp,
  baseAtk: stats.attack,
  activeBoost: null, // { form, hpPercent, atkPercent }

  // transform
  form: null,
  formTurns: 0,
  formCooldown: 0,
  transformBaseCooldown: 1,

  // next-attack bonus (from knockout, etc.)
  nextAttackBonusPct: 0,

  // haki
  buso: false,
  kenCharges: 0,        // 0..3
  kenUsedOnce: false,
  haoUsed: false,

  // legacy CC
  stunTurns: 0,
  frozenTurns: 0,
  knockedTurns: 0,
  immortalTurns: 0,

  // legacy DoTs
  bleed: false,  bleedPct: 10,
  poison: false, poisonPct: 20,
  burn: false,   burnPct: 15,

  // legacy fail chances
  failNextChance: 0,
  failPermChance: 0,

  // tags usados (prerrequisitos)
  _tagsUsed: new Set(),

  // cooldowns por skill
  cds: Object.create(null),
});

const dmgWithBonuses = (attacker, base) => {
  let d = base;
  if (attacker.buso) d = Math.floor(d * 1.05);   // +5% buso
  if (attacker.nextAttackBonusPct > 0) {
    d = Math.floor(d * (1 + attacker.nextAttackBonusPct / 100));
    attacker.nextAttackBonusPct = 0;
  }
  return Math.max(1, d);
};

// transform tick (apply real cooldown when form ends)
const tickForm = (s) => {
  if (s.form) {
    s.formTurns--;
    if (s.formTurns <= 0) {
      removeTransformBoostIfAny(s);
      endTransformBoosts(s);
      s.form = null;
      s.formCooldown = Math.max(s.formCooldown, s.transformBaseCooldown || 1);
    }
  } else if (s.formCooldown > 0) {
    s.formCooldown--;
  }
};

// decrease all cooldowns > 0
function decCooldowns(side) {
  const cds = side.cds || {};
  for (const k of Object.keys(cds)) {
    if (cds[k] > 0) cds[k]--;
  }
}

function normPct(x) {
  if (!Number.isFinite(x)) return 0;
  if (x <= 0) return 0;
  if (x <= 1) return x;
  if (x <= 100) return x / 100;
  return 1;
}

async function applyHeal(att, percent, name, gif, message) {
  const pct = normPct(percent);
  const amount = Math.floor(att.hpMax * pct);
  const before = att.hp;
  att.hp = Math.min(att.hpMax, att.hp + amount);
  const healed = att.hp - before;

  await message.channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`${name} — Healing`)
        .setDescription(`❤️ Healed **${healed}** HP.`)
        .setImage(gif || null)
        .setColor(0x00c853),
    ],
  });
}

// valid skills for current state
function listSkills(side) {
  const all = side.item.skills || [];
  const mastery = side.mst ?? 1;
  const pool = side.form ? all.filter(s => s.form === side.form) : all.filter(s => !s.form);
  return pool.filter((s) =>
    s.type !== "transform" &&
    (s.unlockAt ?? 1) <= mastery &&
    (!(side.cds?.[s.name] > 0))
  );
}

// === transform boosts from item.transformBoosts (local) ===
function applyTransformBoostIfAny(side, formName) {
  const tb = side.item.transformBoosts;
  if (!Array.isArray(tb) || side.activeBoost) return;

  const b = tb.find(x => x.form === formName);
  if (!b) return;

  const hpPct  = Math.max(0, b.hpPercent || 0);
  const atkPct = Math.max(0, b.atkPercent || 0);

  const extraHp  = Math.floor(side.baseHpMax * (hpPct / 100));
  const extraAtk = Math.floor(side.baseAtk   * (atkPct / 100));

  side.hpMax = side.baseHpMax + extraHp;
  side.atk   = side.baseAtk   + extraAtk;
  side.hp    = clamp(side.hp + extraHp, 0, side.hpMax);

  side.activeBoost = { form: formName, hpPercent: hpPct, atkPercent: atkPct };
}

function removeTransformBoostIfAny(side) {
  if (!side.activeBoost) return;
  side.hpMax = side.baseHpMax;
  side.atk   = side.baseAtk;
  side.hp    = clamp(side.hp, 0, side.hpMax);
  side.activeBoost = null;
}

// === on-hit effects (classic + electrified) ===
function applyOnHitEffects(att, def, skill, message) {
  const raw = skill.effects?.onHit;
  if (!raw) return;

  const list = Array.isArray(raw) ? raw : [raw];

  for (const eff of list) {
    const chance = eff.chance ?? 100;
    if (!roll(chance)) continue;

    if (eff.status === "electrified") {
      try { applyStatus(att, def, "electrified", { chance: 1 }, message); } catch {}
      continue;
    }

    switch (eff.type) {
      case "frozen": {
        const turns = Math.max(1, eff.stunTurns || 1);
        def.frozenTurns = Math.max(def.frozenTurns, turns);
        def.failNextChance = Math.max(def.failNextChance || 0, eff.nextFailChance || 30);
        break;
      }
      case "bleed": {
        def.bleed = true;
        def.bleedPct = Math.max(def.bleedPct || 0, eff.pct || 10);
        def.failPermChance = Math.max(def.failPermChance || 0, eff.permFailChance || 30);
        break;
      }
      case "poison": {
        def.poison = true;
        def.poisonPct = Math.max(def.poisonPct || 0, eff.pct || 20);
        break;
      }
      case "burn": {
        def.burn = true;
        def.burnPct = Math.max(def.burnPct || 0, eff.pct || 15);
        break;
      }
      case "knockout": {
        def.knockedTurns = Math.max(def.knockedTurns, 1);
        if (Number.isFinite(eff.nextAttackBonus)) {
          att.nextAttackBonusPct = Math.max(att.nextAttackBonusPct || 0, eff.nextAttackBonus);
        }
        break;
      }
      default: break;
    }
  }
}

module.exports = {
  name: "accept",
  description: "Accept a PvP challenge.",
  async execute(message) {
    // 1) find challenge
    const store = loadPvP();
    const pending = findPendingFor(store, message.author.id, message.channel.id);
    if (!pending) return message.reply("❌ You have no PvP challenge to accept.");

    const challengerId = pending.challenger;
    const opponentId   = pending.opponent; // me
    removePair(store, challengerId, opponentId);
    savePvP(store);

    // 2) load players and items
    const users = message.client.users;
    const players = loadPlayers();

    const userA = await users.fetch(challengerId);
    const userB = await users.fetch(opponentId);
    const A = players[challengerId];
    const B = players[opponentId];
    if (!A || !B) return message.reply("❌ Both players must start with `n!start`.");

    const starterOf = (p) => {
      if (p.activeSlot === "fruit" && p.equipped?.fruit) return { name: p.equipped.fruit, type: "fruit" };
      if (p.activeSlot === "weapon" && p.equipped?.weapon) return { name: p.equipped.weapon, type: "weapon" };
      return null;
    };
    const stA = starterOf(A);
    const stB = starterOf(B);
    if (!stA || !stB) return message.reply("❌ Both players must have an equipped item (use `n!equip`).");

    const itemA = findItem(stA.name) || resolveItemByInput(stA.name, stA.type);
    const itemB = findItem(stB.name) || resolveItemByInput(stB.name, stB.type);
    if (!itemA || !itemB) {
      return message.reply("❌ Missing item data. Make sure the equipped items exist in `db/items.js` and aliases.");
    }

    const statsA = getEffectiveStats(A, itemA.type, itemA.name, itemA.stats || {});
    const statsB = getEffectiveStats(B, itemB.type, itemB.name, itemB.stats || {});

    const P = mkSide(userA, A, itemA, statsA); // challenger
    const Q = mkSide(userB, B, itemB, statsB); // opponent (me)

    // 3) turn order
    let turn = P.spd >= Q.spd ? "P" : "Q";
    const cur  = () => (turn === "P" ? P : Q);
    const foe  = () => (turn === "P" ? Q : P);

    // 4) pending Hao counter window
    let pendingHao = null;

    // UI persistente + submenus + anti-doble-click
    let boardMsg = null;
    let menuMsg  = null;
    let acting   = false;

    const disableAll = async () => {
      try { if (boardMsg) await boardMsg.edit({ components: [] }); } catch {}
      try { if (menuMsg)  await menuMsg.edit({ components: [] }); } catch {}
      menuMsg = null;
    };

    const labelWithCd = (side, skill) => {
      const left = side.cds?.[skill.name] || 0;
      return left > 0 ? `${skill.name} (CD ${left})` : skill.name;
    };

    // 5) board UI
    const board = async (extras = []) => {
      const e = new EmbedBuilder()
        .setTitle("⚔️ PvP Battle")
        .setDescription(
          `**${P.tag} HP:** ${P.hp}/${P.hpMax}\n` +
          `**${Q.tag} HP:** ${Q.hp}/${Q.hpMax}\n\n` +
          `🎯 Turn: **${cur().tag}**` +
          `${cur().form ? `\n⚡ Form: **${cur().form}** (${cur().formTurns} turns left)` : ""}` +
          `${pendingHao && pendingHao.target === (turn === "P" ? "P" : "Q")
              ? `\n🌀 **Warning:** ${foe().tag} unleashed Haoshoku! Press **Haoshoku** now to CLASH or you'll be stunned (2 turns) and your action will be cancelled.`
              : ""}`
        )
        .setColor(turn === "P" ? 0x1e90ff : 0xff4d6d);

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId("menu_skills").setLabel("Skills").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("menu_haki").setLabel("Haki").setStyle(ButtonStyle.Secondary),
        );

      const t = (cur().item.skills || []).find(x => x.type === "transform");
      if (t && !cur().form && cur().formCooldown <= 0 && (t.unlockAt ?? 1) <= cur().mst) {
        row.addComponents(new ButtonBuilder().setCustomId("menu_transform").setLabel(t.name).setStyle(ButtonStyle.Danger));
      }

      try {
        if (boardMsg) await boardMsg.edit({ components: [] }).catch(() => {});
        if (menuMsg)  { try { await menuMsg.edit({ components: [] }); } catch {} menuMsg = null; }
        boardMsg = await message.channel.send({ embeds: [...extras, e], components: [row] });
      } catch {}
      acting = false; // liberar lock al pintar tablero
    };

    const openMenu = async (embed, rows) => {
      const backRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("menu_back").setLabel("Back").setStyle(ButtonStyle.Secondary)
      );
      const comps = [...rows, backRow];

      try {
        if (menuMsg) await menuMsg.edit({ components: [] }).catch(() => {});
        menuMsg = await message.channel.send({ embeds: [embed], components: comps });
      } catch {}
    };

    // ===== start-of-battle passives (ROOM, etc.) =====
    await applyStartPassives(P, message);
    await applyStartPassives(Q, message);

    const applyStartOfTurnEffects = async (side) => {
      decCooldowns(side);

      startOfTurnDOT(side, message);

      const beforeLegacy = side.hp;
      if (side.bleed)  side.hp = Math.max(0, side.hp - Math.floor(side.hpMax * (side.bleedPct  / 100)));
      if (side.poison) side.hp = Math.max(0, side.hp - Math.floor(side.hpMax * (side.poisonPct / 100)));
      if (side.burn)   side.hp = Math.max(0, side.hp - Math.floor(side.hpMax * (side.burnPct   / 100)));
      const legacyDot = beforeLegacy - side.hp;

      if (legacyDot > 0) {
        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setTitle("🩹 Status Effects")
            .setDescription(`DoT dealt **${legacyDot}** damage to **${side.tag}**.\nHP: ${side.hp}/${side.hpMax}`)
            .setColor(0xcc3333)]
        }).catch(()=>{});
      }

      if (side.hp <= 0) {
        const winner = side === P ? Q : P;
        const win = new EmbedBuilder()
          .setTitle("🏆 Victory!")
          .setDescription(`**${winner.tag}** defeated **${side.tag}**!`)
          .setColor(0xffd700);
        await message.channel.send({ embeds: [win] });
        return { died: true, consumedTurn: true };
      }

      await tickAndMaybeFireUltimate(side, side === P ? Q : P, message);
      if (foe().hp <= 0) {
        const win = new EmbedBuilder()
          .setTitle("🏆 Victory!")
          .setDescription(`**${side.tag}** defeated **${foe().tag}**!`)
          .setColor(0xffd700);
        await message.channel.send({ embeds: [win] });
        return { died: true, consumedTurn: true };
      }

      const legacyStunned = side.stunTurns > 0 || side.frozenTurns > 0 || side.knockedTurns > 0;
      const fxStunned = isStunned(side);
      if (legacyStunned || fxStunned) {
        if (side.stunTurns   > 0) side.stunTurns--;
        if (side.frozenTurns > 0) side.frozenTurns--;
        if (side.knockedTurns> 0) side.knockedTurns--;
        if (fxStunned) consumeStunTurn(side);

        tickForm(side);
        const ev = new EmbedBuilder()
          .setTitle("⚡ Stunned!")
          .setDescription(`${side.tag} loses this turn.`)
          .setColor(0xff0000);

        turn = turn === "P" ? "Q" : "P";
        await message.channel.send({ embeds: [ev] });
        await board();
        return { died: false, consumedTurn: true };
      }

      return { died: false, consumedTurn: false };
    };

    const applySkill = async (att, def, skill) => {
      // requisito por tag
      if (skill.requiresTagUsed) {
        const ok = att._tagsUsed && att._tagsUsed.has(skill.requiresTagUsed);
        if (!ok) {
          await message.channel.send(`❌ You must use the required move first.`);
          return;
        }
      }

      // fallos legacy
      if (att.failNextChance > 0 && roll(att.failNextChance)) {
        att.failNextChance = 0;
        const evF = new EmbedBuilder()
          .setTitle(`${att.item.name} tried ${skill.name}!`)
          .setDescription(`❌ The move **failed** due to status effect.`)
          .setColor(0x999999);
        await message.channel.send({ embeds: [evF] });
        return;
      }
      if (att.failPermChance > 0 && roll(att.failPermChance)) {
        const evF = new EmbedBuilder()
          .setTitle(`${att.item.name} tried ${skill.name}!`)
          .setDescription(`❌ The move **failed** due to bleeding.`)
          .setColor(0x999999);
        await message.channel.send({ embeds: [evF] });
        return;
      }

      // defensa pasiva (Shambles/dodges) ANTES de ken/inmortal/logia
      const pre = await checkDefenderPassiveDefense(def, att, skill.name, message);
      if (pre.blocked || pre.dodged) return;

      // Jet Evasion por forma (legacy)
      let dodgeChance = 0;
      if (def.form && Array.isArray(def.item.passives)) {
        const pv = def.item.passives.find(x => x.type === "dodgeChanceOnForm" && x.form === def.form);
        if (pv) dodgeChance = Math.max(0, pv.chance || 0);
      }
      if (dodgeChance > 0 && roll(dodgeChance)) {
        const evD = new EmbedBuilder()
          .setTitle(`${att.item.name} used ${skill.name}!`)
          .setDescription(`💨 **Jet Evasion!** ${def.tag} dodged the attack.`)
          .setImage(skill.gif || null)
          .setColor(0x00ffcc);
        await message.channel.send({ embeds: [evD] });
        return;
      }

      // Ken
      if (def.kenCharges > 0) {
        def.kenCharges--;
        const evKen = new EmbedBuilder()
          .setTitle(`${att.item.name} used ${skill.name}!`)
          .setDescription(`💨 **Dodged by Kenbunshoku!** (${3 - def.kenCharges}/3)`)
          .setImage(skill.gif || null)
          .setColor(0x00ffcc);
        await message.channel.send({ embeds: [evKen] });
        return;
      }

      // Immortal
      if (def.immortalTurns > 0) {
        def.immortalTurns--;
        const evImm = new EmbedBuilder()
          .setTitle(`${att.item.name} used ${skill.name}!`)
          .setDescription(`🛡️ **Immortal!** Damage blocked.`)
          .setImage(skill.gif || null)
          .setColor(0x00e5ff);
        await message.channel.send({ embeds: [evImm] });
        return;
      }

      // Logia
      if (def.item.isLogia && !att.buso) {
        const evL = new EmbedBuilder()
          .setTitle(`${att.item.name} used ${skill.name}!`)
          .setDescription(`🌀 **Logia immunity!** No damage (activate Buso).`)
          .setImage(skill.gif || null)
          .setColor(0x999999);
        await message.channel.send({ embeds: [evL] });
        return;
      }

      // Heal
      if (skill.type === "heal") {
        await applyHeal(att, skill.healPercent ?? 0, skill.name, skill.gif, message);
        const cdv = (skill.cooldown ?? skill.cd) | 0;
        if (cdv > 0) att.cds[skill.name] = cdv;
        if (skill.tag) att._tagsUsed.add(skill.tag);
        return;
      }

      // Immortal skill
      if (skill.type === "immortal") {
        const turns = Math.max(1, skill.immortalTurns || 2);
        att.immortalTurns = Math.max(att.immortalTurns, turns);
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${skill.name} — Immortal`)
              .setDescription(`🛡️ You become **Immortal** for **${turns}** turn(s).`)
              .setImage(skill.gif || null)
              .setColor(0x00e5ff),
          ],
        });
        const cdv = (skill.cooldown ?? skill.cd) | 0;
        if (cdv > 0) att.cds[skill.name] = cdv;
        if (skill.tag) att._tagsUsed.add(skill.tag);
        return;
      }

      // Damage (+ multi-hits)
      const beforeHp = def.hp;
      let dmg = Math.floor(att.atk * (skill.multiplier ?? 1));
      if (skill.hits) {
        dmg = 0;
        for (let i = 0; i < (skill.hits || 0); i++) {
          dmg += Math.floor(att.atk * (skill.multiplier ?? 1));
        }
      }
      dmg = dmgWithBonuses(att, dmg);
      def.hp = Math.max(0, def.hp - dmg);

      // Self-heal %
      let healTxt = "";
      if (skill.healPercent) {
        const p = normPct(skill.healPercent);
        const amount = Math.floor(att.hpMax * p);
        const before = att.hp;
        att.hp = Math.min(att.hpMax, att.hp + amount);
        const healed = att.hp - before;
        healTxt = `\n❤️ Healed **${healed}** HP.`;
      }

      await message.channel.send({
        embeds: [ new EmbedBuilder()
          .setTitle(`${att.item.name} used ${skill.name}!`)
          .setDescription(`💥 Dealt **${dmg}** damage!${healTxt}`)
          .setImage(skill.gif || null)
          .setColor(0xff4500)
        ]
      });

      const didDamage = def.hp < beforeHp;

      // on-hit (incl. electrified)
      applyOnHitEffects(att, def, skill, message);

      // ---- Amputation (del atacante) — sólo si pegó
      if (didDamage && Array.isArray(att.item.passives)) {
        const amputation = att.item.passives.find(x => x.type === "amputationPassive");
        if (amputation && roll(amputation.chance || 0)) {
          const turns = Math.max(1, amputation.stunTurns || 1);
          def.frozenTurns = Math.max(def.frozenTurns, turns);
          await message.channel.send({
            embeds: [ new EmbedBuilder()
              .setTitle("✂️ Amputation")
              .setDescription(`${def.tag} is **stunned for ${turns} turn(s)**.`)
              .setImage(amputation.gif || null)
              .setColor(0xff1744)
            ]
          });
        }
      }

      // reactivas tras recibir golpe
      await applyReactiveOnHitPassives(def, att, didDamage, message);

      // cooldown del skill
      const cdv = (skill.cooldown ?? skill.cd) | 0;
      if (cdv > 0) att.cds[skill.name] = cdv;

      if (skill.tag) att._tagsUsed.add(skill.tag);

      // fin de forma forzado
      if (skill.endForm && att.form) {
        att.form = null;
        att.formTurns = 0;
        removeTransformBoostIfAny(att);
        endTransformBoosts(att);
        const forced = (skill.forceFormCooldown ?? 0) | 0;
        const base = att.transformBaseCooldown || 1;
        att.formCooldown = Math.max(att.formCooldown, forced > 0 ? forced : base);
        await message.channel.send("💨 Full Form ended (cooldown applied).");
      }
    };

    // 7) primer tablero
    await board();

    const collector = message.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => cur().id === i.user.id,
      time: 180000,
    });

    collector.on("collect", async (interaction) => {
      try { await interaction.deferUpdate(); } catch {}
      if (acting) return; // anti doble click

      if (interaction.customId === "menu_back") {
        try { if (menuMsg) await menuMsg.edit({ components: [] }); } catch {}
        menuMsg = null;
        return board();
      }

      const start = await applyStartOfTurnEffects(cur());
      if (start.died || start.consumedTurn) return;

      if (interaction.customId === "menu_skills") {
        const side = cur();
        const available = listSkills(side);
        if (!available.length) return message.channel.send("❌ No skills available.");

        const row = new ActionRowBuilder();
        available.forEach((s, i) =>
          row.addComponents(new ButtonBuilder()
            .setCustomId(`skill_${i}`)
            .setLabel(labelWithCd(side, s))
            .setStyle(ButtonStyle.Primary))
        );

        await openMenu(new EmbedBuilder().setTitle("📜 Choose a Skill").setColor(0x00aaff), [row]);
        return;
      }

      if (interaction.customId === "menu_haki") {
        const side = cur();
        const row = new ActionRowBuilder();

        if (side.p.hakis?.buso) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId("haki_buso")
              .setLabel(side.buso ? "Buso (ON)" : "Buso (Activate)")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!!side.buso)
          );
        }
        if (side.p.hakis?.ken && !side.kenUsedOnce && side.kenCharges === 0) {
          row.addComponents(
            new ButtonBuilder().setCustomId("haki_ken").setLabel("Ken (Activate 3-dodge)").setStyle(ButtonStyle.Secondary)
          );
        }
        if (side.p.hakis?.hao && !side.haoUsed) {
          row.addComponents(new ButtonBuilder().setCustomId("haki_hao").setLabel("Haoshoku").setStyle(ButtonStyle.Secondary));
        }
        if (row.components.length === 0) return message.channel.send("❌ No Haki available right now.");

        await openMenu(new EmbedBuilder().setTitle("✨ Choose a Haki").setColor(0x9900ff), [row]);
        return;
      }

      if (interaction.customId === "menu_transform") {
        acting = true;
        await disableAll();

        const me = cur();
        const t = (me.item.skills || []).find(x => x.type === "transform");
        if (!t) { acting = false; return; }
        if (me.form) { acting = false; return message.channel.send("⚡ Already transformed!"); }
        if (me.formCooldown > 0) { acting = false; return message.channel.send(`⌛ Cooldown: ${me.formCooldown} turn(s).`); }
        if ((t.unlockAt ?? 1) > me.mst) { acting = false; return message.channel.send("❌ Transformation not unlocked yet."); }

        me.form      = t.form || "gear2";
        me.formTurns = t.duration || 5;
        me.transformBaseCooldown = (t.cooldown ?? 1) | 0;

        applyTransformBoostIfAny(me, me.form);
        applyPassivesOnTransform(me, t, me.item, message);

        const ev = new EmbedBuilder()
          .setTitle(`⚡ ${t.name} Activated!`)
          .setDescription(`Power up for ${me.formTurns} turns!`)
          .setImage(t.gif || null)
          .setColor(0xff006e);

        turn = turn === "P" ? "Q" : "P";
        await message.channel.send({ embeds: [ev] });

        const nxt = await applyStartOfTurnEffects(cur());
        if (nxt.died || nxt.consumedTurn) return;
        return board();
      }

      // ===== Pending Hao (CLASH) =====
      const me  = cur();
      const en  = foe();

      const iAmTargetOfPendingHao = !!pendingHao && pendingHao.target === (turn === "P" ? "P" : "Q");
      const thisIsHao = interaction.customId === "haki_hao";

      if (iAmTargetOfPendingHao) {
        acting = true;
        await disableAll();

        if (thisIsHao && me.p.hakis?.hao && !me.haoUsed) {
          me.haoUsed = true;
          pendingHao = null;

          const ev = new EmbedBuilder()
            .setTitle("⚡ Haoshoku Clash!")
            .setDescription("Both conquerors collide! No one is stunned.")
            .setImage(hakis.hao.clashGif || hakis.hao.gif)
            .setColor(0xff00ff);
          await message.channel.send({ embeds: [ev] });
          return board();
        } else {
          pendingHao = null;
          me.stunTurns += 2;

          const ev = new EmbedBuilder()
            .setTitle("⚡ Overwhelmed by Haoshoku!")
            .setDescription(`${me.tag} is stunned for **2 turns**. Action cancelled.`)
            .setImage(hakis.hao.gif)
            .setColor(0xff0000);

          tickForm(me);
          turn = turn === "P" ? "Q" : "P";
          await message.channel.send({ embeds: [ev] });

          const nxt = await applyStartOfTurnEffects(cur());
          if (nxt.died || nxt.consumedTurn) return;
          return board();
        }
      }

      // ===== Skills =====
      if (interaction.customId.startsWith("skill_")) {
        acting = true;
        await disableAll();

        const idx = parseInt(interaction.customId.split("_")[1], 10);
        const avail = listSkills(me);
        const chosen = avail[idx];
        if (!chosen) { acting = false; return; }

        await applySkill(me, en, chosen);
        if (en.hp <= 0) {
          collector.stop("victory");
          const win = new EmbedBuilder()
            .setTitle("🏆 Victory!")
            .setDescription(`**${me.tag}** defeated **${en.tag}**!`)
            .setColor(0xffd700);
          await message.channel.send({ embeds: [win] });
          return;
        }

        tickForm(me);
        turn = turn === "P" ? "Q" : "P";

        const nxt = await applyStartOfTurnEffects(cur());
        if (nxt.died || nxt.consumedTurn) return;
        return board();
      }

      // ===== Haki =====
      if (interaction.customId === "haki_buso") {
        acting = true;
        await disableAll();

        if (!me.buso) {
          me.buso = true;
          const ev = new EmbedBuilder()
            .setTitle("🖤 Buso Haki Activated!")
            .setDescription("+5% damage and can hit Logias.")
            .setImage(hakis.buso.gif)
            .setColor(0x222222);
          await message.channel.send({ embeds: [ev] });
        }

        tickForm(me);
        turn = turn === "P" ? "Q" : "P";
        const nxt = await applyStartOfTurnEffects(cur());
        if (nxt.died || nxt.consumedTurn) return;
        return board();
      }

      if (interaction.customId === "haki_ken") {
        acting = true;
        await disableAll();

        if (me.kenUsedOnce || me.kenCharges > 0) {
          await message.channel.send("❌ Ken already active or used.");
        } else {
          me.kenUsedOnce = true;
          me.kenCharges = 3;
          const ev = new EmbedBuilder()
            .setTitle("👁️ Kenbunshoku Haki Activated!")
            .setDescription("You will dodge the next **3** incoming attacks.")
            .setImage(hakis.ken.gif)
            .setColor(0x00ffcc);
          await message.channel.send({ embeds: [ev] });
        }

        tickForm(me);
        turn = turn === "P" ? "Q" : "P";
        const nxt = await applyStartOfTurnEffects(cur());
        if (nxt.died || nxt.consumedTurn) return;
        return board();
      }

      if (interaction.customId === "haki_hao") {
        acting = true;
        await disableAll();

        if (me.haoUsed) {
          await message.channel.send("❌ You already used Haoshoku in this battle.");
        } else {
          me.haoUsed = true;
          pendingHao = { from: (turn === "P" ? "P" : "Q"), target: (turn === "P" ? "Q" : "P") };
          const ev = new EmbedBuilder()
            .setTitle("⚡ Haoshoku Haki Unleashed!")
            .setDescription(`${foe().tag} can press **Haoshoku** on their next turn to **CLASH**. Otherwise they'll be stunned for **2 turns** and their action will be cancelled.`)
            .setImage(hakis.hao.gif)
            .setColor(0xff0000);
          await message.channel.send({ embeds: [ev] });
        }

        tickForm(me);
        turn = turn === "P" ? "Q" : "P";
        const nxt = await applyStartOfTurnEffects(cur());
        if (nxt.died || nxt.consumedTurn) return;
        return board();
      }
    });

    collector.on("end", async (_col, reason) => {
      try { if (boardMsg) await boardMsg.edit({ components: [] }); } catch {}
      try { if (menuMsg)  await menuMsg.edit({ components: [] }); } catch {}
      if (reason === "time" || reason === "idle") await message.channel.send("⌛ PvP ended.");
    });
  },
};
