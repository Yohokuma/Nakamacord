// db/items.js
module.exports = {
  fruits: {
    // ===================== BARA BARA (COMMON = 700) =====================
    "Bara Bara no Mi": {
      type: "fruit",
      rarity: "Common",
      starter: true,
      isLogia: false,
      stats: { hp: 380, attack: 160, speed: 160 }, // 380 + 160 + 160 = 700
      aliases: ["bara", "barabara", "bara bara no mi"],
      skills: [
        { name: "Bara Bara Punch", multiplier: 1.0, unlockAt: 1, gif: "https://i.makeagif.com/media/9-13-2015/2oVyV8.gif" },
        { name: "Bara Bara Nosenmei", multiplier: 1.4, unlockAt: 10, gif: "https://media.discordapp.net/attachments/1421812411182354563/1422563689604845659/bara-bara-no-mi_2.gif" },
        { name: "Bara Bara Festival", multiplier: 0.6, hits: 5, unlockAt: 20, gif: "https://media.discordapp.net/attachments/1421812411182354563/1422563614476206282/bara-bara-no-mi-buggy-vs-luffy.gif" }
      ]
    },

    // ===================== GOMU GOMU (RARE = 720) =====================
    "Gomu Gomu no Mi": {
      type: "fruit",
      rarity: "Rare",
      starter: false,
      isLogia: false,
      stats: { hp: 260, attack: 280, speed: 180 }, // 260 + 280 + 180 = 720
      aliases: ["gomu", "gomu gomu", "gomu gomu no mi"],
      transformBoosts: [{ form: "gear2", atkPercent: 15, hpPercent: 10 }],
      passives: [{ type: "dodgeChanceOnForm", form: "gear2", chance: 10, name: "Jet Evasion" }],
      skills: [
        { name: "Gomu Gomu no Pistol",  multiplier: 1.0, unlockAt: 1,  gif: "https://media.discordapp.net/attachments/1421812411182354563/1421812728703746161/luffy-pistol.gif" },
        { name: "Gomu Gomu no Bazooka", multiplier: 1.3, unlockAt: 12, gif: "https://media.discordapp.net/attachments/1421812411182354563/1421812976394047609/luffy.gif" },
        { name: "Gomu Gomu no Gatling", multiplier: 0.4, hits: 8, unlockAt: 20, gif: "https://media.discordapp.net/attachments/1421812411182354563/1421813297614819379/Gum_Gum.gif" },
        { name: "Gear Second", type: "transform", unlockAt: 25, duration: 5, cooldown: 4, gif: "https://media.discordapp.net/attachments/1421812411182354563/1421813683335467211/anger-luffy.gif" },
        { name: "Jet Pistol",  form: "gear2", multiplier: 1.5, unlockAt: 25, gif: "https://media.discordapp.net/attachments/1421812411182354563/1421814032897282189/descarga_2.gif" },
        { name: "Jet Bazooka", form: "gear2", multiplier: 1.8, unlockAt: 35, gif: "https://media.discordapp.net/attachments/1421812411182354563/1421815586329071616/nsaUvZ.gif" },
        { name: "Jet Gatling", form: "gear2", multiplier: 0.6, hits: 10, unlockAt: 40, gif: "https://media.discordapp.net/attachments/1421812411182354563/1421816315123077171/luffy_1.gif" }
      ]
    },

    // ===================== HIE HIE (LOGIA / LEGENDARY = 740) =====================
    "Hie Hie no Mi": {
      type: "fruit",
      rarity: "Legendary",
      starter: false,
      isLogia: true,
      aliases: ["hie", "hie hie", "hie hie no mi", "aokiji", "ice"],
      stats: { hp: 250, attack: 260, speed: 230 }, // 250 + 260 + 230
      skills: [
        { name: "Ice Time", multiplier: 1.2, unlockAt: 1,  gif: "https://media.discordapp.net/attachments/1422731616320753674/1422739414035202118/iEYOVF.gif", effects: { onHit: { type: "frozen", chance: 20, stunTurns: 1, nextFailChance: 30 } } },
        { name: "Ice Ball",  multiplier: 1.0, unlockAt: 12, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422737584907489410/one-piece-aokiji_1.gif", effects: { onHit: { type: "frozen", chance: 10, stunTurns: 1, nextFailChance: 30 } } },
        { name: "Ice block: Partisan", multiplier: 0.7, hits: 4, unlockAt: 18, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422734310015897651/static-assets-upload14920802586366544007.gif" },
        { name: "Ice block: Pheasant Beak", multiplier: 1.4, unlockAt: 25, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422736659866452079/pheasant-beak.gif", effects: { onHit: { type: "frozen", chance: 30, stunTurns: 1, nextFailChance: 30 } } },
        { name: "Ice Age", multiplier: 0.5, unlockAt: 60, cooldown: 4, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422733366482046976/ice-age.gif", effects: { onHit: { type: "frozen", chance: 100, stunTurns: 1, nextFailChance: 30 } } }
      ]
    },

    // ===================== YAMI YAMI (LOGIA / LEGENDARY = 740) =====================
    "Yami Yami no Mi": {
      type: "fruit",
      rarity: "Legendary",
      starter: false,
      isLogia: true, // Inmunidad tipo Logia (salvo Buso)
      // 240 + 300 + 200 = 740
      stats: { hp: 240, attack: 300, speed: 200 },
      aliases: ["yami", "yami yami", "yami yami no mi", "darkness", "blackbeard"],

      skills: [
        // --- 1) Black Hole: daño + 50% de stun (1 turno)
        {
          name: "Black Hole",
          multiplier: 1.2,
          unlockAt: 1,
          gif: "https://media.discordapp.net/attachments/1422731616320753674/1423649264222998648/2SW17R.gif?ex=68e1bcf2&is=68e06b72&hm=3cf1932b5fa45333b0dc1811862a40aea8cc2e9257f43faf89013fe24e129416&=",
          effects: { onHit: { type: "frozen", chance: 50, stunTurns: 1, nextFailChance: 30 } }
        },

        // --- 2) Liberation: daño + posibilidad de Knocked (30%)
        {
          name: "Liberation",
          multiplier: 1.5,
          unlockAt: 12,
          gif: "https://media.discordapp.net/attachments/1422731616320753674/1423649037852348416/Liberation_1.gif?ex=68e1bcbc&is=68e06b3c&hm=57194a18e81c2e4a8a14f43ba33743b14cc8c41e013d27c5402ac94f4c91c802&=",
          effects: { onHit: { type: "knockout", chance: 30, nextAttackBonus: 30 } }
        },

        // --- 3) Storm Of Darkness: multi-golpe (torbellino de sombras)
        {
          name: "Storm Of Darkness",
          multiplier: 0.45, // 5 golpes → aprox 2.25x ATK total
          hits: 5,
          unlockAt: 26,
          gif: "https://media.discordapp.net/attachments/1422731616320753674/1423649720034660452/vufn06huwdma1.gif?ex=68e1bd5f&is=68e06bdf&hm=980fe50d6be6e2700ed38c514fd38d9182e1b559f206b45c238a813d8311df13&="
        },

        // --- 4) Korozu: anula daño durante 2 turnos (cooldown 4)
        {
          name: "Korozu",
          type: "immortal",
          immortalTurns: 2,
          cooldown: 4,
          unlockAt: 35,
          gif: "https://media.discordapp.net/attachments/1422731616320753674/1423650914664841266/366afacc6b7065006a6da7f82c4e9c43.gif?ex=68e1be7c&is=68e06cfc&hm=812c9b5bb713ebdea439a384ef76177736011782fb7b5beb90a435827ba4c07f&="
        },

        // --- 5) Absorption: 100% stun por 2 turnos (cooldown 4)
        {
          name: "Absorption",
          multiplier: 0.9,
          cooldown: 4,
          unlockAt: 45,
          gif: "https://media.discordapp.net/attachments/1422731616320753674/1423651539482054827/FX0ZFv.gif?ex=68e1bf11&is=68e06d91&hm=c1232f1c17009ca45aacb0633fb3dc619c5387dd210137806991654e4525d8e1&=",
          effects: { onHit: { type: "frozen", chance: 100, stunTurns: 2, nextFailChance: 40 } }
        }
      ]
    },

    // ===================== TORI TORI (MYTHICAL = 760) =====================
    "Tori Tori no Mi: Model Phoenix": {
      type: "fruit",
      rarity: "Mythical",
      starter: false,
      isLogia: false, // Zoan mítica
      stats: { hp: 300, attack: 220, speed: 240 }, // total 760
      aliases: ["tori", "phoenix", "fenix", "tori tori", "tori tori no mi"],
      transformBoosts: [{ form: "fullform", atkPercent: 20, hpPercent: 40 }],
      skills: [
        { name: "Phoenix Kick",      multiplier: 1.2, unlockAt: 1,  gif: "https://media.discordapp.net/attachments/1422731616320753674/1422744519799214100/marco-the-phoenix-one-piece.gif" },
        { name: "Hoo-in Phoenix",    multiplier: 1.4, unlockAt: 12, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422744696496853023/Hoo-in.gif" },
        { name: "Healing",           type: "heal", healPercent: 20, cooldown: 2, unlockAt: 18, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422744936679346256/marco-one-piece-marco-the-phoenix.gif" },
        { name: "Phoenix Pyreapple", multiplier: 1.5, unlockAt: 30, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422746463070584892/tumblr_f82e48f91ad72005d2c301e45b8c9872_1b2fc831_540.gif.webp?ex=68e50ba6&is=68e3ba26&hm=6f0ee828ece7ee34747da3283c676d0134934211abdbd50f7882918663d25f50&=&animated=true.gif" },
        { name: "Phoenix Canon",     multiplier: 1.7, unlockAt: 40, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422747232356012152/8968a08c9e49807f8c399bca74d16973.gif" },
        { name: "Phoenix Full Form", type: "transform", form: "fullform", duration: 5, cooldown: 4, unlockAt: 35, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422756417982566410/tumblr_mgbrs6O3OC1r2sqylo1_500.gif" },
        { name: "Fly Immortal",           form: "fullform", type: "immortal", immortalTurns: 2, cooldown: 4, unlockAt: 35, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422748728363716649/222944.gif" },
        { name: "Hanging of the Phoenix", form: "fullform", multiplier: 1.3, unlockAt: 35, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422753070319796227/marco-one-piece-marco.gif" },
        { name: "Phoenix Tackle",         form: "fullform", multiplier: 1.2, healPercent: 10, unlockAt: 60, gif: "https://media.discordapp.net/attachments/1422731616320753674/1422755428575477800/one-piece-marco.gif" },
        {
          name: "Phoenix Charge Kick",
          form: "fullform",
          multiplier: 2.1,
          healPercent: 30,
          cooldown: 4,
          endForm: true,
          applyFormCooldown: true,
          unlockAt: 80,
          gif: "https://media.discordapp.net/attachments/1422731616320753674/1423078137322934382/570beb42caea408db220a2d4b2c6c33b.gif"
        }
      ]
    },

    // ===================== MOKU MOKU (LOGIA / RARE = 720) =====================
    "Moku Moku no Mi": {
      type: "fruit",
      rarity: "Rare",
      starter: false,
      isLogia: true, // inmunidad si el atacante no tiene Buso
      stats: { hp: 260, attack: 240, speed: 220 }, // 260 + 240 + 220 = 720
      aliases: ["moku", "moku moku", "moku moku no mi", "smoke", "smoker"],
      skills: [
        { name: "Smoke Tackle", multiplier: 1.1, unlockAt: 1,  gif: "https://media.discordapp.net/attachments/1422731616320753674/1423164729484120175/s5tj8v58ealf1.gif" },
        { name: "Smoke Shock",  multiplier: 1.3, unlockAt: 12, gif: "https://media.discordapp.net/attachments/1422731616320753674/1423165099933438002/m1ouw0kfd46b1.gif" },
        { name: "Smoke Blade",  multiplier: 1.5, unlockAt: 18, gif: "https://media.discordapp.net/attachments/1422731616320753674/1423166032629207120/t1382ccq7ifc1-_online-video-cutter.com_.gif" },
        { name: "Tornado Smoke Burst", multiplier: 0.45, hits: 5, unlockAt: 26, gif: "https://media.discordapp.net/attachments/1422731616320753674/1423166761624141845/WzCAZ4.gif" }
      ]
    },

    // ===================== OPE OPE (MYTHICAL = 760) =====================
    "Ope Ope no Mi": {
      type: "fruit",
      rarity: "Mythical",
      starter: false,
      isLogia: false,
      // 280 + 320 + 160 = 760
      stats: { hp: 280, attack: 320, speed: 160 },
      aliases: ["ope", "ope ope", "ope ope no mi", "room", "law", "traffy"],
      // Pasivas: ROOM al iniciar + Shambles (dodge 20%) + Amputation (30% stun 1)
      passives: [
        { type: "roomOnStart", name: "ROOM", gif: "https://media.discordapp.net/attachments/1421812411182354563/1424466514639196210/trafalgar-law-wano.gif?ex=68e40d52&is=68e2bbd2&hm=e0fb90662073bb3024c10bf21b0828a0bc145eb5f27aeb5843737634ef35cb02&=.gif" },
        { type: "dodgeShambles", name: "Shambles", chance: 40, gif: "https://media.discordapp.net/attachments/1421812411182354563/1424478542154174517/law-trafalgar-law_1.gif?ex=68e41885&is=68e2c705&hm=d22a93cb823b7d1bb9ddb05575ddd19c77c43b74f21eea71bba1335334f1784e&=.gif" },
    
      ],
      // Boost del K-ROOM al transformarse
      transformBoosts: [{ form: "kroom", atkPercent: 20, hpPercent: 20 }],
      skills: [
        // Base (fuera de forma)
        { name: "Radio Knife", multiplier: 1.55, unlockAt: 1,
          gif: "https://media.discordapp.net/attachments/1421812411182354563/1424455152429039657/traflager-law.gif?ex=68e402bd&is=68e2b13d&hm=1557675fdd306598c2172088f174e683761d2d8c49911cdba110e2440e81fdb5&=.gif",
          effects: { onHit: { type: "frozen", chance: 20, stunTurns: 1 } } },

        { name: "Tak", multiplier: 1.35, unlockAt: 8,
          gif: "https://media.discordapp.net/attachments/1421812411182354563/1424455910645956699/descarga.gif?ex=68e40372&is=68e2b1f2&hm=7f76cf7891bf8e78ee7128d5587ea0099483ee22293a0ea124e25ef6ab2060e9&=.gif",
          effects: { onHit: { type: "knockout", chance: 20, nextAttackBonus: 25 } } },

        // Debajo de Tak (tu pedido)
        { name: "Counter Shock", multiplier: 1.5, unlockAt: 14,
          gif: "https://media.discordapp.net/attachments/1421812411182354563/1424458240812650506/law-counter.gif?ex=68e4059d&is=68e2b41d&hm=d4cd2bdf5ed9bfd7215cead8a03380c27e501041512d34d0cb4449e1aa6b881b&=",
          effects: { onHit: { status: "electrified", chance: 15, pct: 12 } } },

        { name: "Mes", multiplier: 1.65, cooldown: 3, unlockAt: 16,
          gif: "https://media.discordapp.net/attachments/1421812411182354563/1424457250491203736/Law_vs_Smoker.gif?ex=68e404b1&is=68e2b331&hm=9a19109a9636a86115e90be8bdba0bf46e01e6745afde9e5008de26712bae20e&=.gif",
          effects: { onHit: { type: "frozen", chance: 30, stunTurns: 1 } } },

        { name: "Gamma Knife", multiplier: 1.8, unlockAt: 22, cooldown: 4,
          gif: "https://media.discordapp.net/attachments/1421812411182354563/1424459771242877018/law-trafalgar-law.gif?ex=68e4070a&is=68e2b58a&hm=bcdff166dab494a7e9ac5d060e3309cf746bb9a7e59b6e5f99e6ffd3adf955d5&=.gif",
          effects: { onHit: { status: "electrified", chance: 80, pct: 12 } } },

        // Transform
        { name: "Awaken: K-ROOM", type: "transform", form: "kroom", duration: 5, cooldown: 4, unlockAt: 28,
          gif: "https://media.discordapp.net/attachments/1421812411182354563/1424461801298464910/trafalgar-law-law-one-piece.gif?ex=68e408ee&is=68e2b76e&hm=aa7382a572f237b1b02e567b8c73149d31fe31e0b648fe2a50a197821194dae8&=.gif" },

        // Awaken-only (form: "kroom")
        { name: "Anesthesia", form: "kroom", multiplier: 1.5, unlockAt: 28,
          gif: "https://media.discordapp.net/attachments/1421812411182354563/1424461102149927044/law_radio_knife_one_piece_bd4db744-9e04-4632-a3e4-0e642079d4d6.webp?ex=68e40847&is=68e2b6c7&hm=5620b96521f8ff688e6e27641136093f382c5e8bd976adec4f70c24e10995e10&=&animated=true.gif",
          effects: { onHit: { type: "frozen", chance: 30, stunTurns: 1 } } },

        { name: "Shock Wille", form: "kroom", multiplier: 1.95, cooldown: 3, unlockAt: 36,
          gif: "https://media.discordapp.net/attachments/1421812411182354563/1424462276282290387/law-big-mom.gif?ex=68e4095f&is=68e2b7df&hm=ae58d56db04a8c9205dce05fda91c564acc1fd3031b02560e2c44a1bc13ebdf5&=.gif",
          tag: "shockwille",
          effects: { onHit: { type: "frozen", chance: 40, stunTurns: 1 } } },

        { name: "Puncture Wille", form: "kroom", multiplier: 2.35, cooldown: 4, unlockAt: 42,
          gif: "https://media.discordapp.net/attachments/1421812411182354563/1424466026879516783/law-puncture-wille.gif?ex=68e40cde&is=68e2bb5e&hm=e3ffb1195dd1960a79dde6212535cb6f8a8ead50f4ec80626095d233f51f222a&=.gif",
          requiresTagUsed: "shockwille",
          effects: { onHit: [
            { type: "frozen", chance: 100, stunTurns: 2 },
            { status: "electrified", chance: 100, pct: 12 }
          ] } }
      ]
    },
  },

  // ===================== WEAPONS =====================
  weapons: {
    "Ginga Pachinko": {
      type: "weapon",
      rarity: "Common",
      starter: true,
      isLogia: false,
      stats: { hp: 90, attack: 15, speed: 25 },
      aliases: ["ginga", "pachinko", "ginga pachinko"],
      skills: [
        { name: "Namari Boshi", multiplier: 1.0, unlockAt: 1,  gif: "https://media.discordapp.net/attachments/1421812411182354563/1421817104373383188/one-piece-namari-boshi.gif" },
        { name: "Kayaku Boshi", multiplier: 1.5, unlockAt: 12, gif: "https://media.discordapp.net/attachments/1421812411182354563/1421817123940073552/one-piece-kayaku-boshi.gif" },
        { name: "Dial Impact",  multiplier: 2.0, unlockAt: 22, gif: "https://media.discordapp.net/attachments/1421812411182354563/1421816593419206738/mpjddnywn28e1.gif" }
      ]
    }
  }
};
