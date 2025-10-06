// commands/hakimission.js
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType,
} = require("discord.js");

const { findItem, resolveItemByInput } = require("../db/itemsHelper");
const { loadPlayers, savePlayers, ensurePlayer, getEffectiveStats } = require("../db/players");
const hakis = require("../db/hakis");
const {
  createLobby, getLobby, addUser, removeUser, setLobbyStatus, deleteLobby, touchLobby,
} = require("../db/hakiMissions");

// ======= CONFIG =======
const LOBBY_IDLE_EXPIRE_MS = 10 * 60 * 1000; // 10 min sin actividad → se limpia
const TURN_TIMEOUT_MS = 30_000;              // 30s por turno de jugador
const GLOBAL_IDLE_CANCEL_MS = 60_000;        // 🔥 1 min de inactividad total → cancelar misión
const MAX_PLAYERS = 3;
const MAX_ROUNDS = 30;

// GIFs (pon tus enlaces)
const GIFS = {
  ray_basic: "https://media.discordapp.net/attachments/1422731616320753674/1424013699391160472/tumblr_mc7oiy41JC1rwgj3ko1_500.gif?ex=68e2679a&is=68e1161a&hm=a7488161c6996de807074d9ea920ca4d710b0c6cc0c0ad1014818cb1a8edabb1&=.gif",
  ray_hao:   "https://media.discordapp.net/attachments/1422731616320753674/1424011369673523300/silvers-rayleigh.gif?ex=68e2656f&is=68e113ef&hm=7a52aa42a8876aab6a93283ec4d5646e1428c7f3d90890de5d7e037617ea4b50&=.gif",
  ray_ken:   "https://media.discordapp.net/attachments/1422731616320753674/1424010181766942750/rayleigh-luffy.gif?ex=68e26454&is=68e112d4&hm=87be7f033affdbef3066bbcc5521716f6d1facb9fbbb9c9b36a8ed29f4e03129&=.gif",
};

// ======= util =======
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pctVal = (v) => (v > 1 ? v / 100 : v);
const roll = (p) => Math.random() * 100 < (p || 0);

function lobbyEmbed(l) {
  return new EmbedBuilder()
    .setTitle("🗡️ Haki Mission — Rayleigh (Co-op)")
    .setDescription(
      `**Leader:** <@${l.leaderId}>\n` +
      `**Players:** ${l.users.map(u => `<@${u}>`).join(", ")}\n` +
      `**Status:** ${l.status}\n\n` +
      "**Commands**\n" +
      "• `n!hakimission start` — create a lobby\n" +
      "• `n!hakimission join` — join (max 3)\n" +
      "• `n!hakimission leave` — leave\n" +
      "• `n!hakimission begin` — leader starts\n" +
      "• `n!hakimission cancel` — leader cancels\n\n" +
      "Rewards on **victory per player**:\n" +
      "• **1%** Haoshoku, **20%** Kenbunshoku, **30%** Busoshoku; otherwise **+5,000 Belly**."
    )
    .setColor(0x9b59b6);
}

function starterOf(p) {
  if (p.activeSlot === "fruit" && p.equipped?.fruit) return { type: "fruit", name: p.equipped.fruit };
  if (p.activeSlot === "weapon" && p.equipped?.weapon) return { type: "weapon", name: p.equipped.weapon };
  return null;
}

function damageWithBonuses(dmg, member) {
  let d = dmg;
  if (member.buso) d = Math.floor(d * 1.05);
  if (member.nextAttackBonusPct > 0) {
    d = Math.floor(d * (1 + member.nextAttackBonusPct / 100));
    member.nextAttackBonusPct = 0;
  }
  return Math.max(1, d);
}

function listSkills(member) {
  const item = member.item;
  const mastery = member.mst ?? 1;
  const all = item.skills || [];
  const pool = member.form ? all.filter(s => s.form === member.form)
                           : all.filter(s => !s.form && s.type !== "transform");
  return pool.filter(s => (s.unlockAt ?? 1) <= mastery && !(member.cd[s.name] > 0));
}

