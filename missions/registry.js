// missions/registry.js
// Supported boss ability types (handled by bosses/npc.js):
// - damage:         { multiplier, randomFactor?, cooldown, chance, usesBuso? }
// - stun:           { stunTurns, cooldown, chance, usesBuso? }
// - applyFailNext:  { nextFailChance, cooldown, chance }
// - applyStatus:    { status: 'electrified' | 'bleed' | 'poison' | 'burn' | 'frozen' | 'knocked', statusChance?, cooldown, chance, usesBuso? }
//   • shorthand alias in npc.js: type: 'electrified' (same as applyStatus with status='electrified')
//
// Boss flags: isLogia, hasBuso (whether the boss can damage Logias on basic hits).
// Boss universal GIF: boss.gif (leave null if not available).
//
// Story progression rule (from commands/story.js):
// - You can play id <= storyProgress + 1 (main story).
// - Optional missions can require a minProgress, but this list avoids bandits/“farm” and focuses on canon duels.

const REGISTRY = {
  // ===== East Blue (Main Story) =====
  1: {
    title: "Romance Dawn — Alvida",
    boss: {
      name: "Alvida",
      hpMax: 4200, atk: 42,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Iron Mace", type: "damage", multiplier: 1.3, randomFactor: 0.15, cooldown: 2, chance: 100, gif: null },
        { name: "Slippery Swagger", type: "applyFailNext", nextFailChance: 20, cooldown: 4, chance: 50, gif: null },
      ],
    },
    rewards: { belly: 300, masteryMsgs: 20, dropTable: "none" },
  },

  2: {
    title: "Shells Town — Axe-Hand Morgan",
    boss: {
      name: "Morgan",
      hpMax: 6000, atk: 60,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Axe Chop", type: "damage", multiplier: 1.4, randomFactor: 0.15, cooldown: 2, chance: 100, gif: null },
        { name: "Marine Order", type: "applyFailNext", nextFailChance: 30, cooldown: 4, chance: 100, gif: null },
      ],
    },
    rewards: { belly: 500, masteryMsgs: 25, dropTable: "none" },
  },

  3: {
    title: "Orange Town — Buggy",
    boss: {
      name: "Buggy the Clown",
      hpMax: 7000, atk: 65,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Muggy Ball", type: "damage", multiplier: 1.6, randomFactor: 0.15, cooldown: 3, chance: 100, gif: null },
        { name: "Chop-Chop Scatter", type: "applyFailNext", nextFailChance: 25, cooldown: 4, chance: 70, gif: null },
      ],
    },
    rewards: { belly: 650, masteryMsgs: 28, dropTable: "none" },
  },

  4: {
    title: "Syrup Village — Captain Kuro",
    boss: {
      name: "Kuro",
      hpMax: 7800, atk: 72,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Shakushi", type: "damage", multiplier: 1.5, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null },
        { name: "Stealth Feint", type: "applyFailNext", nextFailChance: 35, cooldown: 5, chance: 60, gif: null },
      ],
    },
    rewards: { belly: 750, masteryMsgs: 30, dropTable: "none" },
  },

  5: {
    title: "Baratie — Don Krieg",
    boss: {
      name: "Don Krieg",
      hpMax: 9500, atk: 85,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "MH5 Bombardment", type: "damage", multiplier: 1.7, randomFactor: 0.2, cooldown: 4, chance: 100, gif: null },
        { name: "Armored Onslaught", type: "damage", multiplier: 1.3, cooldown: 2, chance: 100, gif: null },
      ],
    },
    rewards: { belly: 900, masteryMsgs: 32, dropTable: "none" },
  },

  // Sanji spotlight (East Blue)
  6: {
    title: "Baratie — Sanji vs Gin",
    boss: {
      name: "Gin (Krieg Pirates)",
      hpMax: 10400, atk: 88,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Tonfa Barrage", type: "damage", multiplier: 1.45, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null },
        { name: "Poison Mist", type: "applyFailNext", nextFailChance: 25, cooldown: 5, chance: 60, gif: null },
      ],
    },
    rewards: { belly: 1000, masteryMsgs: 34, dropTable: "baratie_duel" },
  },

  7: {
    title: "Arlong Park — Arlong",
    boss: {
      name: "Arlong",
      hpMax: 11000, atk: 95,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Shark On Darts", type: "damage", multiplier: 1.6, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null },
        { name: "Saw Blade Maul", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null },
      ],
    },
    rewards: { belly: 1200, masteryMsgs: 36, dropTable: "none" },
  },

  8: {
    title: "Loguetown — Smoker",
    boss: {
      name: "Smoker",
      hpMax: 12500, atk: 100,
      gif: null,
      isLogia: true, hasBuso: true,
      abilities: [
        { name: "Smoke Fist", type: "damage", multiplier: 1.4, randomFactor: 0.2, cooldown: 2, chance: 100, gif: null, usesBuso: false },
        { name: "Blackened Strike", type: "damage", multiplier: 1.8, cooldown: 5, chance: 100, gif: null, usesBuso: true },
        { name: "White Bind", type: "stun", stunTurns: 1, cooldown: 6, chance: 50, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 1500, masteryMsgs: 40, dropTable: "none" },
  },

  // ===== Baroque Works / Alabasta =====
  9: {
    title: "Whiskey Peak — Mr. 5 & Miss Valentine",
    boss: {
      name: "Mr. 5",
      hpMax: 14000, atk: 110,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Bomb-Bomb Blast", type: "damage", multiplier: 1.6, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null },
        { name: "Explosive Impact", type: "applyFailNext", nextFailChance: 30, cooldown: 5, chance: 60, gif: null },
      ],
    },
    rewards: { belly: 1700, masteryMsgs: 42, dropTable: "none" },
  },

  10: {
    title: "Little Garden — Mr. 3",
    boss: {
      name: "Mr. 3",
      hpMax: 15500, atk: 120,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Candle Wall Press", type: "stun", stunTurns: 1, cooldown: 5, chance: 60, gif: null },
        { name: "Wax Armor Strike", type: "damage", multiplier: 1.5, cooldown: 3, chance: 100, gif: null },
      ],
    },
    rewards: { belly: 1850, masteryMsgs: 44, dropTable: "none" },
  },

  // Zoro spotlight — Mr. 1
  11: {
    title: "Alubarna — Zoro vs Mr. 1 (Daz Bones)",
    boss: {
      name: "Mr. 1 (Daz Bones)",
      hpMax: 20000, atk: 145,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Steel Blade Dance", type: "damage", multiplier: 1.7, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Razor Storm", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 2300, masteryMsgs: 46, dropTable: "alabasta_duel" },
  },

  12: {
    title: "Alubarna — Crocodile",
    boss: {
      name: "Sir Crocodile",
      hpMax: 24000, atk: 165,
      gif: null,
      isLogia: true, hasBuso: true,
      abilities: [
        { name: "Desert Spada", type: "damage", multiplier: 1.8, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: false },
        { name: "Desert Encierro", type: "stun", stunTurns: 1, cooldown: 6, chance: 50, gif: null, usesBuso: true },
        { name: "Sandstorm", type: "applyFailNext", nextFailChance: 35, cooldown: 5, chance: 70, gif: null },
      ],
    },
    rewards: { belly: 3600, masteryMsgs: 50, dropTable: "alabasta_boss" },
  },

  // ===== Drum / Skypiea =====
  13: {
    title: "Drum Island — Wapol",
    boss: {
      name: "Wapol",
      hpMax: 17000, atk: 130,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Munch-Munch Cannon", type: "damage", multiplier: 1.6, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null },
        { name: "Swallow House", type: "applyFailNext", nextFailChance: 25, cooldown: 4, chance: 70, gif: null },
      ],
    },
    rewards: { belly: 2000, masteryMsgs: 46, dropTable: "none" },
  },

  // Robin spotlight — Yama
  14: {
    title: "Skypiea — Robin vs Yama",
    boss: {
      name: "Yama (Priest)",
      hpMax: 21000, atk: 150,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Axe Pressure", type: "damage", multiplier: 1.55, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null },
        { name: "Brute Stomp", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null },
      ],
    },
    rewards: { belly: 2400, masteryMsgs: 48, dropTable: "skypiea_duel" },
  },

  15: {
    title: "Upper Yard — Enel",
    boss: {
      name: "God Enel",
      hpMax: 27000, atk: 190,
      gif: null,
      isLogia: true, hasBuso: true,
      abilities: [
        { name: "El Thor", type: "damage", multiplier: 2.0, randomFactor: 0.25, cooldown: 4, chance: 100, gif: null, usesBuso: true },
        { name: "Mantra Glimpse", type: "applyFailNext", nextFailChance: 40, cooldown: 5, chance: 60, gif: null },
        { name: "Lightning Bind", type: "stun", stunTurns: 1, cooldown: 6, chance: 50, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 4300, masteryMsgs: 54, dropTable: "skypiea_boss" },
  },

  // ===== Water 7 / Enies Lobby (CP9) =====
  // Nami vs Kalifa
  16: {
    title: "Enies Lobby — Nami vs Kalifa",
    boss: {
      name: "Kalifa (CP9)",
      hpMax: 23500, atk: 170,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Bubble Trap", type: "applyFailNext", nextFailChance: 35, cooldown: 5, chance: 70, gif: null },
        { name: "Soap Whip", type: "damage", multiplier: 1.5, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 4400, masteryMsgs: 56, dropTable: "cp9_duel" },
  },

  // Chopper vs Kumadori
  17: {
    title: "Enies Lobby — Chopper vs Kumadori",
    boss: {
      name: "Kumadori (CP9)",
      hpMax: 24000, atk: 175,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Shishi Kebab", type: "damage", multiplier: 1.6, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Life Return Bind", type: "stun", stunTurns: 1, cooldown: 6, chance: 45, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 4550, masteryMsgs: 57, dropTable: "cp9_duel" },
  },

  // Franky vs Fukurou
  18: {
    title: "Enies Lobby — Franky vs Fukurou",
    boss: {
      name: "Fukurou (CP9)",
      hpMax: 24800, atk: 180,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Rankyaku Cannon", type: "damage", multiplier: 1.75, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Chatter Lock", type: "applyFailNext", nextFailChance: 30, cooldown: 5, chance: 60, gif: null },
      ],
    },
    rewards: { belly: 4700, masteryMsgs: 58, dropTable: "cp9_duel" },
  },

  // Zoro vs Kaku
  19: {
    title: "Enies Lobby — Zoro vs Kaku",
    boss: {
      name: "Kaku (CP9)",
      hpMax: 26000, atk: 190,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Rokushiki: Rankyaku", type: "damage", multiplier: 1.85, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Giraffe Slam", type: "stun", stunTurns: 1, cooldown: 6, chance: 45, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 4900, masteryMsgs: 59, dropTable: "cp9_duel" },
  },

  // Sanji vs Jabra
  20: {
    title: "Enies Lobby — Sanji vs Jabra",
    boss: {
      name: "Jabra (CP9)",
      hpMax: 26200, atk: 195,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Tekkai Wolf", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null, usesBuso: true },
        { name: "Shigan Fang", type: "damage", multiplier: 1.8, cooldown: 3, chance: 100, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 5000, masteryMsgs: 60, dropTable: "cp9_duel" },
  },

  21: {
    title: "Enies Lobby — Blueno",
    boss: {
      name: "Blueno (CP9)",
      hpMax: 24500, atk: 180,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Shigan", type: "damage", multiplier: 1.7, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Door Surprise", type: "applyFailNext", nextFailChance: 30, cooldown: 5, chance: 60, gif: null },
      ],
    },
    rewards: { belly: 4500, masteryMsgs: 56, dropTable: "cp9_mid" },
  },

  22: {
    title: "Enies Lobby — Rob Lucci",
    boss: {
      name: "Rob Lucci (CP9)",
      hpMax: 31000, atk: 225,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Rokuogan", type: "damage", multiplier: 2.1, randomFactor: 0.2, cooldown: 4, chance: 100, gif: null, usesBuso: true },
        { name: "Soru Assault", type: "damage", multiplier: 1.5, cooldown: 2, chance: 100, gif: null },
        { name: "Tekkai Lock", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 5200, masteryMsgs: 60, dropTable: "cp9_boss" },
  },

  // ===== Thriller Bark =====
  // Usopp vs Perona
  23: {
    title: "Thriller Bark — Usopp vs Perona",
    boss: {
      name: "Perona",
      hpMax: 27500, atk: 200,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Negative Hollows", type: "applyFailNext", nextFailChance: 45, cooldown: 5, chance: 75, gif: null },
        { name: "Ghost Bomb", type: "damage", multiplier: 1.6, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null },
      ],
    },
    rewards: { belly: 5000, masteryMsgs: 62, dropTable: "thriller_duel" },
  },

  // Brook vs Ryuma
  24: {
    title: "Thriller Bark — Brook vs Ryuma",
    boss: {
      name: "Ryuma",
      hpMax: 30000, atk: 210,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Undead Slash", type: "damage", multiplier: 1.85, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Samurai Grip", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 5200, masteryMsgs: 63, dropTable: "thriller_duel" },
  },

  25: {
    title: "Thriller Bark — Gecko Moria",
    boss: {
      name: "Gecko Moria",
      hpMax: 32000, atk: 215,
      gif: null,
      isLogia: false, hasBuso: false,
      abilities: [
        { name: "Shadow Asgard Smash", type: "damage", multiplier: 1.9, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null },
        { name: "Brick Bat", type: "applyFailNext", nextFailChance: 35, cooldown: 5, chance: 70, gif: null },
      ],
    },
    rewards: { belly: 5400, masteryMsgs: 62, dropTable: "thriller_boss" },
  },

  // ===== Sabaody / Marineford =====
  26: {
    title: "Sabaody — Pacifista PX-4",
    boss: {
      name: "Pacifista",
      hpMax: 33500, atk: 235,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Laser Beam", type: "damage", multiplier: 1.8, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Overheat", type: "stun", stunTurns: 1, cooldown: 6, chance: 35, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 5600, masteryMsgs: 64, dropTable: "sabaody_mech" },
  },

  27: {
    title: "Marineford — Admiral Aokiji",
    boss: {
      name: "Aokiji (Kuzan)",
      hpMax: 42500, atk: 260,
      gif: null,
      isLogia: true, hasBuso: true,
      abilities: [
        { name: "Ice Time", type: "stun", stunTurns: 1, cooldown: 5, chance: 70, gif: null, usesBuso: true },
        { name: "Ice Lance", type: "damage", multiplier: 2.0, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 7000, masteryMsgs: 68, dropTable: "marineford_admiral" },
  },

  28: {
    title: "Marineford — Admiral Akainu",
    boss: {
      name: "Akainu (Sakazuki)",
      hpMax: 47000, atk: 295,
      gif: null,
      isLogia: true, hasBuso: true,
      abilities: [
        { name: "Great Eruption", type: "damage", multiplier: 2.2, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Magma Hound", type: "damage", multiplier: 1.8, cooldown: 2, chance: 100, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 8200, masteryMsgs: 72, dropTable: "marineford_admiral" },
  },

  // ===== New World (post-timeskip) =====
  // Zoro vs Hyouzou (Fish-Man Island)
  29: {
    title: "Fish-Man Island — Zoro vs Hyouzou",
    boss: {
      name: "Hyouzou",
      hpMax: 33000, atk: 235,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Poison Blade", type: "applyFailNext", nextFailChance: 40, cooldown: 5, chance: 65, gif: null },
        { name: "Octo Slash", type: "damage", multiplier: 1.8, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 7200, masteryMsgs: 64, dropTable: "fmi_duel" },
  },

  30: {
    title: "Fish-Man Island — Hody Jones",
    boss: {
      name: "Hody Jones",
      hpMax: 34000, atk: 240,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Shark Spear", type: "damage", multiplier: 1.9, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Energy Steroids Rage", type: "applyFailNext", nextFailChance: 35, cooldown: 5, chance: 70, gif: null },
      ],
    },
    rewards: { belly: 7400, masteryMsgs: 66, dropTable: "fmi_boss" },
  },

  // Punk Hazard — Monet (Logia-like snow, uses stun/electric)
  31: {
    title: "Punk Hazard — Monet",
    boss: {
      name: "Monet",
      hpMax: 35000, atk: 245,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Snow Prison", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null, usesBuso: true },
        { name: "Freezing Touch", type: "applyStatus", status: "frozen", statusChance: 35, cooldown: 5, chance: 65, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 7500, masteryMsgs: 66, dropTable: "punk_mid" },
  },

  32: {
    title: "Punk Hazard — Vergo",
    boss: {
      name: "Vergo",
      hpMax: 36000, atk: 255,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Full-Body Armament", type: "damage", multiplier: 1.9, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Bamboo Demon", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 7600, masteryMsgs: 68, dropTable: "punk_elite" },
  },

  33: {
    title: "Punk Hazard — Caesar Clown",
    boss: {
      name: "Caesar Clown",
      hpMax: 38000, atk: 260,
      gif: null,
      isLogia: true, hasBuso: true,
      abilities: [
        { name: "Gaston", type: "applyFailNext", nextFailChance: 40, cooldown: 5, chance: 70, gif: null },
        { name: "Blue Sword", type: "damage", multiplier: 1.9, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Smiley Discharge", type: "electrified", chance: 60, cooldown: 6, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 7800, masteryMsgs: 70, dropTable: "punk_boss" },
  },

  // ===== Dressrosa =====
  34: {
    title: "Dressrosa — Pica",
    boss: {
      name: "Pica",
      hpMax: 47000, atk: 300,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Stone Giant Smash", type: "damage", multiplier: 2.0, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Stone Cage", type: "stun", stunTurns: 1, cooldown: 6, chance: 45, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 9800, masteryMsgs: 74, dropTable: "dressrosa_commander" },
  },

  // Zoro vs Pica (duelist version)
  35: {
    title: "Dressrosa — Zoro vs Pica (Final)",
    boss: {
      name: "Pica (Final)",
      hpMax: 52000, atk: 315,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Stone Colossus", type: "damage", multiplier: 2.1, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Seismic Crash", type: "stun", stunTurns: 1, cooldown: 6, chance: 50, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 10800, masteryMsgs: 76, dropTable: "dressrosa_duel" },
  },

  36: {
    title: "Dressrosa — Donquixote Doflamingo",
    boss: {
      name: "Doflamingo",
      hpMax: 54000, atk: 325,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Sixteen Holy Bullets", type: "damage", multiplier: 2.2, randomFactor: 0.25, cooldown: 4, chance: 100, gif: null, usesBuso: true },
        { name: "Parasite", type: "stun", stunTurns: 1, cooldown: 6, chance: 60, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 12000, masteryMsgs: 78, dropTable: "dressrosa_boss" },
  },

  // ===== Whole Cake Island =====
  37: {
    title: "Whole Cake — Charlotte Cracker",
    boss: {
      name: "Cracker",
      hpMax: 60000, atk: 340,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Pretzel Roll", type: "damage", multiplier: 2.0, randomFactor: 0.2, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Biscuit Guard", type: "applyFailNext", nextFailChance: 35, cooldown: 5, chance: 70, gif: null },
      ],
    },
    rewards: { belly: 13500, masteryMsgs: 82, dropTable: "wci_commander" },
  },

  38: {
    title: "Whole Cake — Charlotte Katakuri",
    boss: {
      name: "Katakuri",
      hpMax: 72000, atk: 380,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Mochi Thrust", type: "damage", multiplier: 2.1, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Future Glimpse", type: "applyFailNext", nextFailChance: 45, cooldown: 5, chance: 70, gif: null },
        { name: "Buzz-Cut Mochi", type: "stun", stunTurns: 1, cooldown: 6, chance: 50, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 16000, masteryMsgs: 86, dropTable: "wci_commander" },
  },

  // ===== Wano =====
  // Jinbe vs Who's-Who
  39: {
    title: "Wano — Jinbe vs Who's-Who",
    boss: {
      name: "Who's-Who",
      hpMax: 78000, atk: 385,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Cat Tooth Pistol", type: "damage", multiplier: 2.0, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Rokushiki: Shigan", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 16800, masteryMsgs: 86, dropTable: "wano_duel" },
  },

  // Robin vs Black Maria
  40: {
    title: "Wano — Robin vs Black Maria",
    boss: {
      name: "Black Maria",
      hpMax: 79000, atk: 388,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Spider Thread", type: "stun", stunTurns: 1, cooldown: 6, chance: 45, gif: null, usesBuso: true },
        { name: "Burning Club", type: "damage", multiplier: 1.95, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 17000, masteryMsgs: 86, dropTable: "wano_duel" },
  },

  // Franky vs Sasaki
  41: {
    title: "Wano — Franky vs Sasaki",
    boss: {
      name: "Sasaki",
      hpMax: 80000, atk: 392,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Triceratops Charge", type: "damage", multiplier: 2.0, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Propeller Horn", type: "applyFailNext", nextFailChance: 40, cooldown: 5, chance: 70, gif: null },
      ],
    },
    rewards: { belly: 17200, masteryMsgs: 86, dropTable: "wano_duel" },
  },

  // Nami & Zeus vs Ulti (stun/electro flavor)
  42: {
    title: "Wano — Nami vs Ulti",
    boss: {
      name: "Ulti",
      hpMax: 80500, atk: 395,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Headbutt Rush", type: "damage", multiplier: 2.0, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Feral Tackle", type: "stun", stunTurns: 1, cooldown: 6, chance: 45, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 17400, masteryMsgs: 86, dropTable: "wano_duel" },
  },

  43: {
    title: "Wano — Queen",
    boss: {
      name: "Queen",
      hpMax: 80000, atk: 390,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Brachio Bomber", type: "damage", multiplier: 2.0, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Plague Shot", type: "applyFailNext", nextFailChance: 40, cooldown: 6, chance: 60, gif: null },
      ],
    },
    rewards: { belly: 17000, masteryMsgs: 88, dropTable: "wano_commander" },
  },

  // Sanji vs Queen (duel)
  44: {
    title: "Wano — Sanji vs Queen",
    boss: {
      name: "Queen (Duel)",
      hpMax: 86000, atk: 405,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Germa Mimicry", type: "applyFailNext", nextFailChance: 45, cooldown: 6, chance: 60, gif: null },
        { name: "Reptilian Slam", type: "damage", multiplier: 2.1, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 18200, masteryMsgs: 90, dropTable: "wano_duel" },
  },

  45: {
    title: "Wano — King",
    boss: {
      name: "King",
      hpMax: 86000, atk: 410,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Imperial Wings", type: "damage", multiplier: 2.1, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Flame Barrier", type: "applyFailNext", nextFailChance: 35, cooldown: 5, chance: 70, gif: null },
      ],
    },
    rewards: { belly: 18000, masteryMsgs: 90, dropTable: "wano_commander" },
  },

  // Zoro vs King (duel)
  46: {
    title: "Wano — Zoro vs King",
    boss: {
      name: "King (Duel)",
      hpMax: 93000, atk: 430,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Andon: Imperial Blaze", type: "damage", multiplier: 2.25, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Lunarian Guard", type: "stun", stunTurns: 1, cooldown: 6, chance: 45, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 19500, masteryMsgs: 92, dropTable: "wano_duel" },
  },

  47: {
    title: "Onigashima — Kaido",
    boss: {
      name: "Kaido",
      hpMax: 110000, atk: 500,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Thunder Bagua", type: "damage", multiplier: 2.4, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Bolo Breath", type: "damage", multiplier: 2.0, cooldown: 4, chance: 100, gif: null, usesBuso: true },
        { name: "Conqueror’s Glare", type: "stun", stunTurns: 1, cooldown: 6, chance: 50, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 26000, masteryMsgs: 95, dropTable: "wano_boss" },
  },

  // ===== Egghead =====
  48: {
    title: "Egghead — Rob Lucci (Awakened)",
    boss: {
      name: "Rob Lucci (CP0)",
      hpMax: 90000, atk: 450,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Rokuogan: Awaken", type: "damage", multiplier: 2.2, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Soru Flurry", type: "damage", multiplier: 1.6, cooldown: 2, chance: 100, gif: null },
      ],
    },
    rewards: { belly: 21000, masteryMsgs: 96, dropTable: "egghead_elite" },
  },

  49: {
    title: "Egghead — Seraphim S-Hawk",
    boss: {
      name: "Seraphim S-Hawk",
      hpMax: 95000, atk: 470,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Green Blood Slash", type: "damage", multiplier: 2.0, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Pressure Edge", type: "stun", stunTurns: 1, cooldown: 6, chance: 40, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 22000, masteryMsgs: 97, dropTable: "egghead_seraphim" },
  },

  50: {
    title: "Egghead — Admiral Kizaru",
    boss: {
      name: "Kizaru (Borsalino)",
      hpMax: 120000, atk: 540,
      gif: null,
      isLogia: true, hasBuso: true,
      abilities: [
        { name: "Yasakani no Magatama", type: "damage", multiplier: 2.3, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
        { name: "Light Speed Kick", type: "damage", multiplier: 1.9, cooldown: 2, chance: 100, gif: null, usesBuso: true },
        { name: "Blinding Flash", type: "stun", stunTurns: 1, cooldown: 6, chance: 45, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 30000, masteryMsgs: 98, dropTable: "egghead_admiral" },
  },

  51: {
    title: "Egghead — Saturn",
    boss: {
      name: "Saint Jaygarcia Saturn",
      hpMax: 140000, atk: 580,
      gif: null,
      isLogia: false, hasBuso: true,
      abilities: [
        { name: "Demonic Pressure", type: "applyFailNext", nextFailChance: 50, cooldown: 5, chance: 80, gif: null },
        { name: "Piercing Stare", type: "stun", stunTurns: 1, cooldown: 6, chance: 55, gif: null, usesBuso: true },
        { name: "Unseen Grip", type: "damage", multiplier: 2.2, randomFactor: 0.25, cooldown: 3, chance: 100, gif: null, usesBuso: true },
      ],
    },
    rewards: { belly: 36000, masteryMsgs: 100, dropTable: "egghead_boss" },
  },
};

// API
function getMission(id) {
  return REGISTRY[String(id)] || null;
}

module.exports = { getMission, REGISTRY };
