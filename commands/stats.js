// commands/stats.js
const { EmbedBuilder } = require("discord.js");
const {
  loadPlayers,
  getEffectiveStats,
  getItemMastery,
} = require("../db/players");
const { findItem } = require("../db/itemsHelper");

module.exports = {
  name: "stats",
  description: "Show your current stats with mastery applied.",
  async execute(message) {
    const players = loadPlayers();
    const p = players[message.author.id];
    if (!p) return message.reply("❌ You must start first with `n!start`.");

    // Active slot & equipped item
    let slot = p.activeSlot;
    let equipped = null;
    if (slot === "fruit" && p.equipped?.fruit) {
      equipped = { type: "fruit", name: p.equipped.fruit };
    } else if (slot === "weapon" && p.equipped?.weapon) {
      equipped = { type: "weapon", name: p.equipped.weapon };
    }
    if (!equipped) {
      return message.reply("❌ You must equip something with `n!equip`.");
    }

    // Lookup item data to get its base stats (NOT p.starter)
    const item = findItem(equipped.name);
    if (!item) {
      return message.reply("❌ Could not find item data for your equipped item.");
    }

    // Effective stats (includes mastery bonus)
    const baseStats = item.stats || { hp: 80, attack: 20, speed: 10 };
    const stats = getEffectiveStats(p, equipped.type, equipped.name, baseStats);

    // Mastery & EXP
    const mastery = getItemMastery(p, equipped.type, equipped.name) ?? 1;
    const exp = p._msgCount ?? 0;

    // Belly
    const belly = p.belly || 0;

    // Haki unlocks (stored on the player profile)
    const hasBuso = !!p.hakis?.buso;
    const hasKen  = !!p.hakis?.ken;
    const hasHao  = !!p.hakis?.hao;

    const hakiLines = [
      `${hasBuso ? "✅" : "❌"} Buso Haki (Armament)`,
      `${hasKen  ? "✅" : "❌"} Kenbunshoku Haki (Observation)`,
      `${hasHao  ? "✅" : "❌"} Haoshoku Haki (Conqueror’s)`,
    ].join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats — ${message.author.username}`)
      .setDescription(
        `Active slot: **${equipped.type}**\n` +
        `Equipped: **${equipped.name}**${item.rarity ? ` (${item.rarity})` : ""}\n` +
        `Mastery: **${mastery} / 100**\n` +
        `EXP toward next: **${exp}/100**\n` +
        `💰 Belly: **${belly}**`
      )
      .addFields(
        { name: "❤️ HP", value: `${stats.hp}`, inline: true },
        { name: "⚔️ Attack", value: `${stats.attack}`, inline: true },
        { name: "💨 Speed", value: `${stats.speed}`, inline: true },
        { name: "🧠 Haki", value: hakiLines, inline: false }
      )
      .setColor(0x00bfff);

    await message.channel.send({ embeds: [embed] });
  },
};

