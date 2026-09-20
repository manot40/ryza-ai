import { Langs } from './langs';

export type ContentLocale = 'en' | 'ja' | 'zh' | 'id';

export function resolveContentLocale(): ContentLocale {
  const lang = Langs.ui();
  if (lang === 'zh' || lang === 'zh-tw') return 'zh';
  if (lang === 'ja') return 'ja';
  if (lang === 'id') return 'id';
  return 'en';
}

interface QuestLocalization {
  title: string;
  desc: string;
  goal: string;
}

export const QUEST_CHAIN: Record<ContentLocale, Record<number, QuestLocalization>> = {
  ja: {
    1: {
      title: 'まずは会話をしてみよう',
      desc: 'ライザと会話して、お互いのことにもっと慣れる。',
      goal: 'ライザと4回話す',
    },
    2: {
      title: '島のあちこちを冒険',
      desc: 'ワールドマップを開いて、別の場所へ移動する。',
      goal: '別のステージへ2回移動',
    },
    3: {
      title: '素材集めの冒険',
      desc: '冒険の材料集め。バッグに素材を詰めてこよう。',
      goal: '素材を3つ集める',
    },
    4: {
      title: 'はじめての調合',
      desc: '集めた素材で、あたしと一緒に調合に挑戦！',
      goal: '調合を1回成功させる',
    },
    5: {
      title: '進路を阻む魔物',
      desc: '冒険の途中で魔物が出た。調合アイテムも使って突破しよう。',
      goal: '戦闘に1回勝つ',
    },
    6: {
      title: 'お店を一日経営してみよう',
      desc: 'いらないアイテムを並べて、お小遣い稼ぎ。',
      goal: 'お店でアイテムを売る',
    },
    7: {
      title: '船の材料を集めて造船',
      desc: '「まずは船を手に入れて」。船には部品が4つ必要らしい。',
      goal: '船の部品を4つそろえる',
    },
    8: {
      title: '船で自由に旅へ出よう',
      desc: '造船を完成させて、クーケン島の外へ！世界地図が解放される。',
      goal: '資金200Gで出航する',
    },
  },
  zh: {
    1: { title: '先来聊聊天吧', desc: '和莱莎对话，更熟悉彼此一点。', goal: '和莱莎聊4次' },
    2: { title: '在岛各处冒险', desc: '打开世界地图，移动到别的地方。', goal: '移动到别的舞台2次' },
    3: { title: '采集素材的冒险', desc: '冒险要用的材料采集。把背包装满吧。', goal: '采集3个素材' },
    4: { title: '第一次调和', desc: '用采集来的素材，和莱莎一起挑战调和！', goal: '成功调和1次' },
    5: { title: '挡路的魔物', desc: '冒险途中冒出魔物了。用调和道具突破吧。', goal: '赢得1次战斗' },
    6: { title: '经营店铺一整天', desc: '摆出不需要的道具，赚点零花钱。', goal: '在店里卖出道具' },
    7: { title: '收集造船材料', desc: '「首先得搞到船」。船好像需要4个部件。', goal: '凑齐4个船部件' },
    8: { title: '乘船自由远航', desc: '完成造船，离开库肯岛！世界地图就此解锁。', goal: '用200G出航' },
  },
  en: {
    1: {
      title: 'Let’s Talk First',
      desc: 'Chat with Ryza and get used to each other.',
      goal: 'Talk to Ryza 4 times',
    },
    2: {
      title: 'Explore the Island',
      desc: 'Open the world map and travel somewhere else.',
      goal: 'Move to another stage twice',
    },
    3: {
      title: 'Gathering Adventure',
      desc: 'Collect adventuring materials. Fill that bag!',
      goal: 'Gather 3 materials',
    },
    4: {
      title: 'First Synthesis',
      desc: 'Try alchemy with the materials you gathered!',
      goal: 'Craft successfully once',
    },
    5: {
      title: 'Monster in the Way',
      desc: 'A monster showed up. Break through with crafted items.',
      goal: 'Win one battle',
    },
    6: {
      title: 'A Day Running the Shop',
      desc: 'Set out spare items and earn some pocket money.',
      goal: 'Sell items at the shop',
    },
    7: {
      title: 'Gather Ship Parts',
      desc: '"First, get a ship." It apparently needs 4 parts.',
      goal: 'Collect 4 ship parts',
    },
    8: {
      title: 'Set Sail, Free!',
      desc: 'Finish the ship and leave Kurken Island! The world map opens.',
      goal: 'Pay 200G and sail',
    },
  },
  id: {
    1: {
      title: 'Mari Mengobrol Dulu',
      desc: 'Ngobrol dengan Ryza agar lebih akrab satu sama lain.',
      goal: 'Bicara dengan Ryza 4 kali',
    },
    2: {
      title: 'Petualangan Mengelilingi Pulau',
      desc: 'Buka peta dunia dan jelajahi tempat lain.',
      goal: 'Pindah ke panggung lain 2 kali',
    },
    3: {
      title: 'Petualangan Mengumpulkan Bahan',
      desc: 'Kumpulkan bahan petualangan. Penuhi tasmu!',
      goal: 'Kumpulkan 3 bahan',
    },
    4: {
      title: 'Sintesis Pertama',
      desc: 'Gunakan bahan yang terkumpul untuk mencoba alkimia bersama Ryza!',
      goal: 'Berhasil sintesis 1 kali',
    },
    5: {
      title: 'Monster Penghalang Jalan',
      desc: 'Monster muncul di perjalanan. Terobos menggunakan item hasil sintesis.',
      goal: 'Menangkan 1 pertarungan',
    },
    6: {
      title: 'Sehari Mengelola Toko',
      desc: 'Pajang barang yang tidak terpakai untuk mendapat uang saku.',
      goal: 'Jual barang di toko',
    },
    7: {
      title: 'Kumpulkan Bahan Pembuat Kapal',
      desc: '"Pertama, dapatkan kapal." Tampaknya butuh 4 bagian kapal.',
      goal: 'Kumpulkan 4 bagian kapal',
    },
    8: {
      title: 'Berlayar Bebas Mengarungi Samudra',
      desc: 'Selesaikan kapal dan tinggalkan Pulau Kurken! Peta dunia terbuka.',
      goal: 'Berlayar dengan biaya 200G',
    },
  },
};

