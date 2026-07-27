const GROUND = 408;

function plat(x, top, width, height = 54, tone = "#5c6b78") {
  return { x, y: top + height, width, height, tone };
}

function hook(x, y, radius = 14) {
  return { x, y, radius };
}

function apple(x, y) {
  return { x, y, radius: 9 };
}

function coin(x, y) {
  return { x, y, radius: 7 };
}

function breakable(x, top, width, height, kind = "crate") {
  return { x, y: top, width, height, kind, broken: false };
}

function ramp(x, top, width, rise = 28) {
  return { x, y: top, width, rise };
}

export const WORLDS = [
  { id: "yard", name: "Apple Yard", tint: "#eaf8fc" },
  { id: "rooftops", name: "Rooftops", tint: "#e8f0f8" },
  { id: "city", name: "Downtown", tint: "#dde8f2" },
];

export const SHOP_ITEMS = [
  {
    id: "helmet",
    name: "Helmet",
    cost: 25,
    blurb: "Survive one rough landing without dropping coins.",
  },
  {
    id: "banana",
    name: "Banana",
    cost: 40,
    blurb: "Slip the thief once during the next level.",
  },
  {
    id: "baseball",
    name: "Baseball",
    cost: 35,
    blurb: "Throw ahead to smash crates or slow the thief.",
  },
  {
    id: "continue",
    name: "Skate on",
    cost: 0,
    blurb: "Leave the shop and chase those apples.",
  },
];

/** @type {Array<{
 *  id: string,
 *  world: number,
 *  name: string,
 *  thiefPace: number,
 *  finishX: number,
 *  platforms: Array<object>,
 *  hooks: Array<object>,
 *  apples: Array<object>,
 *  coins: Array<object>,
 *  breakables: Array<object>,
 *  ramps: Array<object>,
 * }>} */
