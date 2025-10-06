// commands/skills.js
const { EmbedBuilder } = require("discord.js");
const { loadPlayers, getItemMastery } = require("../db/players");
const { findItem } = require("../db/itemsHelper");

module.exports = {
  name: "skills",
  description: "Show skills for your equipped item (or for a given item).",
  async execute(message, args) {
    const players = loadPlayers();
    const p = players[message.author.id];
    if (!p) return message.reply("❌ You must start first with `n!start`.");

    // 1) Determinar ítem objetivo: arg (alias o nombre) o el equipado del slot activo
    let targetType = null;
    let targetName = null;

    if (args.length) {
      // Si el usuario escribe un nombre/alias, buscamos en items.js
      const raw = args.join(" ");
      const item = findItem(raw);
      if (!item) {
        return message.reply("❌ Could not find that item in database.");
      }
      targetType = item.type;      // 'fruit' | 'weapon'
      targetName = item.name;      // nombre oficial
    } else {
      // Sin args → ítem equipado del slot activo
      if (p.activeSlot === "fruit" && p.equipped?.fruit) {
        targetType = "fruit";
        targetName = p.equipped.fruit;
      } else if (p.activeSlot === "weapon" && p.equipped?.weapon) {
        targetType = "weapon";
        targetName = p.equipped.weapon;
      } else {
        return message.reply("❌ Equip something first with `n!equip` or use `n!skills <item>`.");
      }
    }

    // 2) Consultar item completo en items.js
    const item = findItem(targetName);
    if (!item) return message.reply("❌ Could not find that item in items database.");
    const skills = Array.isArray(item.skills) ? item.skills : [];
    if (!skills.length) {
      return message.reply("ℹ️ This item has no skills configured yet.");
    }

    // 3) Mastery actual del jugador para ese ítem
    const mastery = getItemMastery(p, targetType, item.name);

    // 4) Separar por tipo/forma
    const transform = skills.find(s => s.type === "transform");
    const baseSkills = skills.filter(s => !s.form && s.type !== "transform");
    // agrupar por form
    const formsMap = {};
    for (const s of skills) {
      if (s.form) {
        if (!formsMap[s.form]) formsMap[s.form] = [];
        formsMap[s.form].push(s);
      }
    }

    // Helper: línea por skill con estado de unlock
    const fmt = (s) => {
      const need = (s.unlockAt ?? 1);
      const unlocked = mastery >= need;
      const parts = [];
      parts.push(`${unlocked ? "✅" : "🔒"} **${s.name}**`);
      parts.push(`(req. ${need})`);
      if (!unlocked && mastery < need) parts.push(`• ${need - mastery} mastery to unlock`);
      if (s.multiplier) parts.push(`• x${s.multiplier}`);
      if (s.hits) parts.push(`• ${s.hits} hits`);
      return parts.join(" ");
    };

    // 5) Construir embed
    const embed = new EmbedBuilder()
      .setTitle(`📜 Skills — ${item.name}`)
      .setColor(0x5865f2)
      .setDescription(
        `Type: **${item.type}** • Rarity: **${item.rarity || "—"}**\n` +
        `Your Mastery: **${mastery} / 100**`
      );

    if (baseSkills.length) {
      embed.addFields({
        name: "Base Form",
        value: baseSkills.map(fmt).join("\n").slice(0, 1024),
        inline: false
      });
    }

    if (transform) {
      const need = transform.unlockAt ?? 1;
      const unlocked = mastery >= need;
      const tLine = `${unlocked ? "✅" : "🔒"} **${transform.name}**` +
                    ` (req. ${need})` +
                    (unlocked ? ` • duration: ${transform.duration || 0} • cd: ${transform.cooldown || 0}` :
                      ` • ${Math.max(0, need - mastery)} mastery to unlock`);
      embed.addFields({
        name: "Transformation",
        value: tLine,
        inline: false
      });
    }

    const formKeys = Object.keys(formsMap);
    for (const fk of formKeys) {
      const arr = formsMap[fk] || [];
      // Orden visual por unlockAt
      arr.sort((a, b) => (a.unlockAt ?? 1) - (b.unlockAt ?? 1));
      embed.addFields({
        name: `Form: ${fk}`,
        value: arr.map(fmt).join("\n").slice(0, 1024),
        inline: false
      });
    }

    // Nota para el usuario
    embed.addFields({
      name: "ℹ️ Note",
      value: "Unlocks are based on your **item mastery**. You gain mastery via missions and chat EXP.",
      inline: false
    });

    return message.channel.send({ embeds: [embed] });
  },
};
