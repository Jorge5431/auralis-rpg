import {
  classes,
  classLabels,
  items,
  quests,
  level,
  maxHealth,
  type SaveData,
} from "./State";
import { edge, lake, region } from "./Terrain";
export class UI {
  root = document.querySelector<HTMLDivElement>("#ui")!;
  panel = document.createElement("dialog");
  hud = document.createElement("div");
  notify = document.createElement("div");
  map = document.createElement("canvas");
  onAction: (action: string, id?: string) => void = () => {};
  lastNotice = 0;
  constructor() {
    this.root.innerHTML = "";
    this.panel.className = "panel";
    this.notify.className = "notification";
    this.hud.className = "hud hidden";
    this.hud.innerHTML = `<div class="vitals"><span class="eyebrow">AURALIS · O REINO ACIMA DAS NUVENS</span><h3 id="player-name"></h3><div class="bar health"><i id="health"></i></div><div class="subbars"><div class="bar mana"><i id="mana"></i></div><div class="bar stamina"><i id="stamina"></i></div></div><small id="level"></small></div><div class="location"><span class="eyebrow">N &nbsp; · &nbsp; L &nbsp; · &nbsp; S &nbsp; · &nbsp; O</span><h3 id="region"></h3></div><div class="quest"><span class="eyebrow">DIÁRIO DE VIAGEM</span><h3 id="quest-name"></h3><p id="quest-text"></p></div><div id="prompt" class="prompt"></div><div class="toolbar"><button data-action="inventory">I · Mochila</button><button data-action="quests">J · Missões</button><button data-action="map">M · Mapa</button><button data-action="craft">C · Criar</button><button data-action="build">B · Construir</button><button data-action="save">Salvar</button><button data-action="settings">⚙</button></div><div class="hint">WASD mover · Arraste para olhar · Espaço saltar · Shift correr · E interagir · F atacar · Q habilidade · R esquivar</div><div class="touch"><div id="joystick"><i></i></div><div class="touch-actions"><button data-action="interact">E</button><button data-action="jump">↑</button><button data-action="attack">⚔</button><button data-action="skill">✦</button><button data-action="dodge">↝</button><button data-action="plant" aria-label="Plantar">G</button><button data-action="harvest" aria-label="Regar ou colher">H</button></div></div><div id="stats"></div>`;
    this.map.width = 180;
    this.map.height = 210;
    this.map.className = "minimap";
    this.hud.append(this.map);
    this.root.append(this.hud, this.notify, this.panel);
    this.root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!b) return;
      if (b.dataset.action === "close") this.close();
      else this.onAction(b.dataset.action!, b.dataset.id);
    });
    this.panel.addEventListener("cancel", () => this.close());
  }
  button(label: string, action: string, id = "") {
    return `<button data-action="${action}" data-id="${id}">${label}</button>`;
  }
  show(title: string, body: string) {
    this.panel.innerHTML = `<header><span class="eyebrow">AURALIS</span><button class="close" data-action="close" aria-label="Fechar">×</button><h2>${title}</h2></header>${body}`;
    if (!this.panel.open) this.panel.showModal();
  }
  close() {
    this.panel.close();
  }
  menu(hasSave: boolean) {
    this.show(
      "O reino acima das nuvens",
      `<p>Uma nova jornada começa onde o mundo encontra o céu.</p><div class="menu-actions">${this.button("Nova jornada", "new")}${hasSave ? this.button("Continuar jornada", "continue") : ""}${this.button("Configurações", "settings")}${this.button("Créditos", "credits")}</div><small>V10 · versão em desenvolvimento</small>`,
    );
  }
  creation() {
    this.show(
      "Quem chega a Auralis?",
      `<label>Seu nome<input id="character-name" maxlength="30" value="Viajante" autocomplete="off"></label><div class="classes">${classes.map((c, i) => `<label class="class-card"><input name="class" type="radio" value="${c}" ${i === 0 ? "checked" : ""}><strong>${classLabels[i]}</strong><small>${["Espada e resistência", "Arco e mobilidade", "Adagas e agilidade", "Magia à distância", "Cura e proteção", "Punhos e velocidade"][i]}</small></label>`).join("")}</div>${this.button("Entrar em Auralis", "start")}`,
    );
  }
  toast(text: string) {
    this.notify.textContent = text;
    this.notify.classList.add("visible");
    this.lastNotice = performance.now();
  }
  inventory(s: SaveData, merchant = false) {
    this.show(
      merchant ? "Mercado de Lia" : "Mochila",
      `<p>${s.gold} moedas de ouro · Nível ${level(s)}</p><div class="item-grid">${Object.entries(
        items,
      )
        .filter(([id]) => merchant || s.inventory[id])
        .map(
          ([id, it]) =>
            `<article><strong>${it.name}</strong><span>${s.inventory[id] ?? 0} na mochila</span>${merchant ? `${this.button("Comprar · " + it.price + " ouro", "buy", id)}${s.inventory[id] ? this.button("Vender · " + Math.max(1, Math.floor(it.price / 2)) + " ouro", "sell", id) : ""}` : it.kind === "consumable" ? this.button("Beber", "use", id) : it.kind === "equipment" ? this.button(s.equipped ? "Desequipar" : "Equipar", "equip", id) : ""}</article>`,
        )
        .join("")}</div>`,
    );
  }
  journal(s: SaveData) {
    this.show(
      "Diário de viagem",
      quests
        .map(
          (q, i) =>
            `<article class="quest-row"><span>${i < s.quest ? "✓" : i === s.quest ? "◆" : "○"}</span><div><h3>${q.name}</h3><p>${q.text}</p><small>${q.reward} ouro ${i === s.quest ? "· " + s.progress + "/" + q.count : ""}</small></div></article>`,
        )
        .join(""),
    );
  }
  crafting() {
    this.show(
      "Oficina",
      `<p>Prepare suprimentos com os materiais da ilha.</p><article><h3>Poção de vida</h3><p>3 ervas celestes → 1 poção</p>${this.button("Preparar", "recipe", "potion")}</article><article><h3>Lâmina de ferro</h3><p>3 minérios + 2 madeiras → 1 lâmina (+8 dano)</p>${this.button("Forjar", "recipe", "sword")}</article>`,
    );
  }
  update(
    s: SaveData,
    stamina: number,
    position: { x: number; y: number; z: number },
    prompt: string,
  ) {
    const text = (id: string, t: string) => {
      document.getElementById(id)!.textContent = t;
    };
    text("player-name", s.name);
    text("level", `Nível ${level(s)} · ${s.xp % 100}/100 XP · ${s.gold} ouro`);
    text("region", region(position.x, position.z));
    const q = quests[s.quest];
    text("quest-name", q?.name ?? "Caminhos descobertos");
    text(
      "quest-text",
      q
        ? `${q.text} (${s.progress}/${q.count})`
        : "Explore, construa e cuide da ilha.",
    );
    text("prompt", prompt);
    for (const [id, v] of [
      ["health", s.hp / maxHealth(s)],
      ["mana", s.mana / 100],
      ["stamina", stamina / 100],
    ] as const)
      document.getElementById(id)!.style.width =
        Math.max(0, Math.min(100, v * 100)) + "%";
    if (performance.now() - this.lastNotice > 4200)
      this.notify.classList.remove("visible");
    this.drawMap(position.x, position.z);
  }
  drawMap(x: number, z: number) {
    const ctx = this.map.getContext("2d")!;
    ctx.clearRect(0, 0, 180, 210);
    ctx.fillStyle = "#193e4cdd";
    ctx.fillRect(0, 0, 180, 210);
    for (let j = 0; j < 210; j += 3)
      for (let i = 0; i < 180; i += 3) {
        const wx = (i - 90) * 2.5,
          wz = (j - 105) * 2.5;
        if (edge(wx, wz) < 1) {
          ctx.fillStyle =
            lake(wx, wz) < 1 ? "#67d6d8" : wz > 110 ? "#a3ac96" : "#718956";
          ctx.fillRect(i, j, 3, 3);
        }
      }
    ctx.fillStyle = "#f1d99c";
    for (const [px, pz, label] of [
      [0, -140, "V"],
      [110, -115, "F"],
      [125, -32, "T"],
    ] as const) {
      ctx.fillText(label, 90 + px / 2.5, 105 + pz / 2.5);
    }
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(90 + x / 2.5, 105 + z / 2.5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "10px sans-serif";
    ctx.fillText("N", 86, 12);
  }
}
