// commands/catchfruit.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { loadPlayers, savePlayers, ensurePlayer } = require("../db/players");
const { loadActiveSpawns, saveActiveSpawns } = require("../db/activeSpawns");

const MAX_DUPES = 2;

function countFruit(bag = [], name) {
  const n = name?.toLowerCase?.() || "";
  return bag.reduce((acc, it) => (it?.toLowerCase?.() === n ? acc + 1 : acc), 0);
}

// Construye un embed “expired/vanished” partiendo del original si existe
function buildExpiredEmbedFromMessage(msg) {
  const base = msg?.embeds?.[0];
  let e;
  if (base) e = EmbedBuilder.from(base);
  else e = new EmbedBuilder().setTitle("💥 Devil Fruit (Random)!");

  return e.setDescription("⏳ The fruit vanished...").setColor(0x888888);
}

function disabledRow(label = "Expired") {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("catch:done")
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

async function forceExpireMessageIfLooksActive(message) {
  try {
    // Si ya no hay componentes o ya está deshabilitado, no tocamos
    const row = message.components?.[0];
    const btn = row?.components?.[0];
    const alreadyDisabled = !!btn?.disabled;

    if (!alreadyDisabled) {
      const expiredEmbed = buildExpiredEmbedFromMessage(message);
      await message.edit({ embeds: [expiredEmbed], components: [disabledRow("Expired")] });
    }
  } catch (e) {
    // No hacemos ruido si falla
    console.error("forceExpireMessageIfLooksActive edit failed:", e);
  }
}

module.exports = {
  name: "catchfruit",

  async onCatchButton(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const customId = interaction.customId || "";
      const [, token] = customId.split(":");
      if (!token) {
        return interaction.editReply("❌ Invalid catch action.");
      }

      const store = loadActiveSpawns();
      const cur = store[interaction.guildId];

      // ➜ Si NO hay spawn o no coincide con este mensaje/token, marquemos el mensaje como “vanished”
      if (!cur || cur.messageId !== interaction.message.id || cur.token !== token) {
        await forceExpireMessageIfLooksActive(interaction.message);
        return interaction.editReply("❌ This fruit is no longer available.");
      }

      // Alguien ya la atrapó
      if (cur.caughtBy) {
        await forceExpireMessageIfLooksActive(interaction.message); // por si quedó habilitado
        return interaction.editReply("⏳ Someone already caught this fruit.");
      }

      // Expirada por tiempo ➜ edita a “vanished”, deshabilita y limpia store
      if (Date.now() > cur.expiresAt) {
        await forceExpireMessageIfLooksActive(interaction.message);
        delete store[interaction.guildId];
        saveActiveSpawns(store);
        return interaction.editReply("⏳ The fruit has expired.");
      }

      // Atrapable
      const fruitName = cur.fruitName;
      const players = loadPlayers();
      const p = ensurePlayer(players, interaction.user.id);
      p.inventory = p.inventory || {};
      p.inventory.fruits = Array.isArray(p.inventory.fruits) ? p.inventory.fruits : [];

      const curCount = countFruit(p.inventory.fruits, fruitName);
      if (curCount >= MAX_DUPES) {
        return interaction.editReply(`⚠️ You already carry **${MAX_DUPES}x** **${fruitName}**. You can't hold more.`);
      }

      // Bloquear carrera
      cur.caughtBy = interaction.user.id;
      saveActiveSpawns(store);

      // Añadir al inventario
      p.inventory.fruits.push(fruitName);
      savePlayers(players);

      // Editar mensaje a “Caught”
      try {
        const embed = new EmbedBuilder()
          .setTitle(`🎉 ${interaction.user.username} caught **${fruitName}**!`)
          .setDescription(`You now have **${curCount + 1}/${MAX_DUPES}** of this fruit.`)
          .setColor(0xff66aa);

        await interaction.message.edit({ embeds: [embed], components: [disabledRow("Caught")] });
      } catch (e) {
        console.error("Failed to edit spawn message after catch:", e);
      }

      return interaction.editReply(`🎉 You caught **${fruitName}**!\nInventory: **${curCount + 1}/${MAX_DUPES}**.`);
    } catch (err) {
      console.error("catchfruit onCatchButton error:", err);
      try { await interaction.editReply("❌ Interaction error."); } catch {}
    }
  },
};