export const LEVELS = [
  {
    id: "yard-1",
    world: 0,
    name: "Garden Gate",
    thiefPace: 3.6,
    finishX: 1960,
    platforms: [
      plat(0, GROUND - 54, 520),
      plat(600, GROUND - 54, 220),
      plat(900, GROUND - 70, 200, 70),
      plat(1200, GROUND - 54, 260),
      plat(1540, GROUND - 64, 220, 64),
      plat(1840, GROUND - 54, 200),
    ],
    hooks: [hook(980, GROUND - 150)],
    apples: [apple(690, GROUND - 72), apple(1300, GROUND - 72), apple(1640, GROUND - 82)],
    coins: [coin(220, GROUND - 72), coin(1040, GROUND - 90), coin(1720, GROUND - 82)],
    breakables: [breakable(1230, GROUND - 90, 22, 36, "crate")],
    ramps: [ramp(900, GROUND - 70, 80, 16)],
  },
  {
    id: "yard-2",
    world: 0,
    name: "Clothesline",
    thiefPace: 3.75,
    finishX: 1780,
    platforms: [
      plat(0, GROUND - 54, 280),
      plat(360, GROUND - 80, 180, 80),
      plat(640, GROUND - 54, 160),
      plat(900, GROUND - 96, 200, 96),
      plat(1200, GROUND - 60, 220, 60),
      plat(1520, GROUND - 54, 320),
    ],
    hooks: [hook(520, GROUND - 170), hook(1050, GROUND - 190)],
    apples: [apple(430, GROUND - 98), apple(980, GROUND - 114), apple(1340, GROUND - 78)],
    coins: [coin(180, GROUND - 72), coin(740, GROUND - 72), coin(1280, GROUND - 78), coin(1650, GROUND - 72)],
    breakables: [breakable(930, GROUND - 132, 18, 36, "chimney")],
    ramps: [],
  },
  {
    id: "yard-3",
    world: 0,
    name: "Shed Hop",
    thiefPace: 3.9,
    finishX: 1860,
    platforms: [
      plat(0, GROUND - 54, 240),
      plat(320, GROUND - 64, 140, 64),
      plat(540, GROUND - 100, 160, 100),
      plat(800, GROUND - 54, 180),
      plat(1080, GROUND - 88, 190, 88),
      plat(1380, GROUND - 54, 200),
      plat(1680, GROUND - 70, 260, 70),
    ],
    hooks: [hook(620, GROUND - 180), hook(1180, GROUND - 175)],
    apples: [apple(390, GROUND - 82), apple(900, GROUND - 72), apple(1480, GROUND - 72)],
    coins: [coin(140, GROUND - 72), coin(700, GROUND - 120), coin(1260, GROUND - 106), coin(1760, GROUND - 88)],
    breakables: [
      breakable(830, GROUND - 90, 22, 36, "crate"),
      breakable(1410, GROUND - 90, 22, 36, "crate"),
    ],
    ramps: [ramp(540, GROUND - 100, 70, 20)],
  },
  {
    id: "yard-4",
    world: 0,
    name: "Orchard Chase",
    thiefPace: 4.05,
    finishX: 1980,
    platforms: [
      plat(0, GROUND - 54, 260),
      plat(340, GROUND - 72, 160, 72),
      plat(600, GROUND - 54, 140),
      plat(840, GROUND - 110, 180, 110),
      plat(1140, GROUND - 64, 170, 64),
      plat(1420, GROUND - 96, 180, 96),
      plat(1720, GROUND - 54, 340),
    ],
    hooks: [hook(460, GROUND - 160), hook(960, GROUND - 200), hook(1540, GROUND - 185)],
    apples: [apple(420, GROUND - 90), apple(1220, GROUND - 82), apple(1520, GROUND - 114)],
    coins: [coin(160, GROUND - 72), coin(720, GROUND - 72), coin(1040, GROUND - 128), coin(1800, GROUND - 72)],
    breakables: [breakable(880, GROUND - 146, 18, 36, "chimney")],
    ramps: [ramp(840, GROUND - 110, 90, 24)],
  },
  {
    id: "roof-1",
    world: 1,
    name: "First Leap",
    thiefPace: 4.15,
    finishX: 1920,
    platforms: [
      plat(0, GROUND - 60, 240, 60, "#4a5864"),
      plat(340, GROUND - 88, 170, 88, "#4a5864"),
      plat(620, GROUND - 54, 150, 54, "#5c6b78"),
      plat(900, GROUND - 100, 190, 100, "#4a5864"),
      plat(1220, GROUND - 70, 180, 70, "#5c6b78"),
      plat(1520, GROUND - 90, 200, 90, "#4a5864"),
      plat(1800, GROUND - 54, 220),
    ],
    hooks: [hook(480, GROUND - 175), hook(1040, GROUND - 195)],
    apples: [apple(420, GROUND - 106), apple(1000, GROUND - 118), apple(1620, GROUND - 108)],
    coins: [coin(150, GROUND - 78), coin(720, GROUND - 72), coin(1340, GROUND - 88), coin(1700, GROUND - 108)],
    breakables: [
      breakable(940, GROUND - 136, 18, 36, "chimney"),
      breakable(1260, GROUND - 106, 22, 36, "crate"),
    ],
    ramps: [ramp(900, GROUND - 100, 80, 22)],
  },
  {
    id: "roof-2",
    world: 1,
    name: "Chimney Row",
    thiefPace: 4.3,
    finishX: 2040,
    platforms: [
      plat(0, GROUND - 54, 220),
      plat(320, GROUND - 78, 150, 78, "#4a5864"),
      plat(560, GROUND - 110, 160, 110, "#4a5864"),
      plat(840, GROUND - 54, 140),
      plat(1100, GROUND - 96, 180, 96, "#4a5864"),
      plat(1400, GROUND - 64, 160, 64),
      plat(1680, GROUND - 108, 180, 108, "#4a5864"),
      plat(1960, GROUND - 54, 200),
    ],
    hooks: [hook(420, GROUND - 165), hook(680, GROUND - 200), hook(1240, GROUND - 185)],
    apples: [apple(390, GROUND - 96), apple(1180, GROUND - 114), apple(1780, GROUND - 126)],
    coins: [coin(120, GROUND - 72), coin(760, GROUND - 72), coin(1480, GROUND - 82), coin(1880, GROUND - 126)],
    breakables: [
      breakable(590, GROUND - 146, 18, 36, "chimney"),
      breakable(1140, GROUND - 132, 18, 36, "chimney"),
      breakable(1720, GROUND - 144, 18, 36, "chimney"),
    ],
    ramps: [],
  },
  {
    id: "roof-3",
    world: 1,
    name: "Wire Swing",
    thiefPace: 4.4,
    finishX: 2100,
    platforms: [
      plat(0, GROUND - 54, 200),
      plat(300, GROUND - 90, 140, 90, "#4a5864"),
      plat(540, GROUND - 54, 120),
      plat(780, GROUND - 120, 170, 120, "#4a5864"),
      plat(1080, GROUND - 70, 150, 70),
      plat(1360, GROUND - 100, 170, 100, "#4a5864"),
      plat(1660, GROUND - 54, 160),
      plat(1940, GROUND - 84, 260, 84, "#4a5864"),
    ],
    hooks: [
      hook(380, GROUND - 180),
      hook(900, GROUND - 210),
      hook(1480, GROUND - 195),
      hook(1780, GROUND - 150),
    ],
    apples: [apple(360, GROUND - 108), apple(880, GROUND - 138), apple(1460, GROUND - 118)],
    coins: [coin(100, GROUND - 72), coin(640, GROUND - 72), coin(1200, GROUND - 88), coin(2020, GROUND - 102)],
    breakables: [breakable(820, GROUND - 156, 22, 36, "crate")],
    ramps: [ramp(780, GROUND - 120, 90, 28)],
  },
  {
    id: "roof-4",
    world: 1,
    name: "Sky Bridge",
    thiefPace: 4.55,
    finishX: 2180,
    platforms: [
      plat(0, GROUND - 60, 210, 60),
      plat(320, GROUND - 100, 150, 100, "#4a5864"),
      plat(580, GROUND - 64, 130, 64),
      plat(840, GROUND - 120, 160, 120, "#4a5864"),
      plat(1140, GROUND - 54, 140),
      plat(1400, GROUND - 108, 170, 108, "#4a5864"),
      plat(1700, GROUND - 72, 160, 72),
      plat(1980, GROUND - 96, 280, 96, "#4a5864"),
    ],
    hooks: [hook(420, GROUND - 190), hook(960, GROUND - 220), hook(1520, GROUND - 200)],
    apples: [apple(400, GROUND - 118), apple(940, GROUND - 138), apple(1800, GROUND - 90)],
    coins: [coin(140, GROUND - 78), coin(700, GROUND - 82), coin(1280, GROUND - 72), coin(1600, GROUND - 126), coin(2080, GROUND - 114)],
    breakables: [
      breakable(880, GROUND - 156, 18, 36, "chimney"),
      breakable(1440, GROUND - 144, 22, 36, "crate"),
    ],
    ramps: [ramp(840, GROUND - 120, 100, 30)],
  },
  {
    id: "city-1",
    world: 2,
    name: "Lobby Dash",
    thiefPace: 4.65,
    finishX: 2200,
    platforms: [
      plat(0, GROUND - 54, 220, 54, "#4a5864"),
      plat(340, GROUND - 86, 160, 86, "#5c6b78"),
      plat(620, GROUND - 120, 150, 120, "#4a5864"),
      plat(900, GROUND - 64, 160, 64),
      plat(1200, GROUND - 108, 170, 108, "#4a5864"),
      plat(1500, GROUND - 54, 150),
      plat(1780, GROUND - 92, 180, 92, "#4a5864"),
      plat(2060, GROUND - 54, 240),
    ],
    hooks: [hook(460, GROUND - 175), hook(760, GROUND - 210), hook(1340, GROUND - 195)],
    apples: [apple(420, GROUND - 104), apple(1000, GROUND - 82), apple(1880, GROUND - 110)],
    coins: [coin(120, GROUND - 72), coin(780, GROUND - 138), coin(1400, GROUND - 126), coin(1640, GROUND - 72)],
    breakables: [
      breakable(940, GROUND - 100, 28, 36, "window"),
      breakable(1820, GROUND - 128, 28, 36, "window"),
    ],
    ramps: [ramp(620, GROUND - 120, 80, 26)],
  },
  {
    id: "city-2",
    world: 2,
    name: "Glass Lane",
    thiefPace: 4.8,
    finishX: 2280,
    platforms: [
      plat(0, GROUND - 54, 200),
      plat(300, GROUND - 96, 140, 96, "#4a5864"),
      plat(560, GROUND - 54, 120),
      plat(800, GROUND - 130, 160, 130, "#4a5864"),
      plat(1100, GROUND - 74, 150, 74),
      plat(1380, GROUND - 110, 160, 110, "#4a5864"),
      plat(1680, GROUND - 54, 150),
      plat(1960, GROUND - 100, 180, 100, "#4a5864"),
      plat(2220, GROUND - 54, 180),
    ],
    hooks: [hook(380, GROUND - 185), hook(920, GROUND - 230), hook(1500, GROUND - 200), hook(2080, GROUND - 190)],
    apples: [apple(360, GROUND - 114), apple(900, GROUND - 148), apple(1780, GROUND - 72)],
    coins: [coin(100, GROUND - 72), coin(680, GROUND - 72), coin(1220, GROUND - 92), coin(1580, GROUND - 128), coin(2060, GROUND - 118)],
    breakables: [
      breakable(840, GROUND - 166, 28, 36, "window"),
      breakable(1420, GROUND - 146, 22, 36, "crate"),
      breakable(2000, GROUND - 136, 28, 36, "window"),
    ],
    ramps: [],
  },
  {
    id: "city-3",
    world: 2,
    name: "Billboard Drop",
    thiefPace: 4.95,
    finishX: 2340,
    platforms: [
      plat(0, GROUND - 60, 210, 60, "#4a5864"),
      plat(330, GROUND - 110, 140, 110),
      plat(580, GROUND - 54, 120),
      plat(820, GROUND - 140, 150, 140, "#4a5864"),
      plat(1120, GROUND - 80, 140, 80),
      plat(1400, GROUND - 120, 160, 120, "#4a5864"),
      plat(1700, GROUND - 64, 150, 64),
      plat(1980, GROUND - 108, 170, 108, "#4a5864"),
      plat(2240, GROUND - 54, 220),
    ],
    hooks: [hook(420, GROUND - 200), hook(940, GROUND - 240), hook(1520, GROUND - 215)],
    apples: [apple(400, GROUND - 128), apple(920, GROUND - 158), apple(2080, GROUND - 126)],
    coins: [coin(140, GROUND - 78), coin(700, GROUND - 72), coin(1240, GROUND - 98), coin(1600, GROUND - 138), coin(2160, GROUND - 126)],
    breakables: [
      breakable(860, GROUND - 176, 28, 36, "window"),
      breakable(1440, GROUND - 156, 18, 36, "chimney"),
    ],
    ramps: [ramp(820, GROUND - 140, 100, 32)],
  },
  {
    id: "city-4",
    world: 2,
    name: "Penthouse Finale",
    thiefPace: 5.1,
    finishX: 2460,
    platforms: [
      plat(0, GROUND - 54, 200),
      plat(300, GROUND - 100, 130, 100, "#4a5864"),
      plat(540, GROUND - 64, 120, 64),
      plat(780, GROUND - 140, 150, 140, "#4a5864"),
      plat(1080, GROUND - 54, 130),
      plat(1340, GROUND - 118, 150, 118, "#4a5864"),
      plat(1620, GROUND - 78, 140, 78),
      plat(1900, GROUND - 130, 160, 130, "#4a5864"),
      plat(2200, GROUND - 70, 150, 70),
      plat(2440, GROUND - 54, 200),
    ],
    hooks: [
      hook(380, GROUND - 190),
      hook(900, GROUND - 240),
      hook(1460, GROUND - 210),
      hook(2020, GROUND - 230),
    ],
    apples: [apple(360, GROUND - 118), apple(880, GROUND - 158), apple(1980, GROUND - 148)],
    coins: [
      coin(100, GROUND - 72),
      coin(660, GROUND - 82),
      coin(1180, GROUND - 72),
      coin(1540, GROUND - 136),
      coin(1740, GROUND - 96),
      coin(2300, GROUND - 88),
    ],
    breakables: [
      breakable(820, GROUND - 176, 28, 36, "window"),
      breakable(1380, GROUND - 154, 22, 36, "crate"),
      breakable(1940, GROUND - 166, 28, 36, "window"),
      breakable(2240, GROUND - 106, 18, 36, "chimney"),
    ],
    ramps: [ramp(780, GROUND - 140, 110, 34)],
  },
];

export function getLevel(index) {
  const safeIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  const template = LEVELS[safeIndex];
  return cloneLevel(template, safeIndex);
}

export function cloneLevel(template, index = 0) {
  return {
    index,
    id: template.id,
    world: template.world,
    name: template.name,
    thiefPace: template.thiefPace,
    finishX: template.finishX,
    platforms: template.platforms.map((platform) => ({ ...platform })),
    hooks: template.hooks.map((entry) => ({ ...entry, used: false })),
    apples: template.apples.map((entry) => ({
      ...entry,
      takenBy: null,
    })),
    coins: template.coins.map((entry) => ({
      ...entry,
      taken: false,
      dropped: false,
    })),
    breakables: template.breakables.map((entry) => ({ ...entry, broken: false })),
    ramps: template.ramps.map((entry) => ({ ...entry })),
  };
}

export function levelCount() {
  return LEVELS.length;
}
