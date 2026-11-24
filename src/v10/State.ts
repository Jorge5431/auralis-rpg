export const classes = [
  "Warrior",
  "Ranger",
  "Rogue",
  "Wizard",
  "Cleric",
  "Monk",
] as const;
export type ClassName = (typeof classes)[number];
export const classLabels = [
  "Guerreiro",
  "Patrulheiro",
  "Ladino",
  "Mago",
  "Clérigo",
  "Monge",
];
export const items: Record<
  string,
  { name: string; price: number; kind: string }
> = {
  herb: { name: "Erva celeste", price: 4, kind: "material" },
  wood: { name: "Madeira", price: 3, kind: "material" },
  stone: { name: "Pedra", price: 2, kind: "material" },
  ore: { name: "Minério", price: 8, kind: "material" },
  fish: { name: "Peixe do lago", price: 8, kind: "food" },
  wool: { name: "Lã macia", price: 6, kind: "material" },
  potion: { name: "Poção de vida", price: 20, kind: "consumable" },
  sword: { name: "Lâmina de ferro", price: 45, kind: "equipment" },
  seed: { name: "Semente de aurora", price: 3, kind: "seed" },
  crop: { name: "Flor de aurora", price: 12, kind: "material" },
};
export const quests = [
  {
    name: "Bem-vindo a Auralis",
    text: "Converse com Helena na praça.",
    event: "guild",
    count: 1,
    reward: 15,
  },
  {
    name: "Problemas na fazenda",
    text: "Converse com Bento e recolha 3 lãs das ovelhas.",
    event: "wool",
    count: 3,
    reward: 25,
  },
  {
    name: "Recursos da floresta",
    text: "Colete 5 ervas no bosque.",
    event: "herb",
    count: 5,
    reward: 30,
  },
  {
    name: "Perigo entre as árvores",
    text: "Derrote 3 lobos no bosque oeste.",
    event: "wolf",
    count: 3,
    reward: 45,
  },
  {
    name: "A antiga torre",
    text: "Alcance o mirante da torre.",
    event: "tower",
    count: 1,
    reward: 50,
  },
  {
    name: "A nascente de Auralis",
    text: "Visite a nascente nas montanhas ao sul.",
    event: "source",
    count: 1,
    reward: 80,
  },
];
export type SaveData = {
  version: 1;
  name: string;
  className: ClassName;
  position: number[];
  hp: number;
  mana: number;
  xp: number;
  gold: number;
  inventory: Record<string, number>;
  equipped: boolean;
  quest: number;
  progress: number;
  time: number;
  collected: Record<string, number>;
  buildings: {
    x: number;
    z: number;
    type: string;
    contents?: Record<string, number>;
  }[];
  crops: { x: number; z: number; planted: number; watered: boolean }[];
};
export function newState(
  name = "Viajante",
  className: ClassName = "Warrior",
): SaveData {
  return {
    version: 1,
    name,
    className,
    position: [0, 13, -115],
    hp: 100,
    mana: 100,
    xp: 0,
    gold: 30,
    inventory: { potion: 2, seed: 3 },
    equipped: false,
    quest: 0,
    progress: 0,
    time: 10,
    collected: {},
    buildings: [],
    crops: [],
  };
}
export function level(s: SaveData) {
  return 1 + Math.floor(s.xp / 100);
}
export function maxHealth(s: SaveData) {
  return 100 + (level(s) - 1) * 15;
}
export function damage(s: SaveData) {
  return 12 + level(s) * 3 + (s.equipped ? 8 : 0);
}
export function addItem(s: SaveData, id: string, n = 1) {
  if (!items[id] || !Number.isInteger(n) || n < 1) return false;
  s.inventory[id] = (s.inventory[id] ?? 0) + n;
  return true;
}
export function takeItem(s: SaveData, id: string, n = 1) {
  if (!Number.isInteger(n) || n < 1 || (s.inventory[id] ?? 0) < n) return false;
  s.inventory[id] -= n;
  return true;
}
export function trade(s: SaveData, id: string, buy: boolean) {
  const it = items[id];
  if (!it) return false;
  if (buy) {
    if (s.gold < it.price) return false;
    s.gold -= it.price;
    addItem(s, id);
  } else {
    if (!takeItem(s, id)) return false;
    s.gold += Math.max(1, Math.floor(it.price * 0.5));
  }
  return true;
}
export function craft(s: SaveData, id: string) {
  const recipe: Record<string, Record<string, number>> = {
    potion: { herb: 3 },
    sword: { ore: 3, wood: 2 },
  };
  const costs = recipe[id];
  if (
    !costs ||
    Object.entries(costs).some(([i, n]) => (s.inventory[i] ?? 0) < n)
  )
    return false;
  for (const [i, n] of Object.entries(costs)) takeItem(s, i, n);
  addItem(s, id);
  return true;
}
export function progressQuest(s: SaveData, event: string) {
  const q = quests[s.quest];
  if (!q || event !== q.event) return false;
  if (++s.progress >= q.count) {
    s.gold += q.reward;
    s.xp += 50;
    s.quest++;
    s.progress = 0;
    return true;
  }
  return false;
}
export function validateSave(value: unknown): value is SaveData {
  if (!value || typeof value !== "object") return false;
  const s = value as SaveData;
  return (
    s.version === 1 &&
    typeof s.name === "string" &&
    s.name.length <= 30 &&
    classes.includes(s.className) &&
    Array.isArray(s.position) &&
    s.position.length === 3 &&
    s.position.every(Number.isFinite) &&
    ["hp", "mana", "xp", "gold", "quest", "progress", "time"].every(
      (k) =>
        Number.isFinite((s as unknown as Record<string, number>)[k]) &&
        (s as unknown as Record<string, number>)[k] >= 0,
    ) &&
    Number.isInteger(s.quest) &&
    s.quest <= quests.length &&
    typeof s.equipped === "boolean" &&
    !!s.inventory &&
    Object.entries(s.inventory).every(
      ([k, v]) => !!items[k] && Number.isInteger(v) && v >= 0,
    ) &&
    !!s.collected &&
    Object.values(s.collected).every(Number.isFinite) &&
    Array.isArray(s.buildings) &&
    s.buildings.every(
      (b) =>
        Number.isFinite(b.x) &&
        Number.isFinite(b.z) &&
        ["campfire", "fence", "chest", "platform", "shelter"].includes(
          b.type,
        ) &&
        (b.contents === undefined ||
          Object.entries(b.contents).every(
            ([id, n]) => !!items[id] && Number.isInteger(n) && n >= 0,
          )),
    ) &&
    Array.isArray(s.crops) &&
    s.crops.every(
      (c) =>
        Number.isFinite(c.x) &&
        Number.isFinite(c.z) &&
        Number.isFinite(c.planted) &&
        typeof c.watered === "boolean",
    )
  );
}
export class Saves {
  private async db() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("auralis-v10", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("slots");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async save(s: SaveData, slot = "journey") {
    if (!validateSave(s)) throw new Error("Salvamento inválido");
    const db = await this.db();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("slots", "readwrite");
      tx.objectStore("slots").put(structuredClone(s), slot);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }
  async load(slot = "journey") {
    const db = await this.db();
    return new Promise<SaveData | null>((resolve, reject) => {
      const tx = db.transaction("slots", "readonly"),
        req = tx.objectStore("slots").get(slot);
      req.onsuccess = () => {
        db.close();
        if (req.result === undefined) resolve(null);
        else if (validateSave(req.result)) resolve(req.result);
        else
          reject(
            new Error(
              "Salvamento incompatível ou corrompido; o original foi preservado.",
            ),
          );
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  }
}