function applyTransformBoostIfAny(member, formName) {
  const tb = member.item.transformBoosts;
  if (!Array.isArray(tb) || member.activeBoost) return;
  const b = tb.find(x => x.form === formName);
  if (!b) return;

  const extraHp  = Math.floor(member.baseHpMax * (Math.max(0, b.hpPercent || 0) / 100));
  const extraAtk = Math.floor(member.baseAtk   * (Math.max(0, b.atkPercent || 0) / 100));
  member.hpMax = member.baseHpMax + extraHp;
  member.atk   = member.baseAtk   + extraAtk;
  member.hp    = clamp(member.hp + extraHp, 0, member.hpMax);
  member.activeBoost = { form: formName };
}

function removeTransformBoostIfAny(member) {
  if (!member.activeBoost) return;
  member.hpMax = member.baseHpMax;
  member.atk   = member.baseAtk;
  member.hp    = clamp(member.hp, 0, member.hpMax);
  member.activeBoost = null;
}

function applyOnHitEffects(att, def, skill) {
  const eff = skill.effects?.onHit;
  if (!eff || !eff.type) return;
  if (!roll(eff.chance ?? 100)) return;

  switch (eff.type) {
    case "frozen":
      def.frozenTurns = Math.max(def.frozenTurns, Math.max(1, eff.stunTurns || 1));
      def.failNextChance = Math.max(def.failNextChance || 0, eff.nextFailChance || 30);
      break;
    case "bleed":
      def.bleed = true;
      def.bleedPct = Math.max(def.bleedPct || 0, eff.pct || 10);
      def.failPermChance = Math.max(def.failPermChance || 0, eff.permFailChance || 30);
      break;
    case "poison":
      def.poison = true;
      def.poisonPct = Math.max(def.poisonPct || 0, eff.pct || 20);
      break;
    case "burn":
      def.burn = true;
      def.burnPct = Math.max(def.burnPct || 0, eff.pct || 15);
      break;
    case "knockout":
      def.knockedTurns = Math.max(def.knockedTurns, 1);
      att.nextAttackBonusPct = Math.max(att.nextAttackBonusPct || 0, eff.nextAttackBonus || 30);
      break;
  }
}

function rollHakiReward() {
  const r = Math.random() * 100;
  if (r < 1) return "hao";
  if (r < 1 + 20) return "ken";
  if (r < 1 + 20 + 30) return "buso";
  return null;
}
function hakiLabel(k) {
  if (k === "hao") return "Haoshoku Haki (Conqueror’s)";
  if (k === "ken") return "Kenbunshoku Haki (Observation)";
  if (k === "buso") return "Busoshoku Haki (Armament)";
  return "";
}

// ======= boss setup =======
function makeRayleigh(sumHP, avgATK) {
  return {
    name: "Silvers Rayleigh",
    hpMax: Math.round(sumHP * 15.15),
    hp:    Math.round(sumHP * 1.15),
    atk:   Math.round(avgATK * 0.20),

    haoCD: 0,
    kenCD: 0,
    kenRounds: 0,           // 🔹 turnos restantes de esquiva total
    frozenTurns: 0,
    knockedTurns: 0,
    bleed: false, bleedPct: 10,
    poison: false, poisonPct: 20,
    burn: false, burnPct: 15,
    failNextChance: 0,
    failPermChance: 0,
    gif: GIFS.ray_basic,
  };
}