export const QUEST_POOL: Record<ContentLocale, Record<number, QuestLocalization>> = {
  ja: {
    1: {
      title: '新しいレシピ',
      desc: 'まだ作ったことのない調合を、ライザと考える。',
      goal: '調合を1回成功させる',
    },
    2: { title: '水源の材料', desc: '水源の絶壁まわりで、新しい材料を探す。', goal: '素材を2つ集める' },
    3: {
      title: '星を見に行こう',
      desc: '夜のカーク群島、星見の高台まで一緒に歩く。',
      goal: '夜のステージへ移動',
    },
    4: { title: '廃村の住人', desc: '忘れ去られた廃村で、邪魔するやつを退治する。', goal: '戦闘に1回勝つ' },
    5: { title: '移動販売の一日', desc: '港の広場でちょっと商売してみない？', goal: 'お店でアイテムを売る' },
    6: {
      title: '思い出話',
      desc: 'ふたりが初めて会った日のことを、ゆっくり思い出す。',
      goal: 'ライザと3回話す',
    },
    7: {
      title: 'おやつ探し',
      desc: '甘いものの材料を集めて、あたしのおやつを作る。',
      goal: '素材を2つ集める',
    },
    8: { title: '遺跡の探索', desc: '封印の祭殿の奥まで、一緒に見て回ろう。', goal: '別のステージへ移動' },
  },
  zh: {
    1: { title: '新配方', desc: '和莱莎一起想一个从没试过的调和。', goal: '成功调和1次' },
    2: { title: '水源地的材料', desc: '去库肯岛水源瀑布潭附近找新材料。', goal: '采集2个素材' },
    3: { title: '去看星星', desc: '夜里一起走到库克群岛的观星高台。', goal: '移动到夜晚的舞台' },
    4: { title: '废村的住客', desc: '去被遗忘的废村，收拾挡路的家伙。', goal: '赢得1次战斗' },
    5: { title: '移动贩卖的一天', desc: '在港口广场做点小买卖怎么样？', goal: '在店里卖出道具' },
    6: { title: '回忆往事', desc: '慢慢回忆两人初次见面的那天。', goal: '和莱莎聊3次' },
    7: { title: '寻找点心', desc: '采集甜点的材料，给莱莎做点心。', goal: '采集2个素材' },
    8: { title: '遗迹探索', desc: '一起走到封印祭殿的深处看看。', goal: '移动到别的舞台' },
  },
  en: {
    1: {
      title: 'A New Recipe',
      desc: 'Dream up a synthesis you have never tried.',
      goal: 'Craft successfully once',
    },
    2: {
      title: 'Spring Materials',
      desc: 'Search near the waterfall pool at the spring.',
      goal: 'Gather 2 materials',
    },
    3: {
      title: 'Stargazing',
      desc: 'Walk together to the star-viewing height at night.',
      goal: 'Move to a night stage',
    },
    4: {
      title: 'Ruined Village Resident',
      desc: 'Deal with whatever bothers you in the forgotten ruins.',
      goal: 'Win one battle',
    },
    5: {
      title: 'Street Vendor Day',
      desc: 'How about a little business at the harbor plaza?',
      goal: 'Sell items at the shop',
    },
    6: { title: 'Memory Lane', desc: 'Recall the day we first met, slowly.', goal: 'Talk to Ryza 3 times' },
    7: { title: 'Snack Hunt', desc: 'Gather sweet ingredients for my snack.', goal: 'Gather 2 materials' },
    8: {
      title: 'Ruins Expedition',
      desc: 'Let’s look deeper into the sealed sanctuary.',
      goal: 'Move to another stage',
    },
  },
  id: {
    1: {
      title: 'Resep Baru',
      desc: 'Pikirkan resep sintesis yang belum pernah dicoba bersama Ryza.',
      goal: 'Berhasil sintesis 1 kali',
    },
    2: {
      title: 'Bahan Mata Air',
      desc: 'Cari bahan baru di sekitar kolam air terjun mata air.',
      goal: 'Kumpulkan 2 bahan',
    },
    3: {
      title: 'Melihat Bintang',
      desc: 'Berjalan bersama ke bukit pemantauan bintang di malam hari.',
      goal: 'Pindah ke panggung malam',
    },
    4: {
      title: 'Penghuni Desa Terbengkalai',
      desc: 'Bereskan monster yang mengganggu di reruntuhan terlupakan.',
      goal: 'Menangkan 1 pertarungan',
    },
    5: {
      title: 'Sehari Menjual Keliling',
      desc: 'Bagaimana kalau mencoba berdagang di alun-alun dermaga?',
      goal: 'Jual barang di toko',
    },
    6: {
      title: 'Mengenang Masa Lalu',
      desc: 'Mengingat kembali hari pertama kita bertemu secara perlahan.',
      goal: 'Bicara dengan Ryza 3 kali',
    },
    7: {
      title: 'Mencari Camilan',
      desc: 'Kumpulkan bahan manis untuk membuat camilan Ryza.',
      goal: 'Kumpulkan 2 bahan',
    },
    8: {
      title: 'Eksplorasi Reruntuhan',
      desc: 'Mari menjelajahi bagian terdalam kuil bersegel.',
      goal: 'Pindah ke panggung lain',
    },
  },
};

