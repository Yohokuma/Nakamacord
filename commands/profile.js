// commands/profile.js
const { EmbedBuilder } = require("discord.js");
const { loadPlayers } = require("../db/players");

module.exports = {
  name: "profile",
  description: "Show your player profile.",
  execute(message) {
    const players = loadPlayers();
    const player = players[message.author.id];

    if (!player) {
      return message.reply("❌ You must start first with `n!start`.");
    }

    const equippedFruit = player.equipped?.fruit || "—";
    const equippedWeapon = player.equipped?.weapon || "—";

    // Mastery dinámico según activeSlot
    let masteryText = "—";
    if (player.activeSlot === "fruit" && equippedFruit !== "—") {
      masteryText = `${equippedFruit}: ${player.masteries.fruits?.[equippedFruit] || 1}`;
    } else if (player.activeSlot === "weapon" && equippedWeapon !== "—") {
      masteryText = `${equippedWeapon}: ${player.masteries.weapons?.[equippedWeapon] || 1}`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🌟 ${message.author.username}'s Profile`)
      .setColor(0xf1c40f)
      .setDescription(`💰 **Belly**: ${player.belly || 0}`)
      .addFields(
        { name: "🍎 Equipped Fruit", value: equippedFruit, inline: true },
        { name: "⚔️ Equipped Weapon", value: equippedWeapon, inline: true },
        { name: "📈 Mastery", value: masteryText, inline: false }
      )
      .setFooter({ text: "NakamaCord RPG" });

    message.channel.send({ embeds: [embed] });
  },
};
