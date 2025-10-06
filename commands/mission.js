// commands/mission.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} = require("discord.js");

const {
  loadPlayers,
  savePlayers,
  getItemMastery,
  setItemMastery,
  getEffectiveStats,
} = require("../db/players");

const { findItem } = require("../db/itemsHelper");
const hakis = require("../db/hakis");

// ================== utils ==================
const chunk = (arr, size = 5) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pctVal = (v) => (v > 1 ? v / 100 : v); // 20 -> 0.20, 0.2 -> 0.2
const roll = (p) => Math.random() * 100 < (p || 0); // true si pasa

function damageWithBonuses(base, busoOn) {
  let d = base;
  if (busoOn) d = Math.floor(d * 1.05); // +5%
  return Math.max(1, d);
}

// Un lock simple para que el mismo usuario no pueda abrir dos misiones a la vez
const activeMissions = new Map(); // key: userId -> true

module.exports = {
  name: "mission",
  description: "Fight a Sea Beast (Easy) with mastery and EXP rewards.",
  async execute(message) {
    const userId = message.author.id;
    if (activeMissions.get(userId)) {
      return message.reply("⚠️ You already have a mission running. Finish it first.");
    }
    activeMissions.set(userId, true);

    const players = loadPlayers();
    const p = players[userId];
    if (!p) {
      activeMissions.delete(userId);
      return message.reply("❌ You must start first with `n!start`.");
    }

    // Item equipado (fruit/weapon)
    let starter = null;
    if (p.activeSlot === "fruit" && p.equipped?.fruit) {
      starter = { name: p.equipped.fruit, type: "fruit" };
    } else if (p.activeSlot === "weapon" && p.equipped?.weapon) {
      starter = { name: p.equipped.weapon, type: "weapon" };
    }
    if (!starter) {
      activeMissions.delete(userId);
      return message.reply("❌ Equip something first with `n!equip`.");
    }

    // Datos del ítem
    const item = findItem(starter.name);
    if (!item) {
      activeMissions.delete(userId);
      return message.reply("❌ Could not find item data.");
    }

    // Stats efectivos
    const baseStats = item.stats || { hp: 80, attack: 20, speed: 10 };
    const stats = getEffectiveStats(p, starter.type, starter.name, baseStats);

    // ===== estado local =====
    const baseHpMax = stats.hp;
    const baseAtk   = stats.attack;

    let playerHpMax = stats.hp;
    let playerHp    = stats.hp;
    let playerAtk   = stats.attack;
    let mastery     = stats.mastery;

    // boost activo por forma (para revertir)
    let activeBoost = null; // { form, hpPercent, atkPercent }

    // forma / transf
    let form = null;        // p.ej. "gear2" | "fullform"
    let formTurns = 0;
    let formCooldown = 0;
    let transformBaseCooldown = 1; // recuerda el CD definido en el item

    // bonus de próximo golpe (por knockout)
    let nextAttackBonusPct = 0;

    // haki
    let busoOn = false;
    let kenUsedOnce = false;
    let kenCharges = 0;     // 0..3
    let haoUsed = false;

    // phoenix inmortal
    let immortalTurns = 0;

    // cooldowns de skills
    const cd = Object.create(null);

    // enemigo
    const enemy = {
      name: "Foosha Sea Beast",
      hpMax: 10000,
      hp: 10000,
      atk: 50,
      isLogia: false,
      stunTurns: 0,
      // Estados de efectos
      frozenTurns: 0,
      knockedTurns: 0,
      bleed: false,  bleedPct: 10,   // % de HP máx por turno
      poison: false, poisonPct: 20,
      burn: false,   burnPct: 15,
      failNextChance: 0,             // prob. de fallar el **próximo** ataque
      failPermChance: 0,             // prob. permanente (ej. 30% por sangrado)
      // GIF del cuadro principal (board)
      gif: "https://cdn.discordapp.com/attachments/1422731616320753674/1423459047897694310/tumblr_af9ac59deac70cd4f7beef6b6b1acec2_10d00359_540_1.gif",
    };

    // ===== helpers internos =====
    function decCooldowns() {
      for (const k of Object.keys(cd)) {
        if (cd[k] > 0) cd[k]--;
      }
    }
    function canUseSkill(s) {
      if ((s.unlockAt ?? 1) > mastery) return false;
      if (s.type === "transform") return false; // no listamos la transformación
      const name = s.name;
      if (cd[name] && cd[name] > 0) return false;
      return true;
    }
    function getCurrentSkills() {
      const all = (item.skills || []);
      const pool = form
        ? all.filter((s) => s.form === form)
        : all.filter((s) => !s.form && s.type !== "transform");
      return pool.filter(canUseSkill);
    }

    // aplicar boosts de forma (hpPercent / atkPercent) definidos en items.transformBoosts
    function applyTransformBoostIfAny(formName) {
      if (!item.transformBoosts) return;
      const b = item.transformBoosts.find(x => x.form === formName);
      if (!b) return;
      // si ya hay boost, nada
      if (activeBoost) return;

      const hpPct  = Math.max(0, b.hpPercent || 0);
      const atkPct = Math.max(0, b.atkPercent || 0);

      const extraHp  = Math.floor(baseHpMax * (hpPct / 100));
      const extraAtk = Math.floor(baseAtk   * (atkPct / 100));

      playerHpMax = baseHpMax + extraHp;
      playerAtk   = baseAtk   + extraAtk;

      // curamos por el aumento de vida máx, sin sobrepasar playerHpMax
      playerHp = clamp(playerHp + extraHp, 0, playerHpMax);

      activeBoost = { form: formName, hpPercent: hpPct, atkPercent: atkPct };
    }

    function removeTransformBoostIfAny() {
      if (!activeBoost) return;
      // Revertir a los stats base
      playerHpMax = baseHpMax;
      playerAtk   = baseAtk;
      // Si la vida actual está por encima del nuevo máximo, recortarla
      playerHp = clamp(playerHp, 0, playerHpMax);
      activeBoost = null;
    }

    // Un único panel de controles persistente (abajo del todo)
    let boardMsg = null;

    function buildBoardEmbed() {
      return new EmbedBuilder()
        .setTitle("🌊 Mission: Foosha Sea Beast (Easy)")
        .setDescription(
          `${form ? `⚡ **Form:** ${form} (${formTurns} turns left)\n\n` : ""}` +
            `**Enemy HP:** ${enemy.hp}/${enemy.hpMax}\n` +
            `**Your HP:** ${playerHp}/${playerHpMax}\n` +
            `**Mastery:** ${mastery}\n` +
            `${immortalTurns > 0 ? `🛡️ **Immortal**: ${immortalTurns} turn(s) left\n` : ""}` +
            `\nChoose a category below.`
        )
        .setImage(enemy.gif)
        .setColor(form ? 0xff4d6d : 0x1e90ff);
    }

    function buildMainButtons() {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("menu_skills").setLabel("Skills").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("menu_haki").setLabel("Haki").setStyle(ButtonStyle.Secondary)
      );
      const transformSkill = (item.skills || []).find((s) => s.type === "transform");
      if (transformSkill && !form && formCooldown <= 0 && (transformSkill.unlockAt ?? 1) <= mastery) {
        row.addComponents(
          new ButtonBuilder().setCustomId("menu_transform").setLabel(transformSkill.name).setStyle(ButtonStyle.Danger)
        );
      }
      return [row];
    }

    async function postMenu(extraEmbeds = []) {
      const board = buildBoardEmbed();

      // Reenvía el panel y desactiva el anterior para que siempre quede al final
      try {
        if (boardMsg) {
          await boardMsg.edit({ components: [] }).catch(() => {});
        }
        boardMsg = await message.channel.send({
          embeds: [...extraEmbeds, board],
          components: buildMainButtons(),
        });
      } catch {}
    }

    // === Menú de skills: EDITA el board, no envía mensaje nuevo ===
    async function postSkills() {
      const list = getCurrentSkills();
      if (!list.length) return message.channel.send("❌ No skills available.");

      const rows = [];
      chunk(list, 5).forEach((group, gi) => {
        const row = new ActionRowBuilder();
        group.forEach((s, i) => {
          const idx = gi * 5 + i;
          const label = cd[s.name] > 0 ? `${s.name} (CD ${cd[s.name]})` : s.name;
          row.addComponents(
            new ButtonBuilder().setCustomId(`skill_${idx}`).setLabel(label).setStyle(ButtonStyle.Primary)
          );
        });
        rows.push(row);
      });
      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("back_to_menu").setLabel("Back").setStyle(ButtonStyle.Secondary)
        )
      );

      const header = new EmbedBuilder()
        .setTitle("📜 Choose a Skill")
        .setDescription("Select a skill to use.")
        .setColor(0x00aaff);

      try {
        await boardMsg.edit({ embeds: [header], components: rows });
      } catch {}
    }

    // === Menú de Haki: EDITA el board, no envía mensaje nuevo ===
    async function postHaki() {
      const row = new ActionRowBuilder();
      let hasAny = false;

      if (p.hakis?.buso) {
        hasAny = true;
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("haki_buso")
            .setLabel(busoOn ? "Buso (ON)" : "Buso (Activate)")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!!busoOn)
        );
      }
      if (p.hakis?.ken && !kenUsedOnce && kenCharges === 0) {
        hasAny = true;
        row.addComponents(
          new ButtonBuilder().setCustomId("haki_ken").setLabel("Ken (Activate 3-dodge)").setStyle(ButtonStyle.Secondary)
        );
      }
      if (p.hakis?.hao && !haoUsed) {
        hasAny = true;
        row.addComponents(new ButtonBuilder().setCustomId("haki_hao").setLabel("Haoshoku").setStyle(ButtonStyle.Secondary));
      }
      if (!hasAny) return message.channel.send("❌ No Haki available right now.");

      const rows = [row];
      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("back_to_menu").setLabel("Back").setStyle(ButtonStyle.Secondary)
        )
      );

      const header = new EmbedBuilder()
        .setTitle("✨ Haki")
        .setDescription("Choose a Haki ability to use.")
        .setColor(0x9900ff);

      try {
        await boardMsg.edit({ embeds: [header], components: rows });
      } catch {}
    }

    // ====== aplicar efectos ON-HIT al enemigo ======
    function applyOnHitEffects(skill) {
      const eff = skill.effects?.onHit;
      if (!eff || !eff.type) return;

      if (!roll(eff.chance ?? 100)) return; // probabilidad de aplicar

      switch (eff.type) {
        case "frozen": {
          const turns = Math.max(1, eff.stunTurns || 1);
          enemy.frozenTurns = Math.max(enemy.frozenTurns, turns);
          // “no se acumulan” las chances de fallar la próxima acción: mantener el mayor
          const nf = Math.max(0, eff.nextFailChance || 0);
          enemy.failNextChance = Math.max(enemy.failNextChance, nf);
          break;
        }
        case "bleed": {
          enemy.bleed = true;
          enemy.bleedPct = Math.max(enemy.bleedPct || 0, eff.pct || 10);
          // 30% permanente de fallar (no acumulable; tomamos el mayor)
          enemy.failPermChance = Math.max(enemy.failPermChance || 0, eff.permFailChance || 30);
          break;
        }
        case "poison": {
          enemy.poison = true;
          enemy.poisonPct = Math.max(enemy.poisonPct || 0, eff.pct || 20);
          break;
        }
        case "burn": {
          enemy.burn = true;
          enemy.burnPct = Math.max(enemy.burnPct || 0, eff.pct || 15);
          break;
        }
        case "knockout": {
          enemy.knockedTurns = Math.max(enemy.knockedTurns, 1);
          // +30% al siguiente ataque del jugador
          nextAttackBonusPct = Math.max(nextAttackBonusPct, eff.nextAttackBonus || 30);
          break;
        }
      }
    }

    // ====== acción de skill del jugador ======
    async function usePlayerSkill(skill) {
      const name = skill.name;

      // curas puras (% HP máx)
      if (skill.type === "heal") {
        const amt = Math.floor(playerHpMax * pctVal(skill.healPercent ?? 0));
        const prev = playerHp;
        playerHp = clamp(playerHp + amt, 0, playerHpMax);
        if (skill.cooldown) cd[name] = skill.cooldown;

        const ev = new EmbedBuilder()
          .setTitle(`${name} — Healing`)
          .setDescription(`❤️ Healed **${playerHp - prev}** HP.`)
          .setImage(skill.gif || null)
          .setColor(0x00c853);
        await message.channel.send({ embeds: [ev] });
        return;
      }

      // inmortal (Phoenix)
      if (skill.type === "immortal") {
        immortalTurns = Math.max(immortalTurns, skill.immortalTurns || 2);
        if (skill.cooldown) cd[name] = skill.cooldown;

        const ev = new EmbedBuilder()
          .setTitle(`${name} — Immortal`)
          .setDescription(`🛡️ You become **Immortal** for **${immortalTurns}** turn(s).`)
          .setImage(skill.gif || null)
          .setColor(0x00e5ff);
        await message.channel.send({ embeds: [ev] });
        return;
      }

      // daño (con hits) + lifesteal opcional
      let dmg = Math.floor(playerAtk * (skill.multiplier ?? 1));
      if (skill.hits) {
        dmg = 0;
        for (let i = 0; i < skill.hits; i++) dmg += Math.floor(playerAtk * (skill.multiplier ?? 1));
      }

      // bonus por knockout (siguiente golpe +30%)
      if (nextAttackBonusPct > 0) {
        dmg = Math.floor(dmg * (1 + nextAttackBonusPct / 100));
        nextAttackBonusPct = 0; // consumir
      }

      dmg = damageWithBonuses(dmg, busoOn);
      enemy.hp = Math.max(0, enemy.hp - dmg);

      // lifesteal/curación % adicional
      let healedNow = 0;
      if (skill.healPercent) {
        const heal = Math.floor(playerHpMax * pctVal(skill.healPercent));
        const prev = playerHp;
        playerHp = clamp(playerHp + heal, 0, playerHpMax);
        healedNow = playerHp - prev;
      }

      if (skill.cooldown) cd[name] = skill.cooldown;

      const ev = new EmbedBuilder()
        .setTitle(`${item.name} used ${name}!`)
        .setDescription(`💥 Dealt **${dmg}** damage.` + (healedNow ? `\n❤️ Healed **${healedNow}** HP.` : ""))
        .setImage(skill.gif || null)
        .setColor(0xff4500);
      await message.channel.send({ embeds: [ev] });

      // aplicar efectos on-hit (congelar, etc.)
      applyOnHitEffects(skill);

      // fin de forma (ej. Phoenix Charge Kick)
      if (skill.endForm && form) {
        form = null;
        formTurns = 0;

        // quitar boosts de forma al terminar prematuramente
        removeTransformBoostIfAny();

        // aplica el cooldown correcto de la transformación
        const cdToApply =
          typeof skill.forceFormCooldown === "number"
            ? skill.forceFormCooldown
            : transformBaseCooldown || 1;

        formCooldown = Math.max(formCooldown, cdToApply);
        await message.channel.send(
          `💨 Transformation ended (Cooldown ${cdToApply} turn${cdToApply > 1 ? "s" : ""}).`
        );
      }
    }

    // ===== DOTs y estados del enemigo al **inicio** de su turno =====
    async function applyEnemyStartOfTurnEffects() {
      // Daños por turno
      let dotMsg = "";
      const before = enemy.hp;

      if (enemy.bleed)  enemy.hp = Math.max(0, enemy.hp - Math.floor(enemy.hpMax * (enemy.bleedPct  / 100)));
      if (enemy.poison) enemy.hp = Math.max(0, enemy.hp - Math.floor(enemy.hpMax * (enemy.poisonPct / 100)));
      if (enemy.burn)   enemy.hp = Math.max(0, enemy.hp - Math.floor(enemy.hpMax * (enemy.burnPct   / 100)));

      const dotDmg = before - enemy.hp;
      if (dotDmg > 0) {
        dotMsg += `🩸 DoT dealt **${dotDmg}** damage this turn.\n`;
      }

      if (dotMsg) {
        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setTitle("🩹 Status Effects")
            .setDescription(dotMsg + `Enemy HP: ${enemy.hp}/${enemy.hpMax}`)
            .setColor(0xcc3333)]
        });
      }

      // Si murió por DoT
      if (enemy.hp <= 0) {
        return true; // muerto
      }

      return false;
    }

    // ===== turno del enemigo =====
    async function enemyTurn() {
      // DoTs al empezar turno enemigo
      if (await applyEnemyStartOfTurnEffects()) {
        // victoria por DoT
        p.belly = (p.belly || 0) + 100;
        p._msgCount = (p._msgCount ?? 0) + 30;

        let cur = getItemMastery(p, starter.type, starter.name);
        let leveled = false;
        while (p._msgCount >= 100 && cur < 100) {
          p._msgCount -= 100;
          cur++;
          leveled = true;
        }
        setItemMastery(p, starter.type, starter.name, cur);
        savePlayers(players);

        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🏆 Mission Complete!")
              .setDescription(`💰 +100 Belly\n🧪 +30 EXP messages`)
              .setColor(0xffd700),
          ],
        });
        if (leveled) {
          const totalBonus = (cur - 1) * 2;
          await message.channel.send(
            `🎉 Mastery Level Up! Now **${cur}**\n📈 +2% stats per level\n⚡ Total bonus: **+${totalBonus}%** power.`
          );
        }
        // no llamamos collector.stop desde aquí, dejamos que el flujo normal cierre al final
        return;
      }

      // Stuns por estados (frozen / knocked) o explícito
      if (enemy.stunTurns > 0 || enemy.frozenTurns > 0 || enemy.knockedTurns > 0) {
        if (enemy.stunTurns > 0) enemy.stunTurns--;
        if (enemy.frozenTurns > 0) enemy.frozenTurns--;
        if (enemy.knockedTurns > 0) enemy.knockedTurns--;

        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚡ Enemy is stunned!")
              .setDescription(`Enemy loses this turn.`)
              .setColor(0xff0000),
          ],
        });
        tickEndOfEnemyTurn();
        return postMenu();
      }

      // Si el jugador es LOGIA y el enemigo NO tiene Buso → 0 daño
      if (item.isLogia) {
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${enemy.name} attacks!`)
              .setDescription(`🌀 **Logia immunity!** You take **0** damage.`)
              .setColor(0x00a1ff),
          ],
        });
        tickEndOfEnemyTurn();
        return postMenu();
      }

      // Jet Evasion (pasiva) mientras la forma esté activa
      let dodgeChance = 0;
      if (form && Array.isArray(item.passives)) {
        const pv = item.passives.find(x => x.type === "dodgeChanceOnForm" && x.form === form);
        if (pv) dodgeChance = Math.max(0, pv.chance || 0);
      }
      if (dodgeChance > 0 && roll(dodgeChance)) {
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${enemy.name} attacks!`)
              .setDescription(`💨 **Jet Evasion!** You dodged the attack.`)
              .setColor(0x00ffcc),
          ],
        });
        tickEndOfEnemyTurn();
        return postMenu();
      }

      // Fallo por efectos (primero el "próximo", luego el permanente)
      if (enemy.failNextChance > 0 && roll(enemy.failNextChance)) {
        enemy.failNextChance = 0; // consumir el efecto
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${enemy.name} attacks!`)
              .setDescription(`❌ The attack **failed** due to status effect.`)
              .setColor(0x999999),
          ],
        });
        tickEndOfEnemyTurn();
        return postMenu();
      } else if (enemy.failPermChance > 0 && roll(enemy.failPermChance)) {
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${enemy.name} attacks!`)
              .setDescription(`❌ The attack **failed** due to bleeding.`)
              .setColor(0x999999),
          ],
        });
        tickEndOfEnemyTurn();
        return postMenu();
      }

      // Ken activo → esquiva
      if (kenCharges > 0) {
        kenCharges--;
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${enemy.name} attacks!`)
              .setDescription(`💨 **Dodged by Kenbunshoku!** (${3 - kenCharges}/3)`)
              .setColor(0x00ffcc),
          ],
        });
        tickEndOfEnemyTurn();
        return postMenu();
      }

      // Immortal → 0 daño
      if (immortalTurns > 0) {
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${enemy.name} attacks!`)
              .setDescription(`🛡️ **Immortal!** You take **0** damage.`)
              .setColor(0x00e5ff),
          ],
        });
        tickEndOfEnemyTurn();
        return postMenu();
      }

      // daño normal (sin GIF aquí)
      const base = Math.max(1, Math.floor(enemy.atk * (0.8 + Math.random() * 0.6)));
      playerHp = Math.max(0, playerHp - base);
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${enemy.name} attacks!`)
            .setDescription(`You took **${base}** damage. HP: ${playerHp}/${playerHpMax}`)
            .setColor(0x8b0000),
        ],
      });

      if (playerHp <= 0) {
        await message.channel.send({
          embeds: [new EmbedBuilder().setTitle("💀 Mission Failed").setDescription("You were defeated...").setColor(0x2f4f4f)],
        });
        collector.stop("defeat");
        return;
      }

      tickEndOfEnemyTurn();
      return postMenu();
    }

    // ===== ticks =====
    function tickEndOfPlayerAction() {
      if (form) {
        formTurns--;
        if (formTurns <= 0) {
          form = null;
          // quitar boosts de forma al terminar naturalmente
          removeTransformBoostIfAny();

          // aplica el cooldown propio de la transformación (del item)
          formCooldown = Math.max(formCooldown, transformBaseCooldown || 1);
          message.channel.send(
            `💨 Transformation ended (Cooldown ${transformBaseCooldown} turn${transformBaseCooldown > 1 ? "s" : ""}).`
          );
        }
      } else if (formCooldown > 0) {
        formCooldown--;
      }
    }

    function tickEndOfEnemyTurn() {
      if (immortalTurns > 0) immortalTurns--;
      if (!form && formCooldown > 0) formCooldown--;
      decCooldowns();
    }

    // ===== primer tablero =====
    await postMenu();

    // Un solo collector a nivel de canal, filtrando por autor
    const collector = message.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === userId,
      time: 180000,
    });

    collector.on("collect", async (interaction) => {
      try {
        await interaction.deferUpdate();
      } catch {}

      if (interaction.customId === "menu_skills") return postSkills();
      if (interaction.customId === "menu_haki") return postHaki();
      if (interaction.customId === "back_to_menu") return postMenu();

      // transform — consume turno y pasa al enemigo
      if (interaction.customId === "menu_transform") {
        const t = (item.skills || []).find((s) => s.type === "transform");
        if (!t) return message.channel.send("❌ This item has no transformation.");
        if (form) return message.channel.send("⚡ Already transformed!");
        if ((t.unlockAt ?? 1) > mastery) return message.channel.send("❌ Transformation not unlocked yet.");
        if (formCooldown > 0) return message.channel.send(`⌛ You must wait ${formCooldown} more turn(s).`);

        form = t.form || "gear2";
        formTurns = t.duration || 5;
        // guardamos el cooldown del item (no se aplica aún)
        transformBaseCooldown = t.cooldown ?? 1;

        // aplicar boosts de forma si están definidos en items.transformBoosts
        applyTransformBoostIfAny(form);

        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`⚡ ${t.name} Activated!`)
              .setDescription(`Power up for ${formTurns} turns!`)
              .setImage(t.gif || null)
              .setColor(0xff006e),
          ],
        });

        tickEndOfPlayerAction();
        return enemyTurn();
      }

      // usar skill
      if (interaction.customId.startsWith("skill_")) {
        const idx = parseInt(interaction.customId.split("_")[1], 10);
        const list = getCurrentSkills();
        const chosen = list[idx];
        if (!chosen) return;

        await usePlayerSkill(chosen);

        // victoria
        if (enemy.hp <= 0) {
          // recompensas
          p.belly = (p.belly || 0) + 100;
          p._msgCount = (p._msgCount ?? 0) + 30;

          let cur = getItemMastery(p, starter.type, starter.name);
          let leveled = false;
          while (p._msgCount >= 100 && cur < 100) {
            p._msgCount -= 100;
            cur++;
            leveled = true;
          }
          setItemMastery(p, starter.type, starter.name, cur);
          savePlayers(players);

          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("🏆 Mission Complete!")
                .setDescription(`💰 +100 Belly\n🧪 +30 EXP messages`)
                .setColor(0xffd700),
            ],
          });
          if (leveled) {
            const totalBonus = (cur - 1) * 2;
            await message.channel.send(
              `🎉 Mastery Level Up! Now **${cur}**\n📈 +2% stats per level\n⚡ Total bonus: **+${totalBonus}%** power.`
            );
          }
          collector.stop("victory");
          return;
        }

        // fin de mi acción → tick y turno enemigo
        tickEndOfPlayerAction();
        return enemyTurn();
      }

      // HAKI
      if (interaction.customId.startsWith("haki_")) {
        const key = interaction.customId.replace("haki_", "");
        if (key === "buso") {
          if (!p.hakis?.buso) return;
          if (busoOn) return message.channel.send("🖤 Buso is already ON.");
          busoOn = true;
          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("🖤 Buso Haki Activated!")
                .setDescription("+5% damage & can hit Logias.")
                .setImage(hakis.buso.gif)
                .setColor(0x222222),
            ],
          });
          tickEndOfPlayerAction();
          return enemyTurn();
        }
        if (key === "ken") {
          if (!p.hakis?.ken) return;
          if (kenUsedOnce || kenCharges > 0) {
            await message.channel.send("❌ Ken already active or used.");
          } else {
            kenUsedOnce = true;
            kenCharges = 3;
            await message.channel.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle("👁️ Kenbunshoku Haki Activated!")
                  .setDescription("You will dodge the next **3** attacks.")
                  .setImage(hakis.ken.gif)
                  .setColor(0x00ffcc),
              ],
            });
          }
          tickEndOfPlayerAction();
          return enemyTurn();
        }
        if (key === "hao") {
          if (!p.hakis?.hao) return;
          if (haoUsed) {
            await message.channel.send("❌ You already used Haoshoku in this mission.");
          } else {
            haoUsed = true;
            enemy.stunTurns += 2;
            await message.channel.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle("⚡ Haoshoku Haki!")
                  .setDescription(`Enemy is **stunned for 2 turns**.`)
                  .setImage(hakis.hao.gif)
                  .setColor(0xff0000),
              ],
            });
          }
          tickEndOfPlayerAction();
          return enemyTurn();
        }
      }
    });

    collector.on("end", async (_c, reason) => {
      try {
        if (boardMsg) await boardMsg.edit({ components: [] });
      } catch {}
      const show = reason === "time" || reason === "idle";
      if (show) {
        await message.channel.send("⌛ Mission ended.");
      }
      activeMissions.delete(userId);
    });
  },
};