export const QUEST_OBSTACLES: Record<ContentLocale, Record<string, string>> = {
  ja: {
    gather: 'いい素材は少し奥まで入らないと採れないみたい。',
    craft: '調合は失敗しやすいから、材料は余裕をもって集めとこ。',
    battle: 'あ、強いのが出たら逃げてもいいからね…たぶん。',
    shop: '売れるか微妙だけど、やってみないと分からない！',
    build: '部品はどれも大きくて、一回じゃ運べそうにない。',
    explore: '最近道の様子がちょっと変なんだよね。',
    sail: '出航には資金も必要。お店で稼いでおこう。',
    talk: '',
  },
  zh: {
    gather: '好素材好像得往深处走才采得到。',
    craft: '调和容易失手，材料先多备点吧。',
    battle: '啊，遇到太强跑掉也没关系啦…大概。',
    shop: '不一定卖得动，但不试试怎么知道！',
    build: '每个部件都又大又重，一趟可搬不完。',
    explore: '最近路上的样子有点怪怪的。',
    sail: '出航还需要资金。开店赚一笔吧。',
    talk: '',
  },
  en: {
    gather: 'Good stuff grows deeper in, apparently.',
    craft: 'Synthesis fails easy — gather spare materials first.',
    battle: 'Um, if something too strong shows up we can run… probably.',
    shop: 'Not sure it will sell, but worth a try!',
    build: 'Every part is huge. One trip won’t carry them.',
    explore: 'The roads have felt a bit odd lately.',
    sail: 'Sailing costs money. Let’s earn some at the shop.',
    talk: '',
  },
  id: {
    gather: 'Bahan berkualitas sepertinya ada di tempat yang lebih dalam.',
    craft: 'Sintesis mudah gagal — siapkan bahan lebih banyak terlebih dahulu.',
    battle: 'Kalau ada monster yang terlalu kuat, kita kabur saja... mungkin.',
    shop: 'Belum tentu laku, tapi harus dicoba dulu!',
    build: 'Setiap bagian sangat besar dan berat, tidak bisa dibawa sekaligus.',
    explore: 'Akhir-akhir ini suasana jalurnya agak janggal.',
    sail: 'Berlayar butuh modal. Ayo kumpulkan uang dengan berdagang.',
    talk: '',
  },
};

