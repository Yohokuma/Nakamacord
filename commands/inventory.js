// commands/inventory.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { loadPlayers, ensurePlayer } = require("../db/players");
const { findItem } = require("../db/itemsHelper");

// Normaliza fruits y weapons a arrays de { name, count, rarity }
function normalizeList(rawList, kind) {
  // rawList puede ser:
  // - Mapa { "Gomu Gomu no Mi": 2, ... }
  // - Array ["Gomu Gomu no Mi", "Bara Bara no Mi", ...]
  // - Falsy / indefinido
  if (!rawList) return [];

  const out = [];
  if (Array.isArray(rawList)) {
    // Compactar array a conteos
    const map = {};
    for (const n of rawList) {
      if (!n) continue;
      map[n] = (map[n] || 0) + 1;
    }
    for (const [name, count] of Object.entries(map)) {
      const meta = findItem(name);
      out.push({
        name,
        count,
        rarity: meta?.rarity ?? (kind === "fruit" ? "Common" : "Common"),
      });
    }
  } else if (typeof rawList === "object") {
    for (const [name, count] of Object.entries(rawList)) {
      const meta = findItem(name);
      out.push({
        name,
        count: Number(count) || 0,
        rarity: meta?.rarity ?? (kind === "fruit" ? "Common" : "Common"),
      });
    }
  }

  // Orden alfabético por nombre
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// Crea las páginas. Cada página muestra hasta 10 frutas y 10 armas.
function buildPages(fruitsArr, weaponsArr) {
  const FRUITS_PER_PAGE = 10;
  const WEAPONS_PER_PAGE = 10;

  const fruitPages = Math.max(1, Math.ceil(fruitsArr.length / FRUITS_PER_PAGE));
  const weaponPages = Math.max(1, Math.ceil(weaponsArr.length / WEAPONS_PER_PAGE));
  const pages = Math.max(fruitPages, weaponPages);

  const getSliceText = (arr, from, to, emptyText) => {
    if (!arr.length) return emptyText;
    return arr.slice(from, to).map(x => `• ${x.name}${x.count ? ` ×${x.count}` : ""} (${x.rarity})`).join("\n");
  };

  const pageBuilder = (user, player, pageIndex) => {
    const fStart = pageIndex * FRUITS_PER_PAGE;
    const wStart = pageIndex * WEAPONS_PER_PAGE;

    const fruitsText = getSliceText(fruitsArr, fStart, fStart + FRUITS_PER_PAGE, "—");
    const weaponsText = getSliceText(weaponsArr, wStart, wStart + WEAPONS_PER_PAGE, "—");

    const embed = new EmbedBuilder()
      .setTitle(`🎒 ${user.username}'s Inventory`)
      .addFields(
        { name: "🍎 Fruits", value: fruitsText, inline: false },
        { name: "⚔️ Weapons", value: weaponsText, inline: false },
        { name: "Equipped Fruit", value: player.equipped?.fruit ?? "—", inline: true },
        { name: "Equipped Weapon", value: player.equipped?.weapon ?? "—", inline: true },
      )
      .setFooter({ text: `userId: ${user.id} • Page ${pageIndex + 1}/${pages}` })
      .setColor("Gold");

    return embed;
  };

  return { pages, pageBuilder };
}

module.exports = {
  name: "inventory",
  description: "Show your (or someone else's) inventory. Usage: n!inventory [@user]",
  async execute(message) {
    const mention = message.mentions.users.first();
    const user = mention ?? message.author;

    const players = loadPlayers();
    const player = ensurePlayer(players, user.id);

    // Normalizar a arrays con conteo y rareza
    const fruitsArr  = normalizeList(player?.inventory?.fruits,  "fruit");
    const weaponsArr = normalizeList(player?.inventory?.weapons, "weapon");

    // Construir páginas
    const { pages, pageBuilder } = buildPages(fruitsArr, weaponsArr);

    // Si una sola página, enviamos sin botones
    if (pages === 1) {
      const embed = pageBuilder(user, player, 0);
      return message.channel.send({ embeds: [embed] });
    }

    // Paginación con botones
    let page = 0;
    const makeRow = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("inv_prev").setLabel("Prev").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId("inv_next").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(page >= pages - 1),
        new ButtonBuilder().setCustomId("inv_close").setLabel("Close").setStyle(ButtonStyle.Danger),
      );

    const msg = await message.channel.send({
      embeds: [pageBuilder(user, player, page)],
      components: [makeRow()],
    });

    const collector = msg.channel.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id && ["inv_prev", "inv_next", "inv_close"].includes(i.customId),
      time: 120000,
    });

    collector.on("collect", async (interaction) => {
      await interaction.deferUpdate();
      if (interaction.customId === "inv_prev" && page > 0) page--;
      if (interaction.customId === "inv_next" && page < pages - 1) page++;
      if (interaction.customId === "inv_close") {
        collector.stop("closed");
        return;
      }
      await msg.edit({
        embeds: [pageBuilder(user, player, page)],
        components: [makeRow()],
      });
    });

    collector.on("end", async () => {
      // Desactivar botones al terminar
      try {
        await msg.edit({ components: [] });
      } catch {}
    });
  },
};
