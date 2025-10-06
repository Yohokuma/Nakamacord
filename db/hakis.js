// db/hakis.js
// ⚠️ Contrato que usan mission, PvP (accept) y hakimission:
// - hakis.buso.gif
// - hakis.ken.gif
// - hakis.hao.gif
// - hakis.hao.clashGif  (solo PvP cuando hay choque de Haoshoku)

module.exports = {
  buso: {
    name: "Buso Haki (Armament)",
    type: "haki",
    effect: "buso",
    description: "Allows you to hit Logia users and increases damage by 5%.",
    gif: "https://media.discordapp.net/attachments/1421812411182354563/1422584556493606973/one-piece-luffy_1.gif?ex=68dd349c&is=68dbe31c&hm=035f389f617675fcc8a356e23de4882a737c560d88cc7bd592aeb83f41930dbd&=.gif"
  },

  ken: {
    name: "Kenbunshoku Haki (Observation)",
    type: "haki",
    effect: "ken",
    description: "80% chance to dodge incoming attacks. Can be used up to 3 times per battle.",
    gif: "https://media.discordapp.net/attachments/1421812411182354563/1422585222347624548/qw7xNg3.gif?ex=68dd353b&is=68dbe3bb&hm=08a5275b7f825bdb6e25b2919fb7aa0e6a19f1c760804cbf6490aff85ed5edb8&=.gif"
  },

  hao: {
    name: "Haoshoku Haki (Conqueror’s)",
    type: "haki",
    effect: "hao",
    description: "30% chance to stun the opponent for one turn. In PvP, if both use Hao at the same time, a clash occurs.",
    gif: "https://media.discordapp.net/attachments/1421812411182354563/1422585268271054964/dfa6df4fb8f365791e636c22df0cb69dd06642ebr1-500-281_hq.gif?ex=68dd3546&is=68dbe3c6&hm=c79eb59f06c9914f52088ba0347e96d952668e80832672d9c640231902145080&=gif",
    clashGif: "https://media.discordapp.net/attachments/1421812411182354563/1422584746164359168/luffy-monkey-d-luffy.gif?ex=68dd34c9&is=68dbe349&hm=3aef9ad9987f85121ffa816af9fd2f1b6cdcd6cac130b014d54b966a75843990&=.gif"
  }
};
