const { EmbedBuilder } = require("discord.js");
const items = require("../db/items");

module.exports = {
  name: "start",
  description: "Start your One Piece adventure!",
  async execute(message) {
    const user = message.author;

    // Construye la lista desde items.js (solo starters)
    const starters = {
      ...items.fruits,
      ...items.weapons
    };

    let starterList = "";
    for (const [name, it] of Object.entries(starters)) {
      if (!it.starter) continue; // por si luego sumas ítems que no son starter
      const icon = it.type === "fruit" ? "🍏" : "🎯";
      starterList += `${icon} **${name}** (${it.rarity})\n` +
                     `   Stats: HP ${it.stats.hp} / ATK ${it.stats.attack} / SPD ${it.stats.speed}\n\n`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x1abc9c)
      .setTitle(`🏴‍☠️ Welcome aboard, ${user.username}!`)
      .setDescription(
        "Your adventure begins now.\n" +
        "Choose your starter item:\n\n" +
        starterList +
        "Type `n!choose <alias>` — por ejemplo: `n!choose bara`, o `n!choose ginga`."
      )
      .setImage("https://i.imgur.com/0XOXJZE.gif")
      .setFooter({ text: "One Piece Adventure • NakamaCord" });

    await message.channel.send({ embeds: [embed] });
  },
};
