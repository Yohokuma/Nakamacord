const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType,
} = require("discord.js");

const { findItem } = require("../db/itemsHelper");
const {
  loadPlayers, savePlayers, getItemMastery, setItemMastery, getEffectiveStats
} = require("../db/players");
const { getMission } = require("../missions/registry");
const npc = require("../bosses/npc");
const hakis = require("../db/hakis");

const clamp  = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pctVal = (v) => (v > 1 ? v / 100 : v);
const roll   = (p) => Math.random() * 100 < (p || 0);
const damageWithBonuses = (base, busoOn) =>
  Math.max(1, Math.floor(base * (busoOn ? 1.05 : 1)));

module.exports = {
  name: "story",
  description: "Play a story mission. Usage: n!story <id>",
  async execute(message, args) {
    const id = parseInt(args[0], 10);
    if (!id || isNaN(id)) {
      return message.reply("⚠️ Use: `n!story <id>` (e.g., `n!story 1`).");
    }

    const mission = getMission(id);
    if (!mission) return message.reply("❌ Mission not found.");

    // === player
    const players = loadPlayers();
    const p = players[message.author.id];
    if (!p) return message.reply("❌ First run `n!start`.");

    // === progression / lock
    p.storyProgress = p.storyProgress ?? 0;
    if (!mission.optional) {
      if (id > p.storyProgress + 1) {
        return message.reply(
          `🔒 Mission locked. First complete **n!story ${p.storyProgress + 1}**.`
        );
      }
    } else {
      if (typeof mission.minProgress === "number" && p.storyProgress < mission.minProgress) {
        return message.reply("🔒 This encounter appears later in the story.");
      }
    }

    // equipped
    let starter = null;
    if (p.activeSlot === "fruit" && p.equipped?.fruit)
      starter = { type: "fruit", name: p.equipped.fruit };
    else if (p.activeSlot === "weapon" && p.equipped?.weapon)
      starter = { type: "weapon", name: p.equipped.weapon };
    if (!starter) return message.reply("❌ Equip something with `n!equip`.");

    const item = findItem(starter.name);
    if (!item) return message.reply("❌ Missing item data.");

    const baseStats = item.stats || { hp: 80, attack: 20, speed: 10 };
    const stats = getEffectiveStats(p, starter.type, starter.name, baseStats);

    // ===== player state
    const baseHpMax = stats.hp;
    const baseAtk   = stats.attack;

    let hpMax = stats.hp;
    let hp    = stats.hp;
    let atk   = stats.attack;
    let mastery = stats.mastery ?? 1;

    // transform
    let activeBoost = null;
    let form = null, formTurns = 0, formCooldown = 0, transformBaseCooldown = 1;

    // next-attack bonus
    let nextAttackBonusPct = 0;

    // haki/states
    let busoOn = false, kenUsedOnce = false, kenCharges = 0, immortalTurns = 0, haoUsed = false;

    // legacy DoTs on player
    let bleed=false, bleedPct=10, poison=false, poisonPct=20, burn=false, burnPct=15;

    // fail chances
    let failNextChance = 0, failPermChance = 0;

    // cooldowns & tags
    const cd = Object.create(null);
    const usedTags = new Set();

    // ===== boss
    const boss = npc.buildBossInstance(mission.boss);

    // ===== helpers
    const decCooldowns = () => { for (const k of Object.keys(cd)) if (cd[k] > 0) cd[k]--; };
    const canUseSkill  = (s) => (s.unlockAt ?? 1) <= mastery && s.type !== "transform" && !(cd[s.name] > 0);
    const getCurrentSkills = () => {
      const all = item.skills || [];
      const pool = form ? all.filter(s => s.form === form) : all.filter(s => !s.form);
      return pool.filter(canUseSkill);
    };

    function applyTransformBoostIfAny(formName){
      if (!item.transformBoosts || activeBoost) return;
      const b = item.transformBoosts.find(x => x.form === formName);
      if (!b) return;
      const extraHp  = Math.floor(baseHpMax * (Math.max(0,b.hpPercent||0)/100));
      const extraAtk = Math.floor(baseAtk   * (Math.max(0,b.atkPercent||0)/100));
      hpMax = baseHpMax + extraHp;
      atk   = baseAtk   + extraAtk;
      hp    = clamp(hp + extraHp, 0, hpMax);
      activeBoost = { form: formName };
    }
    function removeTransformBoostIfAny(){
      if (!activeBoost) return;
      hpMax = baseHpMax;
      atk   = baseAtk;
      hp    = clamp(hp, 0, hpMax);
      activeBoost = null;
    }

    // ===== persistent UI (delete old board/menus to avoid dead buttons)
    let boardMsg = null;
    let menuMsg  = null;
    let acting   = false;

    // real player stun
    let playerStunTurns = 0;

    const removeBoard = async () => { try { if (boardMsg) await boardMsg.delete(); } catch {} boardMsg = null; };
    const removeMenu  = async () => { try { if (menuMsg)  await menuMsg.delete();  } catch {} menuMsg  = null; };
    const unlockTurn  = () => { acting = false; };

    const buildBoardEmbed = () => new EmbedBuilder()
      .setTitle(`📖 ${mission.optional ? "Side" : "Story"} ${id} — ${mission.title}`)
      .setDescription(
        `**${boss.name} HP:** ${boss.hp}/${boss.hpMax}\n` +
        `**Your HP:** ${hp}/${hpMax}\n` +
        (form ? `\n⚡ Form: **${form}** (${formTurns} turns left)\n` : "") +
        (immortalTurns > 0 ? `\n🛡️ **Immortal**: ${immortalTurns} turn(s) left\n` : "") +
        `\nChoose an option:`
      )
      .setImage(boss.gif || null)
      .setColor(form ? 0xff4d6d : 0x1e90ff);

    const buildMainButtons = () => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("menu_skills").setLabel("Skills").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("menu_haki").setLabel("Haki").setStyle(ButtonStyle.Secondary)
      );
      const t = (item.skills || []).find(s => s.type === "transform");
      if (t && !form && formCooldown <= 0 && (t.unlockAt ?? 1) <= mastery) {
        row.addComponents(new ButtonBuilder().setCustomId("menu_transform").setLabel(t.name).setStyle(ButtonStyle.Danger));
      }
      return [row];
    };

    const postMenu = async (extraEmbeds = []) => {
      await removeBoard(); await removeMenu();
      boardMsg = await message.channel.send({ embeds: [...extraEmbeds, buildBoardEmbed()], components: buildMainButtons() });
      unlockTurn();
    };

    const openMenu = async (embed, rows) => {
      await removeMenu();
      menuMsg = await message.channel.send({ embeds: [embed], components: [...rows, new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("back_to_menu").setLabel("Back").setStyle(ButtonStyle.Secondary)
      )]});
    };

    const postSkills = async () => {
      const list = getCurrentSkills();
      if (!list.length) return message.channel.send("❌ No skills available.");
      const rows = [];
      for (let i=0;i<list.length;i+=5){
        const row = new ActionRowBuilder();
        list.slice(i,i+5).forEach((s, j)=>{
          const idx = i + j;
          const left = cd[s.name] || 0;
          const label = left>0 ? `${s.name} (CD ${left})` : s.name;
          row.addComponents(new ButtonBuilder().setCustomId(`skill_${idx}`).setLabel(label).setStyle(ButtonStyle.Primary));
        });
        rows.push(row);
      }
      await openMenu(new EmbedBuilder().setTitle("📜 Choose a Skill").setColor(0x00aaff), rows);
    };

    const postHaki = async () => {
      const row = new ActionRowBuilder(); let any=false;
      if (p.hakis?.buso){
        any=true;
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("haki_buso")
            .setLabel(busoOn ? "Buso (ON)" : "Buso (Activate)")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!!busoOn)
        );
      }
      if (p.hakis?.ken && !kenUsedOnce && kenCharges===0){
        any=true;
        row.addComponents(new ButtonBuilder().setCustomId("haki_ken").setLabel("Ken (Activate 3-dodge)").setStyle(ButtonStyle.Secondary));
      }
      if (p.hakis?.hao && !haoUsed){
        any=true;
        row.addComponents(new ButtonBuilder().setCustomId("haki_hao").setLabel("Haoshoku").setStyle(ButtonStyle.Secondary));
      }
      if (!any) return message.channel.send("❌ No Haki available right now.");
      await openMenu(new EmbedBuilder().setTitle("✨ Haki").setColor(0x9900ff), [row]);
    };

    // ===== on-hit effects (Electrified banner only on first application)
    async function applyOnHitEffects(skill){
      const raw = skill.effects?.onHit;
      if (!raw) return;
      const list = Array.isArray(raw) ? raw : [raw];

      for (const eff of list) {
        if (!roll(eff.chance ?? 100)) continue;

        if (eff.status === "electrified") {
          const wasElec = !!boss.electrified;
          boss.electrified = true;
          boss.electrifiedPct = Math.max(boss.electrifiedPct || 0, eff.pct || 12);
          if (!wasElec) {
            await message.channel.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle("⚡ Electrified")
                  .setDescription("Lose **10% HP** per turn. **30%** chance to be paralyzed each turn.")
                  .setColor(0xf5b642)
              ]
            });
          }
          continue;
        }

        if (eff.type==="frozen"){
          const turns = Math.max(1, eff.stunTurns||1);
          boss.frozenTurns = Math.max(boss.frozenTurns, turns);
        } else if (eff.type==="bleed"){
          boss.bleed = true; boss.bleedPct = Math.max(boss.bleedPct||0, eff.pct||10);
        } else if (eff.type==="poison"){
          boss.poison = true; boss.poisonPct = Math.max(boss.poisonPct||0, eff.pct||20);
        } else if (eff.type==="burn"){
          boss.burn = true; boss.burnPct = Math.max(boss.burnPct||0, eff.pct||15);
        } else if (eff.type==="knockout"){
          boss.knockedTurns = Math.max(boss.knockedTurns, 1);
          nextAttackBonusPct = Math.max(nextAttackBonusPct||0, eff.nextAttackBonus||30);
        }
      }
    }

    // ===== ROOM first
    const roomOnStart = (item.passives || []).find(x => x.type === "roomOnStart");
    if (roomOnStart) {
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("ROOM")
            .setDescription("The operating theater expands.")
            .setImage(roomOnStart.gif || null)
            .setColor(0x00e5ff)
        ]
      });
    }

    // ===== initial board
    await postMenu();

    // ===== boss turn
    async function bossTurn(){
      // DoTs (silent)
      const { dead } = npc.applyBossStartOfTurnDots(boss);
      if (dead) return;

      npc.tickBossCooldowns(boss);

      // Stunned boss
      if (boss.knockedTurns>0 || boss.frozenTurns>0){
        if (boss.knockedTurns>0) boss.knockedTurns--;
        if (boss.frozenTurns>0) boss.frozenTurns--;
        await message.channel.send({
          embeds:[ new EmbedBuilder()
            .setTitle("⚡ Boss is stunned!")
            .setDescription("He loses this turn.")
            .setColor(0xff0000) ]
        });
        endEnemyTick(); return postMenu();
      }

      // Shambles passive (dodge)
      const shambles = (item.passives || []).find(x => x.type === "dodgeShambles");
      if (shambles && roll(shambles.chance || 0)) {
        await message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("💫 Shambles!")
              .setDescription("You **dodged** the incoming attack by swapping positions inside ROOM.")
              .setImage(shambles.gif || null)
              .setColor(0x00e5ff)
          ]
        });
        endEnemyTick(); return postMenu();
      }

      // Boss action
      const res = npc.applyBossAbilityOnPlayer(
        boss,
        { id: message.author.id, hp, hpMax, immortalTurns, kenCharges, isLogia: !!item.isLogia },
        { message }
      );

      // update player state
      if (res.type === "damage" || res.type === "basic") {
        if (typeof res.playerHpAfter === "number") hp = Math.max(0, res.playerHpAfter);
        else if (typeof res.hpAfter === "number")    hp = Math.max(0, res.hpAfter);
      } else if (res.type === "dodge") {
        kenCharges = Math.max(0, kenCharges - 1);
      } else if (res.type === "blocked") {
        immortalTurns = Math.max(0, immortalTurns - 1);
      }
      // pick up any stun fields
      const stunTurns =
        res.stunPlayerTurns || res.knockedPlayerTurns || res.stunTurnsOnPlayer ||
        (res.playerStunned ? (res.stunTurns || 1) : 0) ||
        (res.type === "stun" ? (res.stunTurns || 1) : 0);
      if (stunTurns && stunTurns > 0) {
        playerStunTurns = Math.max(playerStunTurns, stunTurns);
      }

      await message.channel.send({ embeds:[res.embed] });

      if (hp <= 0){
        await message.channel.send({
          embeds:[ new EmbedBuilder()
            .setTitle("💀 Mission Failed")
            .setDescription("You were defeated...")
            .setColor(0x2f4f4f) ]
        });
        collector.stop("defeat"); return;
      }

      endEnemyTick(); return postMenu();
    }

    // ===== end-of-turn ticks
    function endPlayerTick(){
      if (form){
        formTurns--;
        if (formTurns <= 0){
          form = null; removeTransformBoostIfAny();
          formCooldown = Math.max(formCooldown, transformBaseCooldown || 1);
          message.channel.send(
            `💨 Transformation ended (Cooldown ${transformBaseCooldown} turn${transformBaseCooldown>1?"s":""}).`
          ).catch(()=>{});
        }
      } else if (formCooldown > 0){ formCooldown--; }
    }
    function endEnemyTick(){
      if (immortalTurns > 0) immortalTurns--;
      if (!form && formCooldown > 0) formCooldown--;
      decCooldowns();

      // Player DoTs (silent)
      if (bleed)  hp = Math.max(0, hp - Math.floor(hpMax * (bleedPct/100)));
      if (poison) hp = Math.max(0, hp - Math.floor(hpMax * (poisonPct/100)));
      if (burn)   hp = Math.max(0, hp - Math.floor(hpMax * (burnPct/100)));
    }

    /**
     * Use player skill.
     * Returns flow: 'menu' (stay same turn), 'boss' (consume turn), 'continue' (normal damage path, collector will progress).
     */
    async function usePlayerSkill(skill, interaction){
      const name = skill.name;

      // prerequisite — ephemeral only for the player, DO NOT consume turn
      if (skill.requiresTagUsed && !usedTags.has(skill.requiresTagUsed)) {
        if (interaction && interaction.followUp) {
          await interaction.followUp({
            content: "You must use **Shock Wille** first to use **Puncture Wille**.",
            ephemeral: true
          }).catch(()=>{});
        } else {
          await message.reply({
            content: "You must use **Shock Wille** first to use **Puncture Wille**.",
            ephemeral: true
          }).catch(()=>{});
        }
        return 'menu';
      }

      // fail chances — consume turn
      if (failNextChance > 0 && roll(failNextChance)) {
        failNextChance = 0;
        await message.channel.send({
          embeds:[ new EmbedBuilder()
            .setTitle(`${item.name} tried ${name}!`)
            .setDescription(`❌ The move **failed** due to status effect.`)
            .setColor(0x999999) ]
        });
        return 'boss';
      }
      if (failPermChance > 0 && roll(failPermChance)) {
        await message.channel.send({
          embeds:[ new EmbedBuilder()
            .setTitle(`${item.name} tried ${name}!`)
            .setDescription(`❌ The move **failed** due to bleeding.`)
            .setColor(0x999999) ]
        });
        return 'boss';
      }

      // heal — consume turn
      if (skill.type==="heal"){
        const amt = Math.floor(hpMax * pctVal(skill.healPercent ?? 0));
        const prev = hp; hp = clamp(hp + amt, 0, hpMax);
        const cool = (skill.cooldown ?? skill.cd) | 0; if (cool>0) cd[name]=cool;
        if (skill.tag) usedTags.add(skill.tag);
        await message.channel.send({
          embeds:[ new EmbedBuilder()
            .setTitle(`${name} — Healing`)
            .setDescription(`❤️ Healed **${hp - prev}** HP.`)
            .setImage(skill.gif || null)
            .setColor(0x00c853) ]
        });
        return 'boss';
      }

      // immortal — consume turn
      if (skill.type==="immortal"){
        immortalTurns = Math.max(immortalTurns, Math.max(1, skill.immortalTurns || 2));
        const cool = (skill.cooldown ?? skill.cd) | 0; if (cool>0) cd[name]=cool;
        if (skill.tag) usedTags.add(skill.tag);
        await message.channel.send({
          embeds:[ new EmbedBuilder()
            .setTitle(`${name} — Immortal`)
            .setDescription(`🛡️ You become **Immortal** for **${immortalTurns}** turn(s).`)
            .setImage(skill.gif || null)
            .setColor(0x00e5ff) ]
        });
        return 'boss';
      }

      // logia check — consume turn
      if (boss.isLogia && !busoOn){
        const cool = (skill.cooldown ?? skill.cd) | 0; if (cool>0) cd[name]=cool;
        if (skill.tag) usedTags.add(skill.tag);
        await message.channel.send({
          embeds:[ new EmbedBuilder()
            .setTitle(`${item.name} used ${name}!`)
            .setDescription(`🌀 **Logia immunity!** No damage (activate Buso).`)
            .setImage(skill.gif || null)
            .setColor(0x999999) ]
        });
        return 'boss';
      }

      // damage path — normal flow (collector will advance the turn)
      let dmg = Math.floor(atk * (skill.multiplier ?? 1));
      if (skill.hits){
        dmg = 0;
        for (let i=0;i<(skill.hits||0);i++) dmg += Math.floor(atk * (skill.multiplier ?? 1));
      }
      if (nextAttackBonusPct > 0){
        dmg = Math.floor(dmg * (1 + nextAttackBonusPct/100));
        nextAttackBonusPct = 0;
      }
      dmg = damageWithBonuses(dmg, busoOn);
      boss.hp = Math.max(0, boss.hp - dmg);

      // lifesteal
      let healedNow = 0;
      if (skill.healPercent){
        const heal = Math.floor(hpMax * pctVal(skill.healPercent));
        const prev = hp; hp = clamp(hp + heal, 0, hpMax); healedNow = hp - prev;
      }

      const cool = (skill.cooldown ?? skill.cd) | 0; if (cool>0) cd[name]=cool;

      await message.channel.send({
        embeds:[ new EmbedBuilder()
          .setTitle(`${item.name} used ${name}!`)
          .setDescription(`💥 Dealt **${dmg}** damage.` + (healedNow?`\n❤️ Healed **${healedNow}** HP.`:""))
          .setImage(skill.gif || null)
          .setColor(0xff4500) ]
      });

      // on-hit effects
      await applyOnHitEffects(skill);

      if (skill.tag) usedTags.add(skill.tag);

      if (skill.endForm && form){
        form = null; formTurns = 0; removeTransformBoostIfAny();
        const cdToApply = typeof skill.forceFormCooldown === "number" ? skill.forceFormCooldown : (transformBaseCooldown || 1);
        formCooldown = Math.max(formCooldown, cdToApply);
        await message.channel.send(
          `💨 Transformation ended (Cooldown ${cdToApply} turn${cdToApply>1?"s":""}).`
        );
      }

      return 'continue';
    }

    // ===== collector
    const collector = message.channel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === message.author.id,
      time: 180000,
    });

    collector.on("collect", async (interaction) => {
      try { await interaction.deferUpdate(); } catch {}
      if (acting) return;

      // real player stun (skip turn)
      if (playerStunTurns > 0) {
        playerStunTurns = Math.max(0, playerStunTurns - 1);
        await removeMenu(); await removeBoard();
        await message.channel.send({
          embeds:[ new EmbedBuilder()
            .setTitle("⚡ You are stunned!")
            .setDescription("You lose this turn.")
            .setColor(0xff0000) ]
        });
        endPlayerTick(); return bossTurn();
      }

      if (interaction.customId === "menu_skills") return postSkills();
      if (interaction.customId === "menu_haki")   return postHaki();
      if (interaction.customId === "back_to_menu") return postMenu();

      // acting from here
      acting = true;
      await removeMenu(); await removeBoard();

      if (interaction.customId === "menu_transform"){
        const t = (item.skills||[]).find(s=>s.type==="transform");
        if (!t) { acting=false; return message.channel.send("❌ This item has no transformation."); }
        if (form) { acting=false; return message.channel.send("⚡ Already transformed!"); }
        if ((t.unlockAt ?? 1) > mastery) { acting=false; return message.channel.send("❌ Transformation not unlocked yet."); }
        if (formCooldown > 0) { acting=false; return message.channel.send(`⌛ You must wait ${formCooldown} more turn(s).`); }
        form = t.form || "gear2"; formTurns = t.duration || 5; transformBaseCooldown = t.cooldown ?? 1;
        applyTransformBoostIfAny(form);
        await message.channel.send({
          embeds:[ new EmbedBuilder()
            .setTitle(`⚡ ${t.name} Activated!`)
            .setDescription(`Power up for ${formTurns} turns!`)
            .setImage(t.gif || null)
            .setColor(0xff006e) ]
        });
        endPlayerTick(); return bossTurn();
      }

      if (interaction.customId.startsWith("skill_")){
        const idx = parseInt(interaction.customId.split("_")[1], 10);
        const chosen = getCurrentSkills()[idx]; if (!chosen) { acting=false; return; }
        const flow = await usePlayerSkill(chosen, interaction);

        if (flow === 'menu') { acting = false; return postMenu(); }
        if (flow === 'boss') { endPlayerTick(); return bossTurn(); }

        // normal damage path:
        if (boss.hp <= 0){
          const belly = mission.rewards?.belly ?? 0;
          const masteryMsgs = mission.rewards?.masteryMsgs ?? 30;
          p.belly = (p.belly || 0) + belly;

          p._msgCount = (p._msgCount ?? 0) + masteryMsgs;
          let cur = getItemMastery(p, starter.type, starter.name);
          let leveled = false;
          while (p._msgCount >= 100 && cur < 100){ p._msgCount -= 100; cur++; leveled = true; }
          setItemMastery(p, starter.type, starter.name, cur);

          if (!mission.optional && id === p.storyProgress + 1) p.storyProgress = id;

          savePlayers(players);

          await message.channel.send({
            embeds:[ new EmbedBuilder()
              .setTitle("🏆 Mission Complete!")
              .setDescription(`💰 +${belly} Belly\n🧪 +${masteryMsgs} EXP messages`)
              .setColor(0xffd700) ]
          });
          if (leveled){
            const totalBonus = (cur - 1) * 2;
            await message.channel.send(
              `🎉 Mastery Level Up! Now **${cur}**\n📈 +2% stats per level\n⚡ Total bonus: **+${totalBonus}%** power.`
            );
          }
          collector.stop("victory"); return;
        }

        endPlayerTick(); return bossTurn();
      }

      if (interaction.customId.startsWith("haki_")){
        const key = interaction.customId.slice(5);
        if (key === "buso"){
          if (!p.hakis?.buso) { acting=false; return; }
          if (busoOn) { acting=false; return message.channel.send("🖤 Buso is already ON."); }
          busoOn = true;
          await message.channel.send({
            embeds:[ new EmbedBuilder()
              .setTitle("🖤 Buso Haki Activated!")
              .setDescription("+5% damage & can hit Logias.")
              .setImage(hakis.buso?.gif || null)
              .setColor(0x222222) ]
          });
          endPlayerTick(); return bossTurn();
        }
        if (key === "ken"){
          if (!p.hakis?.ken) { acting=false; return; }
          if (kenUsedOnce || kenCharges > 0) {
            await message.channel.send("❌ Ken already active or used.");
          } else {
            kenUsedOnce = true; kenCharges = 3;
            await message.channel.send({
              embeds:[ new EmbedBuilder()
                .setTitle("👁️ Kenbunshoku Haki Activated!")
                .setDescription("You will dodge the next **3** attacks.")
                .setImage(hakis.ken?.gif || null)
                .setColor(0x00ffcc) ]
            });
          }
          endPlayerTick(); return bossTurn();
        }
        if (key === "hao"){
          if (!p.hakis?.hao) { acting=false; return; }
          if (haoUsed) await message.channel.send("❌ You already used Haoshoku in this mission.");
          else {
            haoUsed = true; boss.knockedTurns += 2;
            await message.channel.send({
              embeds:[ new EmbedBuilder()
                .setTitle("⚡ Haoshoku Haki!")
                .setDescription(`${boss.name} is **stunned for 2 turns**.`)
                .setImage(hakis.hao?.gif || null)
                .setColor(0xff0000) ]
            });
          }
          endPlayerTick(); return bossTurn();
        }
      }
    });

    collector.on("end", async (_c, reason) => {
      await removeMenu(); await removeBoard();
      if (reason === "time" || reason === "idle") await message.channel.send("⌛ Mission ended.");
    });
  },
};
