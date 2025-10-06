const { EmbedBuilder } = require("discord.js");
const { loadPlayers, savePlayers, getItemMastery, setItemMastery } = require("../db/players");

module.exports = {
  name: "rainexp",
  description: "Special mission for testing: instantly max mastery to 100.",
  async execute(message) {
    const players = loadPlayers();
    const p = players[message.author.id];
    if (!p) return message.reply("❌ You must start first with `n!start`.");

    let starter = null;
    if (p.activeSlot === "fruit" && p.equipped?.fruit) {
      starter = { name: p.equipped.fruit, type: "fruit" };
    } else if (p.activeSlot === "weapon" && p.equipped?.weapon) {
      starter = { name: p.equipped.weapon, type: "weapon" };
    } else {
      return message.reply("❌ You must equip a fruit or weapon first with `n!equip`.");
    }

    const itemType = starter.type;
    const itemName = starter.name;

    // Obtener mastery actual
    let cur = getItemMastery(p, itemType, itemName);

    if (cur >= 100) {
      return message.reply(`✅ Your **${itemName}** is already at max Mastery (**100**).`);
    }

    // Subir directamente a 100
    setItemMastery(p, itemType, itemName, 100);

    // Reflejar también en snapshot starter si coincide
    if (p.starter && p.starter.name === itemName) {
      p.starter.stats.mastery = 100;
    }

    savePlayers(players);

    const embed = new EmbedBuilder()
      .setTitle("🌧️ Rain EXP Mission")
      .setDescription(
        `Your **${itemName}** has been boosted with infinite EXP!\n\n` +
        `🔥 Mastery is now **100**.`
      )
      .setColor(0x00ffcc)
      .setFooter({ text: "Testing Command • NakamaCord" });

    return message.channel.send({ embeds: [embed] });
  },
};