// ======= Mission logic =======
module.exports = {
  name: "hakimission",
  description: "Co-op Haki mission versus Rayleigh. Subcommands: start | join | leave | begin | cancel",
  async execute(message, args) {
    if (!message.guild) return message.reply("❌ Use this in a server.");
    const sub = (args[0] || "").toLowerCase();
    const chan = message.channel.id;
    const me = message.author.id;

    // auto-expire lobbies viejas
    const ex = getLobby(chan);
    if (ex && ex.status === "open" && Date.now() - ex.lastActivity > LOBBY_IDLE_EXPIRE_MS) deleteLobby(chan);

    if (!sub || sub === "help") {
      const l = getLobby(chan);
      if (!l) return message.reply("ℹ️ No open lobby. Use `n!hakimission start`.");
      return message.channel.send({ embeds: [lobbyEmbed(l)] });
    }

    if (sub === "start") {
      const l = getLobby(chan);
      if (l && l.status === "open") return message.reply("❌ There is already an open Haki mission here.");
      const lobby = createLobby(chan, me);
      return message.channel.send({ embeds: [lobbyEmbed(lobby)] });
    }

    if (sub === "join") {
      const lobby = getLobby(chan);
      if (!lobby || lobby.status !== "open") return message.reply("❌ No open lobby here.");
      if (lobby.users.includes(me)) return message.reply("✅ You are already in this lobby.");
      if (lobby.users.length >= MAX_PLAYERS) return message.reply(`❌ Lobby is full (max ${MAX_PLAYERS}).`);
      addUser(chan, me);
      return message.channel.send({ embeds: [lobbyEmbed(getLobby(chan))] });
    }

    if (sub === "leave") {
      const lobby = getLobby(chan);
      if (!lobby) return message.reply("❌ No lobby in this channel.");
      if (!lobby.users.includes(me)) return message.reply("❌ You are not in this lobby.");
      const after = removeUser(chan, me);
      if (!after) return message.reply("👋 Left the lobby. (Lobby removed)");
      return message.channel.send({ embeds: [lobbyEmbed(after)] });
    }

    if (sub === "cancel") {
      const lobby = getLobby(chan);
      if (!lobby) return message.reply("❌ No lobby in this channel.");
      if (lobby.leaderId !== me) return message.reply("❌ Only the leader can cancel the lobby.");
      deleteLobby(chan);
      return message.channel.send("⛔ Haki mission cancelled.");
    }

    if (sub !== "begin") {
      return message.reply("⚠️ Usage: `n!hakimission start|join|leave|begin|cancel`");
    }

    // ===== BEGIN =====
    const lobby = getLobby(chan);
    if (!lobby) return message.reply("❌ No lobby in this channel.");
    if (lobby.status !== "open") return message.reply("❌ This mission already started or ended.");
    if (lobby.leaderId !== me) return message.reply("❌ Only the leader can start the fight.");
    if (lobby.users.length < 1) return message.reply("❌ Need at least 1 player.");
    setLobbyStatus(chan, "started");

    // 🔥 Watchdog de inactividad global
    let lastAction = Date.now();
    const touch = () => { lastAction = Date.now(); };
    let aborted = false;
    const idleTimer = setInterval(async () => {
      if (Date.now() - lastAction > GLOBAL_IDLE_CANCEL_MS && !aborted) {
        aborted = true;
        try {
          await message.channel.send({
            content: "⏳ **Mission cancelled due to inactivity.**"
          });
        } catch {}
        setLobbyStatus(chan, "done");
        deleteLobby(chan);
      }
    }, 5_000);

    const playersDB = loadPlayers();
    const users = await Promise.all(lobby.users.map(id => message.client.users.fetch(id)));
    const party = [];
    for (let i = 0; i < lobby.users.length; i++) {
      const uid = lobby.users[i];
      const user = users[i];
      const P = ensurePlayer(playersDB, uid);
      const st = starterOf(P);
      if (!st) {
        setLobbyStatus(chan, "cancelled");
        clearInterval(idleTimer);
        return message.reply(`❌ <@${uid}> must have an equipped item (use \`n!equip\`).`);
      }
      const item = findItem(st.name) || resolveItemByInput(st.name, st.type);
      if (!item) {
        setLobbyStatus(chan, "cancelled");
        clearInterval(idleTimer);
        return message.reply(`❌ Missing item data for <@${uid}>: **${st.name}**.`);
      }
      const stats = getEffectiveStats(P, item.type, item.name, item.stats || {});
      party.push({
        id: uid,
        tag: user.username,
        p: P,
        item,
        hp: stats.hp,
        hpMax: stats.hp,
        atk: stats.attack,
        spd: stats.speed,
        mst: stats.mastery ?? 1,
        baseHpMax: stats.hp,
        baseAtk: stats.attack,
        activeBoost: null,
        form: null,
        formTurns: 0,
        formCooldown: 0,
        transformBaseCooldown: 1,
        nextAttackBonusPct: 0,
        buso: false,
        kenUsedOnce: false,
        kenCharges: 0,
        haoUsed: false,
        immortalTurns: 0,
        cd: Object.create(null),
        alive: true,
      });
    }

    // Boss escala con el grupo
    const sumHP = party.reduce((a, m) => a + m.hpMax, 0);
    const avgATK = Math.max(1, Math.round(party.reduce((a, m) => a + m.atk, 0) / party.length));
    const boss = makeRayleigh(sumHP, avgATK);

    // Mensaje inicial
    const intro = new EmbedBuilder()
      .setTitle("⚔️ Rayleigh appears!")
      .setDescription(
        `**Rayleigh HP:** ${boss.hp}/${boss.hpMax}\n` +
        party.map(p => `• ${p.tag}: ${p.hp}/${p.hpMax} HP`).join("\n")
      )
      .setColor(0xf1c40f);
    await message.channel.send({ embeds: [intro] });
    touch();

    // ===== helpers UI por jugador =====
    function buildMainButtonsFor(member) {
      const rows = [];
      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId("menu_skills").setLabel("Skills").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("menu_haki").setLabel("Haki").setStyle(ButtonStyle.Secondary),
        );
      const t = (member.item.skills || []).find(s => s.type === "transform");
      if (t && !member.form && member.formCooldown <= 0 && (t.unlockAt ?? 1) <= member.mst) {
        row1.addComponents(new ButtonBuilder().setCustomId("menu_transform").setLabel(t.name).setStyle(ButtonStyle.Danger));
      }
      rows.push(row1);
      return rows;
    }

    function chunk(arr, n=5){const r=[];for(let i=0;i<arr.length;i+=n)r.push(arr.slice(i,i+n));return r;}

    async function askPlayerTurn(member) {
      if (aborted) return;
      // panel
      const head = new EmbedBuilder()
        .setTitle(`🎯 ${member.tag}'s turn`)
        .setDescription(
          `${member.form ? `⚡ **Form:** ${member.form} (${member.formTurns}t left)\n` : ""}` +
          `**Rayleigh HP:** ${boss.hp}/${boss.hpMax}\n` +
          party.map(p => `• ${p.tag}: ${p.hp}/${p.hpMax} HP${p.id === member.id ? " ←" : ""}`).join("\n")
        )
        .setColor(0x3498db);

      const panel = await message.channel.send({ embeds: [head], components: buildMainButtonsFor(member) });
      touch();

      // collector para ESTE turno (solo el jugador actual)
      const collector = message.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === member.id,
        time: TURN_TIMEOUT_MS,
      });

      let resolved = false;

      const endTurn = async () => {
        if (resolved) return;
        resolved = true;
        try { await panel.edit({ components: [] }); } catch {}
        collector.stop("done");
      };

      const refreshSkillsMenu = async () => {
        const skills = listSkills(member);
        if (!skills.length) {
          await message.channel.send("❌ No skills available.");
          return;
        }
        const rows = [];
        chunk(skills, 5).forEach((group, gi) => {
          const row = new ActionRowBuilder();
          group.forEach((s, i) => {
            const idx = gi * 5 + i;
            const label = member.cd[s.name] > 0 ? `${s.name} (CD ${member.cd[s.name]})` : s.name;
            row.addComponents(new ButtonBuilder().setCustomId(`skill_${idx}`).setLabel(label).setStyle(ButtonStyle.Primary));
          });
          rows.push(row);
        });
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("back").setLabel("Back").setStyle(ButtonStyle.Secondary)
        ));
        const e = new EmbedBuilder().setTitle("📜 Choose a Skill").setColor(0x00aaff);
        try { await panel.edit({ embeds: [e], components: rows }); } catch {}
        touch();
      };

      const refreshHakiMenu = async () => {
        const row = new ActionRowBuilder();
        let any = false;
        if (member.p.hakis?.buso) {
          any = true;
          row.addComponents(
            new ButtonBuilder().setCustomId("haki_buso").setLabel(member.buso ? "Buso (ON)" : "Buso (Activate)")
              .setStyle(ButtonStyle.Secondary).setDisabled(!!member.buso));
        }
        if (member.p.hakis?.ken && !member.kenUsedOnce && member.kenCharges === 0) {
          any = true;
          row.addComponents(new ButtonBuilder().setCustomId("haki_ken").setLabel("Ken (3 dodges)").setStyle(ButtonStyle.Secondary));
        }
        if (member.p.hakis?.hao && !member.haoUsed) {
          any = true;
          row.addComponents(new ButtonBuilder().setCustomId("haki_hao").setLabel("Haoshoku").setStyle(ButtonStyle.Secondary));
        }
        if (!any) { await message.channel.send("❌ No Haki available right now."); return; }
        const rows = [row];
        rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("back").setLabel("Back").setStyle(ButtonStyle.Secondary)));
        const e = new EmbedBuilder().setTitle("✨ Haki").setColor(0x9900ff);
        try { await panel.edit({ embeds: [e], components: rows }); } catch {}
        touch();
      };

      // helpers de skill/haki/transform del jugador
      async function useSkill(member, skill) {
        touch();

        // 🔒 Ken activo de Rayleigh → esquiva TODO (consume CD si tiene)
        if (boss.kenRounds > 0 && skill.type !== "heal" && skill.type !== "immortal") {
          if (skill.cooldown) member.cd[skill.name] = skill.cooldown; // consume el CD igual
          await message.channel.send({
            embeds: [new EmbedBuilder()
              .setTitle(`${member.item.name} used ${skill.name}!`)
              .setDescription(`👁️ **Dodged by Rayleigh's Kenbunshoku!**`)
              .setImage(GIFS.ray_ken || null)
              .setColor(0x00ffcc)]
          });
          return;
        }

        // heal
        if (skill.type === "heal") {
          const amt = Math.floor(member.hpMax * pctVal(skill.healPercent ?? 0));
          const prev = member.hp;
          member.hp = clamp(member.hp + amt, 0, member.hpMax);
          if (skill.cooldown) member.cd[skill.name] = skill.cooldown;
          await message.channel.send({
            embeds: [new EmbedBuilder().setTitle(`${skill.name} — Healing`)
              .setDescription(`❤️ Healed **${member.hp - prev}** HP.`).setImage(skill.gif || null).setColor(0x00c853)]
          });
          return;
        }

        // immortal
        if (skill.type === "immortal") {
          member.immortalTurns = Math.max(member.immortalTurns, skill.immortalTurns || 2);
          if (skill.cooldown) member.cd[skill.name] = skill.cooldown;
          await message.channel.send({
            embeds: [new EmbedBuilder().setTitle(`${skill.name} — Immortal`)
              .setDescription(`🛡️ You are **Immortal** for **${member.immortalTurns}** turn(s).`)
              .setImage(skill.gif || null).setColor(0x00e5ff)]
          });
          return;
        }

        // damage (+hits) + optional heal %
        let dmg = Math.floor(member.atk * (skill.multiplier ?? 1));
        if (skill.hits) {
          dmg = 0; for (let i=0;i<skill.hits;i++) dmg += Math.floor(member.atk * (skill.multiplier ?? 1));
        }
        dmg = damageWithBonuses(dmg, member);
        boss.hp = Math.max(0, boss.hp - dmg);

        let healTxt = "";
        if (skill.healPercent) {
          const h = Math.floor(member.hpMax * pctVal(skill.healPercent));
          const before = member.hp;
          member.hp = clamp(member.hp + h, 0, member.hpMax);
          healTxt = `\n❤️ Healed **${member.hp - before}** HP.`;
        }
        if (skill.cooldown) member.cd[skill.name] = skill.cooldown;

        await message.channel.send({
          embeds: [new EmbedBuilder().setTitle(`${member.item.name} used ${skill.name}!`)
            .setDescription(`💥 Dealt **${dmg}** damage.${healTxt}`).setImage(skill.gif || null).setColor(0xff4500)]
        });

        applyOnHitEffects(member, boss, skill);

        if (skill.endForm && member.form) {
          member.form = null; member.formTurns = 0; removeTransformBoostIfAny(member);
          const baseCd = (member.item.skills || []).find(s => s.type === "transform")?.cooldown ?? 1;
          member.formCooldown = Math.max(member.formCooldown, skill.forceFormCooldown ?? baseCd);
          await message.channel.send("💨 Transformation ended (cooldown applied).");
        }
      }

      function tickAfterPlayer(member) {
        if (member.form) {
          member.formTurns--;
          if (member.formTurns <= 0) {
            member.form = null; removeTransformBoostIfAny(member);
            member.formCooldown = Math.max(member.formCooldown, member.transformBaseCooldown || 1);
            message.channel.send(
              `💨 Transformation ended (Cooldown ${member.transformBaseCooldown} turn${member.transformBaseCooldown>1?"s":""}).`
            ).catch(()=>{});
          }
        } else if (member.formCooldown > 0) {
          member.formCooldown--;
        }
        // bajar CDs de skills personales al final de su turno
        Object.keys(member.cd).forEach(k => { if (member.cd[k] > 0) member.cd[k]--; });
        if (member.immortalTurns > 0) member.immortalTurns--;
      }

      collector.on("collect", async (i) => {
        try { await i.deferUpdate(); } catch {}
        touch();

        if (i.customId === "menu_skills") return refreshSkillsMenu();
        if (i.customId === "menu_haki") return refreshHakiMenu();

        if (i.customId === "back") {
          try { await panel.edit({ embeds: [head], components: buildMainButtonsFor(member) }); } catch {}
          return;
        }

        if (i.customId === "menu_transform") {
          const t = (member.item.skills || []).find(s => s.type === "transform");
          if (!t) return message.channel.send("❌ This item has no transformation.");
          if (member.form) return message.channel.send("⚡ Already transformed!");
          if ((t.unlockAt ?? 1) > member.mst) return message.channel.send("❌ Transformation not unlocked yet.");
          if (member.formCooldown > 0) return message.channel.send(`⌛ Cooldown: ${member.formCooldown} turn(s).`);

          member.form = t.form || "gear2";
          member.formTurns = t.duration || 5;
          member.transformBaseCooldown = t.cooldown ?? 1;
          applyTransformBoostIfAny(member, member.form);

          await message.channel.send({
            embeds: [new EmbedBuilder().setTitle(`⚡ ${t.name} Activated!`)
              .setDescription(`Power up for ${member.formTurns} turns!`)
              .setImage(t.gif || null).setColor(0xff006e)]
          });
          tickAfterPlayer(member);
          await endTurn();
          return;
        }

        if (i.customId.startsWith("skill_")) {
          const idx = parseInt(i.customId.split("_")[1], 10);
          const ls = listSkills(member);
          const chosen = ls[idx];
          if (!chosen) return;
          await useSkill(member, chosen);
          tickAfterPlayer(member);
          await endTurn();
          return;
        }

        if (i.customId === "haki_buso") {
          if (!member.p.hakis?.buso) return;
          if (member.buso) return message.channel.send("🖤 Buso is already ON.");
          member.buso = true;
          await message.channel.send({
            embeds: [new EmbedBuilder().setTitle("🖤 Buso Haki Activated!")
              .setDescription("+5% damage & can hit Logias.").setImage(hakis.buso.gif).setColor(0x222222)]
          });
          tickAfterPlayer(member);
          await endTurn();
          return;
        }

        if (i.customId === "haki_ken") {
          if (!member.p.hakis?.ken) return;
          if (member.kenUsedOnce || member.kenCharges > 0) {
            await message.channel.send("❌ Ken already active or used.");
          } else {
            member.kenUsedOnce = true; member.kenCharges = 3;
            await message.channel.send({
              embeds: [new EmbedBuilder().setTitle("👁️ Kenbunshoku Haki Activated!")
                .setDescription("You will dodge the next **3** attacks.").setImage(hakis.ken.gif).setColor(0x00ffcc)]
            });
          }
          tickAfterPlayer(member);
          await endTurn();
          return;
        }

        if (i.customId === "haki_hao") {
          if (!member.p.hakis?.hao) return;
          if (member.haoUsed) {
            await message.channel.send("❌ You already used Haoshoku in this mission.");
          } else {
            member.haoUsed = true;
            boss.knockedTurns += 2;
            await message.channel.send({
              embeds: [new EmbedBuilder().setTitle("⚡ Haoshoku Haki!")
                .setDescription("Rayleigh is **stunned for 2 turns**.").setImage(hakis.hao.gif).setColor(0xff0000)]
            });
          }
          tickAfterPlayer(member);
          await endTurn();
          return;
        }
      });

      collector.on("end", async (_c, reason) => {
        try { await panel.edit({ components: [] }); } catch {}
        if (!resolved && !aborted) {
          // timeout → auto basic (o esquivado por Ken activo del boss)
          const skills = listSkills(member);
          if (boss.kenRounds > 0) {
            await message.channel.send({
              embeds: [new EmbedBuilder()
                .setTitle(`${member.tag} (auto)`)
                .setDescription(`⏱️ Turn timed out. **Rayleigh dodges with Kenbunshoku!**`)
                .setImage(GIFS.ray_ken || null)
                .setColor(0xaaaaaa)]
            });
          } else if (skills[0]) {
            await useSkill(member, skills[0]);
          } else {
            const dmg = damageWithBonuses(member.atk, member);
            boss.hp = Math.max(0, boss.hp - dmg);
            await message.channel.send({
              embeds: [new EmbedBuilder().setTitle(`${member.tag} (auto)`)
                .setDescription(`⏱️ Turn timed out. Auto-attack dealt **${dmg}**.`).setColor(0xaaaaaa)]
            });
          }
          tickAfterPlayer(member);
        }
      });

      // espera a que termine este turno
      return new Promise((res) => {
        const endWatcher = setInterval(() => {
          if (resolved || boss.hp <= 0 || !member.alive || aborted) {
            clearInterval(endWatcher);
            res();
          }
        }, 200);
      });
    }

    // ===== BOSS TURN =====
    async function bossStartOfTurn() {
      touch();

      // DoTs
      const before = boss.hp;
      if (boss.bleed)  boss.hp = Math.max(0, boss.hp - Math.floor(boss.hpMax * (boss.bleedPct  / 100)));
      if (boss.poison) boss.hp = Math.max(0, boss.hp - Math.floor(boss.hpMax * (boss.poisonPct / 100)));
      if (boss.burn)   boss.hp = Math.max(0, boss.hp - Math.floor(boss.hpMax * (boss.burnPct   / 100)));
      const dot = before - boss.hp;
      if (dot > 0) {
        await message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("🩹 Status Effects").setDescription(`DoT dealt **${dot}** to Rayleigh.`).setColor(0xcc3333)] });
      }
      if (boss.hp <= 0) return true;

      // bajar CDs/turnos
      if (boss.haoCD > 0) boss.haoCD--;
      if (boss.kenCD > 0) boss.kenCD--;
      if (boss.kenRounds > 0) boss.kenRounds--;

      // stun del boss
      if (boss.knockedTurns > 0 || boss.frozenTurns > 0) {
        if (boss.knockedTurns > 0) boss.knockedTurns--;
        if (boss.frozenTurns > 0) boss.frozenTurns--;
        await message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("⚡ Rayleigh is stunned!").setDescription("He loses this turn.").setColor(0xff0000)] });
        return true; // sin acción
      }
      return false;
    }

    async function bossTurn() {
      if (aborted) return;
      if (await bossStartOfTurn()) return;

      // Elegir acción
      let action = "basic";
      const choices = [{ a:"basic", w:40 }];
      if (boss.haoCD === 0) choices.push({ a:"hao", w:35 });
      if (boss.kenCD === 0 && boss.kenRounds === 0) choices.push({ a:"ken", w:25 });
      let total = choices.reduce((a,c)=>a+c.w,0);
      let r = Math.random()*total;
      for (const c of choices){ r -= c.w; if (r<=0){ action=c.a; break; } }

      if (action === "hao") {
        const alive = party.filter(p => p.alive);
        if (!alive.length) return;
        const t = alive[Math.floor(Math.random()*alive.length)];
        t.stunTurns = (t.stunTurns || 0) + 3;
        boss.haoCD = 5;
        await message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("⚡ Rayleigh — Haoshoku!")
          .setDescription(`<@${t.id}> is **stunned for 3 turns**.`)
          .setImage(GIFS.ray_hao || null).setColor(0xff00aa)] });
        touch();
        return;
      }

      if (action === "ken") {
        boss.kenRounds = 3;
        boss.kenCD = 10;
        await message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("👁️ Rayleigh — Kenbunshoku!")
          .setDescription("He will dodge the next **3** turns.")
          .setImage(GIFS.ray_ken || null).setColor(0x00ffcc)] });
        touch();
        return;
      }

      // basic: elige objetivo aleatorio vivo
      const alive = party.filter(p => p.alive);
      if (!alive.length) return;
      const t = alive[Math.floor(Math.random()*alive.length)];

      // checks en el defensor: Ken, Immortal, Logia, Evasión en forma
      if (t.kenCharges > 0) {
        t.kenCharges--;
        await message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("Rayleigh attacks!")
          .setDescription(`💨 **Dodged by Kenbunshoku!** (${3 - t.kenCharges}/3)`)
          .setColor(0x00ffcc)] });
        touch();
        return;
      }
      if (t.immortalTurns > 0) {
        await message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("Rayleigh attacks!")
          .setDescription(`🛡️ **Immortal!** No damage to <@${t.id}>.`)
          .setColor(0x00e5ff)] });
        touch();
        return;
      }

      let dodgeChance = 0;
      if (t.form && Array.isArray(t.item.passives)) {
        const pv = t.item.passives.find(x => x.type==="dodgeChanceOnForm" && x.form===t.form);
        if (pv) dodgeChance = Math.max(0, pv.chance || 0);
      }
      if (dodgeChance > 0 && roll(dodgeChance)) {
        await message.channel.send({ embeds: [new EmbedBuilder()
          .setTitle("Rayleigh attacks!")
          .setDescription(`💨 **Jet Evasion!** ${t.tag} dodged the attack.`)
          .setColor(0x00ffcc)] });
        touch();
        return;
      }

      const base = Math.max(1, Math.floor(boss.atk * (0.9 + Math.random()*0.3)));
      t.hp = Math.max(0, t.hp - base);
      await message.channel.send({ embeds: [new EmbedBuilder()
        .setTitle("🗡️ Rayleigh — Basic Attack")
        .setDescription(`<@${t.id}> takes **${base}** damage. (${t.hp}/${t.hpMax})`)
        .setImage(GIFS.ray_basic || null).setColor(0xe67e22)] });
      touch();

      if (t.hp <= 0) { t.alive = false; }
    }

    // ===== LOOP =====
    let round = 1;
    while (round <= MAX_ROUNDS && boss.hp > 0 && party.some(p => p.alive) && !aborted) {
      await bossTurn();
      if (boss.hp <= 0 || !party.some(p => p.alive) || aborted) break;

      for (const member of party) {
        if (!member.alive || aborted) continue;

        // descontar stun al empezar su turno
        if (member.stunTurns && member.stunTurns > 0) {
          member.stunTurns--;
          await message.channel.send({ embeds: [new EmbedBuilder()
            .setTitle(`⚡ ${member.tag} is stunned!`)
            .setDescription("They lose this turn.").setColor(0xff0000)] });
          touch();
          // bajar cooldown de transformación mientras está stuneado
          if (!member.form && member.formCooldown > 0) member.formCooldown--;
          // bajar CDs generales un poco
          Object.keys(member.cd).forEach(k => { if (member.cd[k] > 0) member.cd[k]--; });
          if (member.immortalTurns > 0) member.immortalTurns--;
          continue;
        }

        await askPlayerTurn(member);

        if (boss.hp <= 0 || aborted) break;
        if (!party.some(p => p.alive)) break;
      }

      if (boss.hp <= 0 || !party.some(p => p.alive) || aborted) break;

      round++;
    }

    // ===== resultado =====
    clearInterval(idleTimer);

    if (aborted) {
      setLobbyStatus(chan, "done");
      deleteLobby(chan);
      return;
    }

    const victory = boss.hp <= 0 && party.some(p => p.alive);
    const end = new EmbedBuilder()
      .setTitle(victory ? "🏆 Victory — Rayleigh Defeated!" : "❌ Defeat — Rayleigh Prevails")
      .setDescription(
        `**Rayleigh HP:** ${boss.hp}/${boss.hpMax}\n` +
        party.map(p => `• ${p.tag}: ${p.hp}/${p.hpMax} HP ${p.alive ? "🟢" : "🔴"}`).join("\n")
      )
      .setColor(victory ? 0x2ecc71 : 0xe74c3c);
    await message.channel.send({ embeds: [end] });

    if (victory) {
      // recompensas por jugador
      const desc = [];
      for (const m of party) {
        const P = ensurePlayer(playersDB, m.id);
        P.hakis = P.hakis || {};
        let reward = rollHakiReward();
        if (reward && P.hakis[reward]) reward = null; // ya lo tenía
        if (reward) {
          P.hakis[reward] = true;
          desc.push(`• <@${m.id}> — **${hakiLabel(reward)}** unlocked!`);
        } else {
          P.belly = (P.belly || 0) + 5000;
          desc.push(`• <@${m.id}> — **+5,000 Belly**`);
        }
      }
      savePlayers(playersDB);
      await message.channel.send({ embeds: [new EmbedBuilder().setTitle("🎁 Rewards").setDescription(desc.join("\n")).setColor(0x2ecc71)] });
    }

    setLobbyStatus(chan, "done");
    deleteLobby(chan);
  },
};
