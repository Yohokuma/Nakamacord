// listeners/spawnFruit.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { fruits } = require("../db/items"); // mapa de frutas
const { loadSpawnChannels } = require("../db/spawnChannels");
const { loadActiveSpawns, saveActiveSpawns } = require("../db/activeSpawns");

// ---------- CONFIG ----------
const DROP_CHANCE = 0.25;        // 25% por mensaje (sube a 1 para test)
const MIN_INTERVAL_MS = 15_000;  // separación mínima entre spawns por guild
const DESPAWN_MS = 60_000;       // 1 minuto si nadie la coge

const RANDOM_ICON =
  "https://media.discordapp.net/attachments/1422731616320753674/1423353070351552652/DFIconRecreation.webp?format=webp";

// ---------- estado en memoria ----------
const lastSpawnAtPerGuild = new Map(); // guildId -> timestamp

// Pesos por rareza
const RARITY_WEIGHT = { Common: 84, Rare: 10, Legendary: 5, Mythical: 1 };

// Pool ponderado a partir del DB
function buildWeightedFruitPool() {
  const pool = [];
  for (const [name, meta] of Object.entries(fruits || {})) {
    if (!meta || meta.type !== "fruit") continue;
    const w = RARITY_WEIGHT[meta.rarity] ?? 1;
    for (let i = 0; i < w; i++) pool.push({ name, meta });
  }
  return pool;
}
const WEIGHTED = buildWeightedFruitPool();

function pickRandomFruitMeta() {
  if (!WEIGHTED.length) return null;
  const idx = Math.floor(Math.random() * WEIGHTED.length);
  return WEIGHTED[idx]; // { name, meta }
}

function makeToken() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = async (client, message) => {
  try {
    if (!message.guild || message.author.bot) return;

    // canal de spawns configurado (donde aparecerá SIEMPRE la fruta)
    const chanMap = loadSpawnChannels(); // { [guildId]: channelId }
    const spawnChanId = chanMap[message.guild.id];
    if (!spawnChanId) return;

    // ⬇️ YA NO requerimos que el mensaje sea en el canal de spawn
    // if (message.channel.id !== spawnChanId) return;  // <- eliminado

    // respeta intervalo mínimo por guild
    const now = Date.now();
    const last = lastSpawnAtPerGuild.get(message.guild.id) ?? 0;
    if (now - last < MIN_INTERVAL_MS) return;

    // probabilidad global
    if (Math.random() > DROP_CHANCE) return;

    // pick fruit
    const pick = pickRandomFruitMeta();
    if (!pick) return;

    // obtener el canal de spawn real
    let spawnChannel = message.guild.channels.cache.get(spawnChanId);
    if (!spawnChannel) {
      try {
        spawnChannel = await client.channels.fetch(spawnChanId);
      } catch {
        return; // canal inválido o sin acceso
      }
    }

    // token único para el botón
    const token = makeToken();

    // embed del spawn (oculto)
    const embed = new EmbedBuilder()
      .setTitle("💥 Devil Fruit (Random)!")
      .setDescription("Be the first to catch it!")
      .setThumbnail(RANDOM_ICON)
      .setColor(0x8e44ad);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`catch:${token}`)
        .setLabel("Catch Fruit")
        .setStyle(ButtonStyle.Success)
    );

    // ⬇️ Enviar SIEMPRE al canal configurado
    const msg = await spawnChannel.send({ embeds: [embed], components: [row] });

    // persistir spawn activo (sobrevive reinicios)
    const store = loadActiveSpawns();
    store[message.guild.id] = {
      guildId: message.guild.id,
      channelId: spawnChannel.id, // ⬅️ almacenamos el canal donde apareció
      messageId: msg.id,
      token,                 // para validar click real
      fruitName: pick.name,  // nombre real a entregar
      spawnedAt: now,
      expiresAt: now + DESPAWN_MS,
      caughtBy: null,
    };
    saveActiveSpawns(store);

    // marca último spawn
    lastSpawnAtPerGuild.set(message.guild.id, now);

    // Auto-expire → EDITA el mensaje con "vanished" y botón deshabilitado
    setTimeout(async () => {
      const live = loadActiveSpawns();
      const cur = live[message.guild.id];
      if (!cur || cur.messageId !== msg.id) return; // ya fue reemplazado o atrapado
      if (Date.now() < cur.expiresAt) return;       // aún no expira
      if (cur.caughtBy) return;                     // alguien ya la atrapó

      try {
        const expiredEmbed = EmbedBuilder.from(embed)
          .setDescription("⏳ The fruit vanished...")
          .setColor(0x95a5a6); // gris

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("catch:expired")
            .setLabel("Expired")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        await msg.edit({
          embeds: [expiredEmbed],
          components: [disabledRow],
        });
      } catch {}

      delete live[message.guild.id];
      saveActiveSpawns(live);
    }, DESPAWN_MS + 500);
  } catch (e) {
    console.error("spawnFruit listener error:", e);
  }
};