export const QUEST_PRAISES: Record<ContentLocale, string[]> = {
  ja: ['すごい、クリアおめでとう！', '次のクエストもがんばろう', 'すごい！次はどんな冒険にする？'],
  zh: ['厉害，通关恭喜！', '下一个任务也加油吧', '太棒了！下次去什么样的冒险？'],
  en: ['Amazing, you cleared it!', 'Let’s keep going with the next quest', 'Awesome! What adventure next?'],
  id: [
    'Luar biasa, selamat telah menyelesaikannya!',
    'Ayo semangat untuk misi berikutnya',
    'Keren! Petualangan apa selanjutnya?',
  ],
};

export const ITEM_NAMES: Record<ContentLocale, Record<string, string>> = {
  ja: {
    emeralia: 'エメラリア草',
    uni: 'うに',
    wasser: '蒸留水',
    honey: '森のはちみつ',
    shell: '輝きの貝殻',
    ore: '魔石鉱のかけら',
    mushroom: '元気茸',
    driftwood: '漂流WOOD',
    ironwood: '堅鉄の木目',
    cloth: '帆布布切れ',
    bottle: '回復のボトル',
    bomb: '爆弾瓶',
    charm: 'お守りの指輪',
    relic: '古代の遺物',
    apple: 'スタミナリンゴ',
  },
  zh: {
    emeralia: '翡翠草',
    uni: '海胆',
    wasser: '蒸馏水',
    honey: '森林蜂蜜',
    shell: '光辉贝壳',
    ore: '魔石矿碎片',
    mushroom: '元气菇',
    driftwood: '漂流木',
    ironwood: '坚铁木',
    cloth: '帆布碎片',
    bottle: '回复药（草豆）',
    bomb: '爆弹瓶',
    charm: '守护指轮',
    relic: '古代遗物',
    apple: '体力苹果',
  },
  en: {
    emeralia: 'Emeralia Grass',
    uni: 'Sea Urchin',
    wasser: 'Distilled Water',
    honey: 'Forest Honey',
    shell: 'Radiant Shell',
    ore: 'Magic Ore Shard',
    mushroom: 'Vitality Mushroom',
    driftwood: 'Driftwood Log',
    ironwood: 'Ironwood Grain',
    cloth: 'Sailcloth Scrap',
    bottle: 'Healing Bottle',
    bomb: 'Bomb Vial',
    charm: 'Guardian Charm Ring',
    relic: 'Ancient Relic',
    apple: 'Stamina Apple',
  },
  id: {
    emeralia: 'Rumput Emeralia',
    uni: 'Bulu Babi',
    wasser: 'Air Suling',
    honey: 'Madu Hutan',
    shell: 'Kerang Berkilau',
    ore: 'Pecahan Bijih Sihir',
    mushroom: 'Jamur Vitalitas',
    driftwood: 'Kayu Hanyut',
    ironwood: 'Kayu Besi',
    cloth: 'Kain Layar',
    bottle: 'Botol Pemulih',
    bomb: 'Botol Bom',
    charm: 'Cincin Pelindung',
    relic: 'Peninggalan Kuno',
    apple: 'Apel Stamina',
  },
};

