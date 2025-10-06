// index.js
require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Helpers de jugadores (EXP / mastery)
const {
  loadPlayers,
  savePlayers,
  ensurePlayer,
  getItemMastery,
  setItemMastery,
} = require("./db/players");

// Listener de spawn de frutas (firma: (client, message) => Promise)
const spawnFruitListener = require("./listeners/spawnFruit");

// Handler del botón de captura
const catchMod = require("./commands/catchfruit");

// ================== Inicializar cliente ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// ================== Cargar comandos ==================
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command && command.name && typeof command.execute === "function") {
      client.commands.set(command.name, command);
    }
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================== Mensajes ==================
client.on("messageCreate", async (message) => {
  try {
    // Ignorar bots y DMs
    if (message.author.bot || !message.guild) return;

    const isCommand = message.content.startsWith("n!");

    // ======== Spawns + EXP/mastery para mensajes normales ========
    if (!isCommand) {
      // Intento de spawn en el canal configurado
      try {
        await spawnFruitListener(client, message);
      } catch (err) {
        console.error("Spawn listener error:", err);
      }

      // EXP por mensaje + level up de mastery si procede
      try {
        const players = loadPlayers();
        const p = ensurePlayer(players, message.author.id);

        // +1 mensaje
        p._msgCount = (p._msgCount ?? 0) + 1;

        // Detectar ítem equipado actual para aplicar mastery
        let starter = null;
        if (p.activeSlot === "fruit" && p.equipped?.fruit) {
          starter = { type: "fruit", name: p.equipped.fruit };
        } else if (p.activeSlot === "weapon" && p.equipped?.weapon) {
          starter = { type: "weapon", name: p.equipped.weapon };
        }

        if (starter) {
          const cur = getItemMastery(p, starter.type, starter.name);
          if (p._msgCount >= 100 && cur < 100) {
            p._msgCount -= 100;
            const next = cur + 1;
            setItemMastery(p, starter.type, starter.name, next);

            const totalBonus = (next - 1) * 2; // +2% por nivel >1
            message.channel.send(
              `🎉 <@${message.author.id}>’s **${starter.name}** mastery leveled up to **${next}**!\n` +
                `📈 Your stats increase by **+2%**!\n` +
                `⚡ Now you’re fighting at **+${totalBonus}% of your current power**!`
            );
          }
        }

        savePlayers(players);
      } catch (err) {
        console.error("EXP/mastery handler error:", err);
      }

      return; // no procesamos comandos si no empiezan con n!
    }

    // ======== Comandos n! ========
    const args = message.content.slice(2).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    if (!command) return;

    await command.execute(message, args, client);
  } catch (err) {
    console.error("messageCreate error:", err);
    try {
      await message.reply("❌ There was an error executing that.");
    } catch {}
  }
});

// ================== Interacciones (botones) ==================
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    const id = interaction.customId || "";

    // Botón de captura de fruta: "catch:<token>"
    if (id.startsWith("catch:")) {
      return catchMod.onCatchButton(interaction);
    }

    // Aquí puedes manejar otros botones de tu bot (misiones, pvp, etc.)
  } catch (err) {
    console.error("interactionCreate error:", err);
    try {
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply("❌ Interaction error.");
        } else {
          await interaction.reply({ content: "❌ Interaction error.", ephemeral: true });
        }
      }
    } catch {}
  }
});

// ================== Login ==================
client.login(process.env.DISCORD_TOKEN);
