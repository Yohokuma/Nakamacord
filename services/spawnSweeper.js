// services/spawnSweeper.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { loadActiveSpawns, saveActiveSpawns } = require("../db/activeSpawns");

let _timer = null;

/** Construye un embed "expired/vanished" a partir del embed original si existe */
function buildExpiredEmbedFromMessage(msg) {
  const base = msg?.embeds?.[0];
  let e;
  if (base) e = EmbedBuilder.from(base);
  else e = new EmbedBuilder().setTitle("💥 Devil Fruit (Random)!");
  return e.setDescription("⏳ The fruit vanished...").setColor(0x95a5a6);
}

function disabledRow(label = "Expired") {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("catch:expired")
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

/**
 * Revisa periódicamente los spawns activos y:
 * - Si están expirados y nadie los atrapó, edita el mensaje a "vanished" + botón deshabilitado
 * - Limpia el registro del spawn
 */
async function sweepOnce(client) {
  const store = loadActiveSpawns(); // { [guildId]: { guildId, channelId, messageId, expiresAt, caughtBy, ... } }
  const now = Date.now();

  const guildIds = Object.keys(store);
  if (!guildIds.length) return;

  for (const gid of guildIds) {
    const s = store[gid];
    if (!s) continue;

    // Si ya fue atrapado o aún no expira, saltar
    if (s.caughtBy || now < (s.expiresAt || 0)) continue;

    try {
      const guild = await client.guilds.fetch(gid).catch(() => null);
      if (!guild) continue;

      const channel = await guild.channels.fetch(s.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      const msg = await channel.messages.fetch(s.messageId).catch(() => null);
      if (!msg) {
        // no existe el mensaje ⇒ solo limpiar store
        delete store[gid];
        continue;
      }

      // Si ya tiene botón desactivado, no re-editar (idempotente)
      const btn = msg.components?.[0]?.components?.[0];
      const alreadyDisabled = !!btn?.disabled;

      if (!alreadyDisabled) {
        const expiredEmbed = buildExpiredEmbedFromMessage(msg);
        await msg.edit({ embeds: [expiredEmbed], components: [disabledRow()] }).catch(() => {});
      }

      // limpiar
      delete store[gid];
    } catch (e) {
      // Si algo falla, no rompas el barrido completo; intentará en la próxima pasada
      // console.error("spawnSweeper error on a guild:", e);
      delete store[gid]; // evita quedarnos colgados para siempre
    }
  }

  saveActiveSpawns(store);
}

function startSpawnSweeper(client, { intervalMs = 10_000 } = {}) {
  if (_timer) return; // ya corriendo
  _timer = setInterval(() => {
    sweepOnce(client).catch(() => {});
  }, intervalMs);
  // Ejecuta una pasada al arrancar
  sweepOnce(client).catch(() => {});
}

function stopSpawnSweeper() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

module.exports = { startSpawnSweeper, stopSpawnSweeper };