export const RECIPE_NAMES: Record<ContentLocale, Record<string, string>> = {
  ja: {
    bottle: '回復のボトル',
    bomb: '爆弾瓶',
    charm: 'お守りの指輪',
  },
  zh: {
    bottle: '回复瓶',
    bomb: '爆弹瓶',
    charm: '守护指轮',
  },
  en: {
    bottle: 'Healing Bottle',
    bomb: 'Bomb Vial',
    charm: 'Guardian Charm Ring',
  },
  id: {
    bottle: 'Botol Pemulih',
    bomb: 'Botol Bom',
    charm: 'Cincin Pelindung',
  },
};

export const WORLD_NAMES: Record<ContentLocale, Record<string, string>> = {
  ja: {
    // Areas
    area_01: 'クーケン島周辺地域',
    area_02: 'クレリア地方',
    area_03: 'ネメド地方',
    area_04: '異界オーリム',
    area_05: '王都周辺地域',

    // Fields
    field_01_001: 'クーケン島',
    field_01_002: '小妖精の森',
    field_01_003: '旅人の道',
    field_01_004: '水没坑道',
    field_01_005: '隠された入り江',
    field_01_006: '流星の古城',
    field_01_007: '火山ヴァイスベルク',
    field_01_008: 'メイプルデルタ',
    field_01_009: 'リーゼ峡谷',
    field_01_010: 'ピオニール聖塔',
    field_01_011: '忘れ去られた廃村',
    field_01_012: '古びた大邸宅',
    field_01_013: 'カーク群島',
    field_01_014: '万象の大典',

    field_02_001: '採掘街道',
    field_02_002: 'サルドニカ',
    field_02_003: 'アストラード高地',
    field_02_004: '魔石搬送路',
    field_02_005: 'シンティラ鉱山',

    field_03_001: 'ポルッタ丘陵',
    field_03_002: 'ネメド大森林',
    field_03_003: '花道田園',
    field_03_004: '竜尾大山道',
    field_03_005: '山果ての廃神殿',

    field_04_001: 'ウルディスの聖跡',
    field_04_002: '鳥の峠',
    field_04_003: '悠遠の匣',

    field_05_001: '王都近郊',
    field_05_002: '王都アスラ・アム・バート',
    field_05_003: '風鳴谷',
    field_05_004: '王都南方',
    field_05_005: '北の大地',
    field_05_006: '霊なる竜の棺',
    field_05_007: '古代マナ工房',
    field_05_008: '地下乙女の墓所',
    field_05_009: '水底の星都',
    field_05_010: 'ミラージュラント',
    field_05_012: '伝承の竜骨谷',

    // Notable stages
    stage_01_001_01: '尖塔の貯水池',
    stage_01_001_02: '魔石の灯台',
    stage_01_001_04: 'ライザの家',
    stage_01_001_05: 'ヤギの放牧地',
    stage_01_001_06: '憩いの広場',
    stage_01_001_08: '水源の滝つぼ',
    stage_01_002_01: '隠れ家前',
    stage_01_002_02: '彩花の円環',
    stage_01_002_03: 'ランタン樹',
    stage_01_002_04: '切り株のステージ',
    stage_01_003_01: '対岸の砂浜',
    stage_01_003_02: 'オオイタチの花園',
    stage_01_003_03: '旧街道遺跡',
    stage_01_003_04: '道分かつ大樹',
    stage_01_003_05: '稀なる者の祭壇',
    stage_01_013_02: '星見の高台',
  },
  zh: {
    // Areas
    area_01: '库肯岛周边地区',
    area_02: '克莱莉亚地区',
    area_03: '内梅德地区',
    area_04: '异界奥里姆',
    area_05: '王都周边地区',

    // Fields
    field_01_001: '库肯岛',
    field_01_002: '小妖精之森',
    field_01_003: '旅人之道',
    field_01_004: '水没坑道',
    field_01_005: '隐秘入江',
    field_01_006: '流星古城',
    field_01_007: '魏斯伯格火山',
    field_01_008: '枫叶三角洲',
    field_01_009: '丽泽峡谷',
    field_01_010: '皮奥尼尔圣塔',
    field_01_011: '被遗忘的废村',
    field_01_012: '陈旧大宅',
    field_01_013: '库克群岛',
    field_01_014: '万象大典',

    field_02_001: '采掘街道',
    field_02_002: '萨尔多尼卡',
    field_02_003: '阿斯特拉德高地',
    field_02_004: '魔石搬运路',
    field_02_005: '欣蒂拉矿山',

    field_03_001: '波鲁塔丘陵',
    field_03_002: '内梅德大森林',
    field_03_003: '花道田园',
    field_03_004: '龙尾大山道',
    field_03_005: '山顶的废神殿',

    field_04_001: '乌尔迪斯的圣迹',
    field_04_002: '鸟之峠',
    field_04_003: '悠远之匣',

    field_05_001: '王都近郊',
    field_05_002: '王都阿斯拉・阿姆・伯特',
    field_05_003: '风鸣谷',
    field_05_004: '王都南方',
    field_05_005: '北方大地',
    field_05_006: '灵龙之棺',
    field_05_007: '古代玛娜工房',
    field_05_008: '地下少女墓所',
    field_05_009: '水底星都',
    field_05_010: '蜃景湿地',
    field_05_012: '传承龙骨谷',

    // Notable stages
    stage_01_001_01: '尖塔储水池',
    stage_01_001_02: '魔石灯塔',
    stage_01_001_04: '莱莎的家',
    stage_01_001_05: '山羊牧场',
    stage_01_001_06: '安憩广场',
    stage_01_001_08: '水源瀑布潭',
    stage_01_002_01: '秘密藏身处前',
    stage_01_002_02: '彩花圆环',
    stage_01_002_03: '提灯树',
    stage_01_002_04: '树桩舞台',
    stage_01_003_01: '对岸沙滩',
    stage_01_003_02: '大鼬花园',
    stage_01_003_03: '旧街道遗迹',
    stage_01_003_04: '分岔大树',
    stage_01_003_05: '罕见者祭坛',
    stage_01_013_02: '观星高台',
  },
  en: {
    // Areas
    area_01: 'Kurken Island Area',
    area_02: 'Cleria Region',
    area_03: 'Nemed Region',
    area_04: 'Underworld Orim',
    area_05: 'Royal Capital Area',

    // Fields
    field_01_001: 'Kurken Island',
    field_01_002: 'Pixie Forest',
    field_01_003: 'Traveler’s Road',
    field_01_004: 'Sunken Mine',
    field_01_005: 'Hidden Cove',
    field_01_006: 'Meteor Castle',
    field_01_007: 'Weissberg Volcano',
    field_01_008: 'Maple Delta',
    field_01_009: 'Liese Gorge',
    field_01_010: 'Pynnor Holy Tower',
    field_01_011: 'Forgotten Village',
    field_01_012: 'Old Mansion',
    field_01_013: 'Kark Isles',
    field_01_014: 'Code of the Universe',

    field_02_001: 'Mining Highway',
    field_02_002: 'Sardonica',
    field_02_003: 'Astrard Heights',
    field_02_004: 'Magic Stone Path',
    field_02_005: 'Scintilla Mine',

    field_03_001: 'Poluta Hills',
    field_03_002: 'Nemed Great Forest',
    field_03_003: 'Flower Road Farmland',
    field_03_004: 'Dragon Tail Mountain Path',
    field_03_005: 'Abandoned Mountain Temple',

    field_04_001: 'Urdis Sanctuary',
    field_04_002: 'Bird’s Pass',
    field_04_003: 'Eternity’s Coffer',

    field_05_001: 'Capital Outskirts',
    field_05_002: 'Ashra-am Baird',
    field_05_003: 'Windcall Valley',
    field_05_004: 'Capital South',
    field_05_005: 'Northern Lands',
    field_05_006: 'Dragon’s Coffin',
    field_05_007: 'Ancient Mana Workshop',
    field_05_008: 'Maiden’s Tomb',
    field_05_009: 'Submerged City',
    field_05_010: 'Mirage Land',
    field_05_012: 'Valley of Dragon Bones',

    // Notable stages
    stage_01_001_01: 'Spire Reservoir',
    stage_01_001_02: 'Magic Stone Lighthouse',
    stage_01_001_04: 'Ryza’s Home',
    stage_01_001_05: 'Goat Pasture',
    stage_01_001_06: 'Resting Plaza',
    stage_01_001_08: 'Waterfall Basin',
    stage_01_002_01: 'Secret Hideout Front',
    stage_01_002_02: 'Floral Circle',
    stage_01_002_03: 'Lantern Tree',
    stage_01_002_04: 'Stump Stage',
    stage_01_003_01: 'Opposite Shore Beach',
    stage_01_003_02: 'Giant Weasel Flower Garden',
    stage_01_003_03: 'Old Road Ruins',
    stage_01_003_04: 'Fork Tree',
    stage_01_003_05: 'Altar of the Rare Ones',
    stage_01_013_02: 'Star-viewing Heights',
  },
  id: {
    // Areas
    area_01: 'Daerah Sekitar Pulau Kurken',
    area_02: 'Wilayah Cleria',
    area_03: 'Wilayah Nemed',
    area_04: 'Dunia Lain Orim',
    area_05: 'Daerah Sekitar Ibu Kota',

    // Fields
    field_01_001: 'Pulau Kurken',
    field_01_002: 'Hutan Pixie',
    field_01_003: 'Jalan Pengelana',
    field_01_004: 'Tambang Tenggelam',
    field_01_005: 'Teluk Tersembunyi',
    field_01_006: 'Kastel Meteor',
    field_01_007: 'Gunung Berapi Weissberg',
    field_01_008: 'Delta Maple',
    field_01_009: 'Ngarai Liese',
    field_01_010: 'Menara Suci Pynnor',
    field_01_011: 'Desa Terbengkalai',
    field_01_012: 'Rumah Megah Kuno',
    field_01_013: 'Kepulauan Kark',
    field_01_014: 'Kitab Semesta',

    field_02_001: 'Jalur Penambangan',
    field_02_002: 'Sardonica',
    field_02_003: 'Dataran Tinggi Astrard',
    field_02_004: 'Jalur Batu Sihir',
    field_02_005: 'Tambang Scintilla',

    field_03_001: 'Perbukitan Poluta',
    field_03_002: 'Hutan Rimba Nemed',
    field_03_003: 'Lahan Pertanian Jalur Bunga',
    field_03_004: 'Jalur Gunung Ekor Naga',
    field_03_005: 'Kuil Gunung Terbengkalai',

    field_04_001: 'Tempat Suci Urdis',
    field_04_002: 'Celah Burung',
    field_04_003: 'Peti Keabadian',

    field_05_001: 'Pinggiran Ibu Kota',
    field_05_002: 'Ashra-am Baird',
    field_05_003: 'Lembah Angin Semilir',
    field_05_004: 'Selatan Ibu Kota',
    field_05_005: 'Dataran Utara',
    field_05_006: 'Peti Mati Naga Suci',
    field_05_007: 'Bengkel Mana Kuno',
    field_05_008: 'Makam Putri Bawah Tanah',
    field_05_009: 'Kota Bintang Dasar Air',
    field_05_010: 'Lahan Fatamorgana',
    field_05_012: 'Lembah Tulang Naga Legendaris',

    // Notable stages
    stage_01_001_01: 'Waduk Menara',
    stage_01_001_02: 'Mercusuar Batu Sihir',
    stage_01_001_04: 'Rumah Ryza',
    stage_01_001_05: 'Padang Rumput Kambing',
    stage_01_001_06: 'Alun-Alun Istirahat',
    stage_01_001_08: 'Kolam Air Terjun',
    stage_01_002_01: 'Depan Tempat Persembunyian',
    stage_01_002_02: 'Lingkaran Bunga Berwarna',
    stage_01_002_03: 'Pohon Lentera',
    stage_01_002_04: 'Panggung Tunggul Pohon',
    stage_01_003_01: 'Pantai Seberang',
    stage_01_003_02: 'Taman Bunga Musang Raksasa',
    stage_01_003_03: 'Reruntuhan Jalur Lama',
    stage_01_003_04: 'Pohon Besar Percabangan',
    stage_01_003_05: 'Altar Kaum Langka',
    stage_01_013_02: 'Bukit Pengamatan Bintang',
  },
};

// Accessor functions
export function getQuestTitle(no: number, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return (
    QUEST_CHAIN[loc]?.[no]?.title ||
    QUEST_CHAIN.en?.[no]?.title ||
    QUEST_CHAIN.ja?.[no]?.title ||
    fallback ||
    ''
  );
}

export function getQuestDesc(no: number, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return (
    QUEST_CHAIN[loc]?.[no]?.desc || QUEST_CHAIN.en?.[no]?.desc || QUEST_CHAIN.ja?.[no]?.desc || fallback || ''
  );
}

export function getQuestGoal(no: number, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return (
    QUEST_CHAIN[loc]?.[no]?.goal || QUEST_CHAIN.en?.[no]?.goal || QUEST_CHAIN.ja?.[no]?.goal || fallback || ''
  );
}

export function getPoolQuestTitle(no: number, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return (
    QUEST_POOL[loc]?.[no]?.title || QUEST_POOL.en?.[no]?.title || QUEST_POOL.ja?.[no]?.title || fallback || ''
  );
}

export function getPoolQuestDesc(no: number, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return (
    QUEST_POOL[loc]?.[no]?.desc || QUEST_POOL.en?.[no]?.desc || QUEST_POOL.ja?.[no]?.desc || fallback || ''
  );
}

export function getPoolQuestGoal(no: number, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return (
    QUEST_POOL[loc]?.[no]?.goal || QUEST_POOL.en?.[no]?.goal || QUEST_POOL.ja?.[no]?.goal || fallback || ''
  );
}

export function getQuestObstacle(type: string, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return (
    QUEST_OBSTACLES[loc]?.[type] || QUEST_OBSTACLES.en?.[type] || QUEST_OBSTACLES.ja?.[type] || fallback || ''
  );
}

export function getQuestPraise(idx: number, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  const arr = QUEST_PRAISES[loc] || QUEST_PRAISES.en;
  return arr[idx % arr.length] || fallback || '';
}

export function getItemName(id: string, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return ITEM_NAMES[loc]?.[id] || ITEM_NAMES.en?.[id] || ITEM_NAMES.ja?.[id] || fallback || id;
}

export function getRecipeName(outId: string, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return (
    RECIPE_NAMES[loc]?.[outId] || RECIPE_NAMES.en?.[outId] || RECIPE_NAMES.ja?.[outId] || fallback || outId
  );
}

export function getWorldName(id: string, fallback?: string, locale?: ContentLocale): string {
  const loc = locale || resolveContentLocale();
  return WORLD_NAMES[loc]?.[id] || WORLD_NAMES.en?.[id] || WORLD_NAMES.ja?.[id] || fallback || id;
}
