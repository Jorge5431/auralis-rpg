import * as T from "three";
import { Assets } from "./Assets";
import { World } from "./World";
import { Physics } from "./Physics";
import { Actor } from "./Actor";
import { Input } from "./Input";
import { Navigation } from "./Navigation";
import { UI } from "./UI";
import { height, edge, lake, random, pathDistance } from "./Terrain";
import {
  Saves,
  newState,
  classes,
  classLabels,
  quests,
  items,
  addItem,
  takeItem,
  trade,
  craft,
  damage,
  level,
  maxHealth,
  progressQuest,
  type SaveData,
  type ClassName,
} from "./State";
type Entity = {
  id: string;
  kind: string;
  actor?: Actor;
  object: T.Object3D;
  origin: T.Vector3;
  hp: number;
  timer: number;
  cooldown: number;
};
type Resource = { id: string; item: string; object: T.Mesh; ready: number };
export class Game {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1600);
  renderer: T.WebGLRenderer;
  assets = new Assets();
  ui = new UI();
  saves = new Saves();
  state = newState();
  world!: World;
  navigation!: Navigation;
  route: { x: number; z: number }[] = [];
  physics!: Physics;
  player?: Actor;
  input: Input;
  entities: Entity[] = [];
  resources: Resource[] = [];
  running = false;
  overview = true;
  stamina = 100;
  cooldown = 0;
  attackTime = 0;
  pendingHit = 0;
  dodgeTime = 0;
  accumulator = 0;
  last = performance.now();
  saveTimer = 0;
  hudTimer = 0;
  frames = 0;
  frameTime = 0;
  fps = 0;
  mobile = matchMedia("(pointer:coarse)").matches;
  fishing = 0;
  fishReady = 0;
  projectiles: {
    mesh: T.Mesh;
    velocity: T.Vector3;
    life: number;
    damage: number;
  }[] = [];
  preview?: T.Mesh;
  buildType = "campfire";
  debug = false;
  audio?: AudioContext;
  volume = Number(localStorage.getItem("auralis-volume") ?? 0.25);
  raycaster = new T.Raycaster();
  cropMeshes: T.Mesh[] = [];
  constructor() {
    this.renderer = new T.WebGLRenderer({
      antialias: !this.mobile,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.mobile ? 1 : 1.5),
    );
    this.renderer.setSize(
      document.documentElement.clientWidth,
      document.documentElement.clientHeight,
      false,
    );
    this.renderer.shadowMap.enabled =
      localStorage.getItem("auralis-quality") !== "low";
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    document.body.prepend(this.renderer.domElement);
    this.input = new Input(this.renderer.domElement, (x, y) =>
      this.click(x, y),
    );
    this.ui.onAction = (a, id) => void this.action(a, id);
    addEventListener("resize", () => {
      this.camera.aspect =
        document.documentElement.clientWidth /
        document.documentElement.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(
        document.documentElement.clientWidth,
        document.documentElement.clientHeight,
        false,
      );
    });
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.running = false;
      this.ui.show(
        "O contexto gráfico foi interrompido",
        `<p>O navegador perdeu o contexto gráfico. Recarregue para recuperar o último salvamento.</p><button onclick="location.reload()">Recarregar</button>`,
      );
    });
    this.setupTouch();
  }
  async init() {
    const loading = document.querySelector<HTMLElement>("#loading")!;
    try {
      loading.textContent = "Conectando caminhos, florestas e nuvens…";
      await this.assets.init(this.mobile);
      this.world = new World(this.scene, this.assets, this.mobile);
      await this.world.build();
      this.physics = await Physics.init(this.world);
      this.navigation = new Navigation(this.world.obstacles);
      this.gathering();
      this.camera.position.set(290, 240, -330);
      this.camera.lookAt(0, 5, 10);
      loading.remove();
      let hasSave = false;
      try {
        hasSave = !!(await this.saves.load());
      } catch (e) {
        this.ui.toast(String(e));
      }
      this.ui.menu(hasSave);
      requestAnimationFrame(this.frame);
      Object.assign(window, { auralis: this });
    } catch (e) {
      loading.textContent = "Não foi possível preparar Auralis: " + String(e);
      console.error(e);
    }
  }
  setupTouch() {
    const stick = document.querySelector<HTMLElement>("#joystick")!;
    stick.addEventListener("pointerdown", (e) => {
      stick.setPointerCapture(e.pointerId);
      move(e);
    });
    const move = (e: PointerEvent) => {
      if (e.type !== "pointerdown" && !stick.hasPointerCapture(e.pointerId))
        return;
      const r = stick.getBoundingClientRect();
      this.input.axis
        .set(
          (e.clientX - r.left - r.width / 2) / 42,
          (e.clientY - r.top - r.height / 2) / 42,
        )
        .clampLength(0, 1);
      stick.querySelector<HTMLElement>("i")!.style.transform =
        `translate(${this.input.axis.x * 30}px,${this.input.axis.y * 30}px)`;
    };
    stick.addEventListener("pointermove", move);
    for (const type of ["pointerup", "pointercancel"])
      stick.addEventListener(type, () => {
        this.input.axis.set(0, 0);
        stick.querySelector<HTMLElement>("i")!.style.transform = "";
      });
  }
  async start(state: SaveData) {
    this.running = false;
    this.ui.show(
      "Preparando sua jornada",
      "<p>Carregando personagem e habitantes…</p>",
    );
    try {
      this.state = state;
      this.player?.group.removeFromParent();
      this.entities.forEach((e) => e.object.removeFromParent());
      this.entities = [];
      const path =
        "models/characters/quaternius-rpg-classes/glTF/" +
        state.className +
        ".gltf";
      this.player = await Actor.load(this.assets, path);
      this.player.group.rotation.y = Math.PI;
      this.scene.add(this.player.group);
      this.physics.teleport(
        state.position[0],
        Math.max(
          height(state.position[0], state.position[2]) + 0.15,
          state.position[1],
        ),
        state.position[2],
      );
      this.world.time = state.time;
      await this.populate();
      this.overview = false;
      this.running = true;
      this.stamina = 100;
      this.ui.close();
      this.ui.hud.classList.remove("hidden");
      this.ui.toast("Bem-vindo, " + state.name + ". Helena espera na praça.");
      this.camera.position
        .copy(this.physics.position)
        .add(new T.Vector3(0, 3, 7));
      this.input.keys.clear();
      this.input.pressed.clear();
      for (const r of this.resources) r.ready = state.collected[r.id] ?? 0;
      for (const b of state.buildings) this.structure(b.x, b.z, b.type);
      this.updateCrops();
    } catch (e) {
      console.error(e);
      this.ui.show(
        "Falha ao carregar",
        "<p>Não foi possível carregar os recursos essenciais. Recarregue a página para tentar novamente.</p>",
      );
    }
  }
  async populate() {
    for (const [id, kind, x, z, model] of [
      ["Helena", "guild", -4, -131, "Cleric"],
      ["Lia", "merchant", 13, -134, "Ranger"],
      ["Bento", "farmer", 91, -111, "Monk"],
    ] as const) {
      const actor = await Actor.load(
        this.assets,
        `models/characters/quaternius-rpg-classes/glTF/${model}.gltf`,
      );
      actor.group.position.set(x, height(x, z), z);
      this.scene.add(actor.group);
      this.entities.push({
        id,
        kind,
        actor,
        object: actor.group,
        origin: actor.group.position.clone(),
        hp: 100,
        timer: 0,
        cooldown: 0,
      });
    }
    const rand = random(23);
    for (const kind of ["sheep", "wolf"])
      for (let i = 0; i < (kind === "sheep" ? 6 : 4); i++) {
        const x = kind === "sheep" ? 97 + rand() * 22 : -100 - rand() * 24,
          z = kind === "sheep" ? -126 + rand() * 26 : -48 + rand() * 80;
        const name = kind === "sheep" ? "Sheep" : "Wolf";
        const actor = await Actor.load(
          this.assets,
          `models/creatures-complete/beasts/${name}/${name}.glb`,
          kind === "sheep" ? 0.95 : 1.05,
        );
        actor.group.position.set(x, height(x, z), z);
        this.scene.add(actor.group);
        this.entities.push({
          id: kind + i,
          kind,
          actor,
          object: actor.group,
          origin: actor.group.position.clone(),
          hp: 45,
          timer: rand() * 20,
          cooldown: 0,
        });
      }
  }
  gathering() {
    const rand = random(82);
    for (let i = 0; i < 95; i++) {
      let x = (rand() - 0.5) * 270,
        z = (rand() - 0.5) * 310;
      if (i < 8) {
        x = -60 - i * 3;
        z = -78 + i * 6;
      }
      if (edge(x, z) > 0.87 || lake(x, z) < 1.2) continue;
      const item =
        i % 5 === 0
          ? "ore"
          : i % 3 === 0
            ? "wood"
            : i % 4 === 0
              ? "stone"
              : "herb";
      const mesh = new T.Mesh(
        item === "herb"
          ? new T.OctahedronGeometry(0.35)
          : new T.DodecahedronGeometry(0.6),
        new T.MeshStandardMaterial({
          color:
            item === "herb"
              ? "#8bc8c2"
              : item === "wood"
                ? "#986b42"
                : item === "ore"
                  ? "#88a9bb"
                  : "#aaa994",
          emissive: item === "herb" ? "#164941" : "#000000",
          roughness: 0.7,
        }),
      );
      mesh.position.set(x, height(x, z) + 0.5, z);
      this.scene.add(mesh);
      this.resources.push({ id: "resource" + i, item, object: mesh, ready: 0 });
    }
  }
  async action(action: string, id?: string) {
    if (action === "new") {
      this.ui.creation();
      return;
    }
    if (action === "start") {
      const name =
        document
          .querySelector<HTMLInputElement>("#character-name")
          ?.value.trim()
          .slice(0, 30) || "Viajante";
      const cls = document.querySelector<HTMLInputElement>(
        "input[name=class]:checked",
      )?.value as ClassName;
      await this.start(newState(name, classes.includes(cls) ? cls : "Warrior"));
      return;
    }
    if (action === "continue") {
      try {
        const s = await this.saves.load();
        if (s) await this.start(s);
        else this.ui.toast("Nenhum salvamento encontrado");
      } catch (e) {
        this.ui.toast(String(e));
      }
      return;
    }
    if (action === "credits") {
      this.ui.show(
        "Créditos",
        `<p>Personagens: Quaternius · Natureza e mercado: Kenney · Criaturas: Daniel Gruginski · Materiais: Poly Haven.</p><p>Recursos CC0. Documentação e licenças originais preservadas em assets/CREDITS.md e public/assets.</p><p>Geografia, interface e sistemas desta versão: implementação procedural original.</p>`,
      );
      return;
    }
    if (action === "settings") {
      this.ui.show(
        "Configurações",
        `<p>Qualidade: ${this.mobile ? "mobile" : "desktop"}</p>${this.ui.button("Economia · sombras desligadas", "quality", "low")}${this.ui.button("Detalhado · sombras ligadas", "quality", "high")}<p>Som dos efeitos</p>${this.ui.button(this.volume ? "Silenciar" : "Ativar", "sound")}<p>${this.ui.button("Diagnóstico de desempenho", "debug")}</p><p>Arraste para girar a câmera. Use a roda ou dois dedos para aproximar. V alterna vista aérea.</p>`,
      );
      return;
    }
    if (action === "quality") {
      const high = id === "high";
      this.renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.5) : 1);
      this.renderer.shadowMap.enabled = high;
      localStorage.setItem("auralis-quality", high ? "high" : "low");
      this.ui.toast("Perfil aplicado");
      return;
    }
    if (action === "sound") {
      this.volume = this.volume ? 0 : 0.25;
      localStorage.setItem("auralis-volume", String(this.volume));
      await this.action("settings");
      return;
    }
    if (action === "debug") {
      this.debug = !this.debug;
      this.ui.close();
      return;
    }
    if (!this.running) return;
    switch (action) {
      case "inventory":
        this.ui.inventory(this.state);
        break;
      case "deposit":
      case "withdraw": {
        const chest = this.nearChest();
        if (!chest || !id || !items[id]) break;
        chest.contents ??= {};
        if (action === "deposit" && takeItem(this.state, id))
          chest.contents[id] = (chest.contents[id] ?? 0) + 1;
        else if (action === "withdraw" && (chest.contents[id] ?? 0) > 0) {
          chest.contents[id]--;
          addItem(this.state, id);
        }
        this.chestMenu();
        break;
      }
      case "quests":
        this.ui.journal(this.state);
        break;
      case "craft":
        this.ui.crafting();
        break;
      case "recipe":
        this.ui.toast(
          craft(this.state, id!) ? "Item criado." : "Materiais insuficientes.",
        );
        break;
      case "map":
        this.overview = !this.overview;
        this.ui.close();
        break;
      case "attack":
        this.attack(false);
        break;
      case "skill":
        this.attack(true);
        break;
      case "jump":
        this.input.pressed.add("Space");
        break;
      case "dodge":
        this.dodge();
        break;
      case "interact":
        this.interact();
        break;
      case "plant":
        this.plant();
        break;
      case "harvest":
        this.harvest();
        break;
      case "save":
        await this.save();
        break;
      case "buy":
      case "sell":
        if (!this.near("merchant", 5)) {
          this.ui.close();
          break;
        }
        this.ui.toast(
          trade(this.state, id!, action === "buy")
            ? "Negócio fechado."
            : "Saldo ou quantidade insuficiente.",
        );
        this.ui.inventory(this.state, true);
        break;
      case "use":
        if (
          this.state.hp < maxHealth(this.state) &&
          takeItem(this.state, "potion")
        ) {
          this.state.hp = Math.min(maxHealth(this.state), this.state.hp + 50);
          this.ui.toast("Você recuperou 50 de vida.");
        }
        this.ui.inventory(this.state);
        break;
      case "equip":
        if (this.state.inventory.sword) {
          this.state.equipped = !this.state.equipped;
          this.ui.inventory(this.state);
        }
        break;
      case "build":
        this.ui.show(
          "Construir",
          `<p>Escolha uma estrutura. Posicione-a no bosque, longe de água, ruas e edifícios. E confirma, Esc cancela. Custo: 5 madeiras + 2 pedras.</p>${[
            ["campfire", "Fogueira"],
            ["fence", "Cerca"],
            ["chest", "Baú"],
            ["platform", "Plataforma"],
            ["shelter", "Abrigo"],
          ]
            .map(([t, n]) => this.ui.button(n, "preview", t))
            .join("")}`,
        );
        break;
      case "preview":
        this.buildType = id!;
        this.preview?.removeFromParent();
        this.preview = new T.Mesh(
          new T.BoxGeometry(3, 1.8, 3),
          new T.MeshBasicMaterial({ color: "#71ce96", wireframe: true }),
        );
        this.scene.add(this.preview);
        this.ui.close();
        break;
      case "guild":
        if (!this.near("guild", 5)) break;
        this.questEvent("guild");
        this.ui.close();
        break;
      case "farmer":
        this.ui.close();
        this.ui.toast(
          "Bento: recolha lã das ovelhas com E. Plante sementes aqui com G; H rega e colhe.",
        );
        break;
    }
  }
  near(kind: string, d: number) {
    return this.entities.find(
      (e) =>
        e.kind === kind &&
        e.object.position.distanceTo(this.physics.position) < d,
    );
  }
  nearest() {
    const p = this.physics.position;
    let best: Entity | Resource | undefined;
    let d = 3.4;
    for (const e of [...this.entities, ...this.resources]) {
      if (("ready" in e && e.ready > Date.now()) || ("hp" in e && e.hp <= 0))
        continue;
      const dist = e.object.position.distanceTo(p);
      if (dist < d) {
        d = dist;
        best = e;
      }
    }
    return best;
  }
  interact() {
    if (this.ui.panel.open) return;
    if (this.nearChest()) {
      this.chestMenu();
      return;
    }
    if (this.preview) {
      this.confirmBuild();
      return;
    }
    if (this.fishing) {
      if (
        performance.now() > this.fishReady &&
        performance.now() < this.fishReady + 2200
      ) {
        addItem(this.state, "fish");
        this.state.xp += 8;
        this.ui.toast("Você pescou um peixe do lago!");
        this.tone(660);
      } else this.ui.toast("O peixe escapou. Espere o aviso de fisgada.");
      this.fishing = 0;
      return;
    }
    const nearest = this.nearest();
    if (nearest) {
      if ("ready" in nearest) {
        addItem(this.state, nearest.item);
        nearest.ready = Date.now() + 60000;
        this.state.collected[nearest.id] = nearest.ready;
        this.questEvent(nearest.item);
        this.player?.play("PickUp", true);
        this.attackTime = 0.7;
        this.ui.toast("+1 " + items[nearest.item].name);
        this.tone(520);
        return;
      }
      if (nearest.kind === "wolf") {
        this.attack(false);
        return;
      }
      if (nearest.kind === "sheep") {
        const ready = this.state.collected[nearest.id] ?? 0;
        if (Date.now() < ready) {
          this.ui.toast("A lã ainda está crescendo.");
          return;
        }
        addItem(this.state, "wool");
        this.state.collected[nearest.id] = Date.now() + 90000;
        this.questEvent("wool");
        this.ui.toast("+1 lã macia");
        return;
      }
      if (nearest.kind === "merchant") {
        this.ui.inventory(this.state, true);
        return;
      }
      this.ui.show(
        nearest.id,
        `<p>${nearest.kind === "guild" ? "Bem-vindo a Auralis. Siga o caminho a leste até a fazenda. Bento precisa de ajuda com as ovelhas." : "As ovelhas estão no cercado. A lã pode ser recolhida com cuidado. Também temos terra para suas sementes."}</p>${this.ui.button("Vamos lá", nearest.kind)}`,
      );
      return;
    }
    const p = this.physics.position;
    if (lake(p.x, p.z) > 1 && lake(p.x, p.z) < 1.35) {
      this.fishing = performance.now();
      this.fishReady = this.fishing + 2500 + Math.random() * 3000;
      this.ui.toast("Linha lançada. Espere a fisgada e pressione E.");
      return;
    }
    this.ui.toast("Aproxime-se de uma pessoa, recurso ou margem do lago.");
  }
  questEvent(event: string) {
    if (progressQuest(this.state, event)) {
      this.ui.toast("Missão concluída! Ouro e experiência recebidos.");
      this.tone(880);
    }
  }
  attack(skill: boolean) {
    if (this.cooldown > 0 || this.ui.panel.open || !this.player) return;
    if (skill && this.state.mana < 20) {
      this.ui.toast("Mana insuficiente");
      return;
    }
    if (!skill && this.stamina < 10) return;
    if (skill) this.state.mana -= 20;
    else this.stamina -= 10;
    this.cooldown = skill ? 1.2 : 0.65;
    this.attackTime = 0.65;
    const cls = this.state.className;
    const clip: Record<ClassName, string> = {
      Warrior: "Sword_Attack",
      Ranger: "Bow_Shoot",
      Rogue: "Dagger_Attack",
      Wizard: "Spell1",
      Cleric: "Staff_Attack",
      Monk: "Attack",
    };
    this.player.play(clip[cls], true);
    this.tone(cls === "Wizard" ? 440 : 180);
    if (skill && cls === "Cleric") {
      this.state.hp = Math.min(maxHealth(this.state), this.state.hp + 35);
      this.ui.toast("Luz restauradora: +35 vida");
      return;
    }
    if (["Ranger", "Wizard", "Cleric"].includes(cls)) {
      const enemies = this.entities
        .filter(
          (e) =>
            e.kind === "wolf" &&
            e.hp > 0 &&
            e.object.position.distanceTo(this.physics.position) < 35,
        )
        .sort(
          (a, b) =>
            a.object.position.distanceTo(this.physics.position) -
            b.object.position.distanceTo(this.physics.position),
        );
      const mesh = new T.Mesh(
        new T.SphereGeometry(0.16, 8, 6),
        new T.MeshBasicMaterial({
          color: cls === "Ranger" ? "#dec19b" : "#a8f6ff",
        }),
      );
      mesh.position.copy(this.physics.position).add(new T.Vector3(0, 1.1, 0));
      const dir = enemies[0]
        ? enemies[0].object.position
            .clone()
            .add(new T.Vector3(0, 0.6, 0))
            .sub(mesh.position)
            .normalize()
        : new T.Vector3(
            Math.sin(this.player.group.rotation.y),
            0,
            Math.cos(this.player.group.rotation.y),
          );
      this.scene.add(mesh);
      this.projectiles.push({
        mesh,
        velocity: dir.multiplyScalar(26),
        life: 2,
        damage: damage(this.state) * (skill ? 1.8 : 1),
      });
    } else this.pendingHit = skill ? 2 : 1;
  }
  hit(e: Entity, amount: number) {
    if (e.hp <= 0) return;
    e.hp -= amount;
    e.actor?.play(e.hp <= 0 ? "Death" : "Hit", true);
    if (e.hp <= 0) {
      this.state.xp += 35;
      this.state.gold += 8;
      addItem(this.state, "ore");
      this.questEvent("wolf");
      e.cooldown = 35;
      this.ui.toast("Lobo derrotado · +35 XP · +8 ouro · +1 minério");
    } else e.cooldown = 0.3;
  }
  dodge() {
    if (this.stamina < 22 || this.dodgeTime > 0) return;
    this.stamina -= 22;
    this.dodgeTime = 0.4;
    this.player?.play("Roll", true);
    this.attackTime = 0.4;
  }
  tone(freq: number) {
    if (!this.volume) return;
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      const o = this.audio.createOscillator(),
        gain = this.audio.createGain();
      o.frequency.setValueAtTime(freq, this.audio.currentTime);
      o.frequency.exponentialRampToValueAtTime(
        freq * 0.5,
        this.audio.currentTime + 0.15,
      );
      gain.gain.setValueAtTime(this.volume * 0.15, this.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.audio.currentTime + 0.2,
      );
      o.connect(gain).connect(this.audio.destination);
      o.start();
      o.stop(this.audio.currentTime + 0.2);
    } catch {
      /* Audio does not block gameplay. */
    }
  }
  validBuild(x: number, z: number) {
    return (
      edge(x, z) < 0.85 &&
      lake(x, z) > 1.3 &&
      pathDistance(x, z) > 6 &&
      z > -80 &&
      height(x, z) < 35 &&
      Math.abs(height(x + 2, z) - height(x - 2, z)) < 1.5 &&
      !this.world.obstacles.some(
        (o) =>
          Math.abs(o.x - x) < o.w / 2 + 3 && Math.abs(o.z - z) < o.d / 2 + 3,
      ) &&
      !this.state.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < 5)
    );
  }
  nearChest() {
    return this.state.buildings.find(
      (b) =>
        b.type === "chest" &&
        Math.hypot(
          b.x - this.physics.position.x,
          b.z - this.physics.position.z,
        ) < 3.5,
    );
  }
  chestMenu() {
    const chest = this.nearChest();
    if (!chest) return;
    chest.contents ??= {};
    this.ui.show(
      "Baú de provisões",
      `<p>Os itens guardados acompanham o salvamento da jornada.</p><div class="item-grid">${Object.entries(
        items,
      )
        .filter(([id]) => this.state.inventory[id] || chest.contents![id])
        .map(
          ([id, it]) =>
            `<article><strong>${it.name}</strong><span>Mochila: ${this.state.inventory[id] ?? 0} · Baú: ${chest.contents![id] ?? 0}</span>${this.state.inventory[id] ? this.ui.button("Guardar 1", "deposit", id) : ""}${chest.contents![id] ? this.ui.button("Retirar 1", "withdraw", id) : ""}</article>`,
        )
        .join("")}</div>`,
    );
  }
  confirmBuild() {
    if (!this.preview) return;
    const { x, z } = this.preview.position;
    if (!this.validBuild(x, z)) {
      this.ui.toast("Escolha um terreno livre e plano no bosque.");
      return;
    }
    if (
      (this.state.inventory.wood ?? 0) < 5 ||
      (this.state.inventory.stone ?? 0) < 2
    ) {
      this.ui.toast("Precisa de 5 madeiras e 2 pedras.");
      return;
    }
    takeItem(this.state, "wood", 5);
    takeItem(this.state, "stone", 2);
    this.state.buildings.push({ x, z, type: this.buildType });
    this.structure(x, z, this.buildType);
    this.preview.removeFromParent();
    this.preview = undefined;
    this.ui.toast("Estrutura construída e registrada na jornada.");
  }
  structure(x: number, z: number, type: string) {
    const y = height(x, z),
      group = new T.Group(),
      mat = new T.MeshStandardMaterial({ color: "#967250", roughness: 1 });
    const box = (
      w: number,
      h: number,
      d: number,
      px: number,
      py: number,
      pz: number,
    ) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      group.add(m);
    };
    if (type === "fence") {
      for (const dx of [-1.4, 1.4]) box(0.18, 1.7, 0.18, dx, 0.85, 0);
      for (const dy of [0.5, 1.2]) box(3, 0.15, 0.15, 0, dy, 0);
    } else if (type === "campfire") {
      for (let i = 0; i < 8; i++) {
        const m = new T.Mesh(
          new T.DodecahedronGeometry(0.28),
          new T.MeshStandardMaterial({ color: "#9c9a88" }),
        );
        m.position.set(Math.sin(i) * 0.7, 0.2, Math.cos(i) * 0.7);
        group.add(m);
      }
      const flame = new T.PointLight("#ffa548", 5, 9);
      flame.position.y = 0.5;
      group.add(flame);
      box(1.2, 0.2, 0.2, 0, 0.2, 0);
    } else if (type === "shelter") {
      for (const dx of [-1.3, 1.3])
        for (const dz of [-1.3, 1.3]) box(0.18, 2.5, 0.18, dx, 1.25, dz);
      box(3, 0.2, 3, 0, 2.5, 0);
    } else
      box(
        3,
        type === "platform" ? 0.3 : 1.2,
        2,
        0,
        type === "platform" ? 0.15 : 0.6,
        0,
      );
    group.position.set(x, y, z);
    this.scene.add(group);
    if (!["shelter", "campfire"].includes(type))
      this.physics.obstacle({
        x,
        z,
        y,
        w: 3,
        d: type === "fence" ? 0.2 : 2,
        h: type === "platform" ? 0.3 : 1.2,
      });
  }
  plant() {
    const p = this.physics.position;
    if (Math.hypot(p.x - 110, p.z + 110) > 20) {
      this.ui.toast("Plante dentro da fazenda.");
      return;
    }
    if (this.state.crops.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 2)) {
      this.ui.toast("Já existe uma plantação aqui.");
      return;
    }
    if (takeItem(this.state, "seed")) {
      this.state.crops.push({
        x: p.x,
        z: p.z,
        planted: Date.now(),
        watered: false,
      });
      this.updateCrops();
      this.ui.toast("Semente plantada. H para regar.");
    } else this.ui.toast("Você precisa de sementes.");
  }
  harvest() {
    const p = this.physics.position,
      c = this.state.crops.find((c) => Math.hypot(c.x - p.x, c.z - p.z) < 3);
    if (!c) {
      this.ui.toast("Nenhuma plantação por perto.");
      return;
    }
    if (!c.watered) {
      c.watered = true;
      c.planted = Date.now();
      this.ui.toast("Plantação regada. Cresce em 60 segundos.");
    } else if (Date.now() - c.planted >= 60000) {
      addItem(this.state, "crop", 2);
      addItem(this.state, "seed");
      this.state.crops.splice(this.state.crops.indexOf(c), 1);
      this.ui.toast("Colheita: 2 flores e 1 semente.");
    } else this.ui.toast("A plantação ainda está crescendo.");
    this.updateCrops();
  }
  updateCrops() {
    this.cropMeshes.forEach((m) => {
      m.removeFromParent();
      m.geometry.dispose();
      (m.material as T.Material).dispose();
    });
    this.cropMeshes = [];
    for (const c of this.state.crops) {
      const grown = c.watered && Date.now() - c.planted > 60000;
      const m = new T.Mesh(
        new T.ConeGeometry(grown ? 0.5 : 0.2, grown ? 1.2 : 0.3, 7),
        new T.MeshStandardMaterial({ color: grown ? "#dba7c5" : "#76ac49" }),
      );
      m.position.set(c.x, height(c.x, c.z) + (grown ? 0.6 : 0.15), c.z);
      this.scene.add(m);
      this.cropMeshes.push(m);
    }
  }
  async save(silent = false) {
    if (!this.running) return;
    this.state.position = this.physics.position.toArray();
    this.state.time = this.world.time;
    try {
      await this.saves.save(this.state);
      if (!silent) this.ui.toast("Jornada salva neste navegador.");
    } catch (e) {
      this.ui.toast("Não foi possível salvar: " + String(e));
    }
  }
  click(x: number, y: number) {
    if (!this.running || this.ui.panel.open || this.overview) return;
    this.raycaster.setFromCamera(
      new T.Vector2((x / innerWidth) * 2 - 1, 1 - (y / innerHeight) * 2),
      this.camera,
    );
    const hits = this.raycaster.intersectObject(this.world.terrain.mesh);
    if (hits[0]) {
      const p = hits[0].point;
      if (lake(p.x, p.z) > 1.05) {
        this.route = this.navigation.path(this.physics.position, p);
        const next = this.route.shift();
        this.input.target = next
          ? new T.Vector3(next.x, height(next.x, next.z), next.z)
          : null;
        if (!next) this.ui.toast("Não há caminho livre até esse ponto.");
      } else this.ui.toast("Escolha uma margem ou caminho.");
    }
  }
  step() {
    const dt = 1 / 60,
      p = this.physics.position;
    let move = this.input.movement();
    if (move.lengthSq() > 0) {
      this.input.target = null;
      this.route = [];
    }
    let dx = 0,
      dz = 0;
    if (this.input.target) {
      const d = this.input.target.clone().sub(p);
      if (Math.hypot(d.x, d.z) < 0.7) {
        const next = this.route.shift();
        this.input.target = next
          ? new T.Vector3(next.x, height(next.x, next.z), next.z)
          : null;
      } else {
        d.y = 0;
        d.normalize();
        dx = d.x;
        dz = d.z;
      }
    } else {
      dx =
        Math.cos(this.input.yaw) * move.x - Math.sin(this.input.yaw) * move.y;
      dz =
        -Math.sin(this.input.yaw) * move.x - Math.cos(this.input.yaw) * move.y;
    }
    const sprint = this.input.keys.has("ShiftLeft") && this.stamina > 0;
    const speed = this.dodgeTime > 0 ? 14 : sprint ? 8 : 4.4;
    if (this.dodgeTime > 0 && dx === 0 && dz === 0) {
      dx = Math.sin(this.player!.group.rotation.y);
      dz = Math.cos(this.player!.group.rotation.y);
    }
    const moving = Math.hypot(dx, dz) > 0.1;
    this.stamina = T.MathUtils.clamp(
      this.stamina + (sprint && moving ? -16 : 12) * dt,
      0,
      100,
    );
    const nx = p.x + dx * speed * dt,
      nz = p.z + dz * speed * dt;
    if (lake(nx, nz) < 1.03) {
      dx = 0;
      dz = 0;
      this.input.target = null;
    }
    this.physics.step(
      dx * speed * dt,
      dz * speed * dt,
      this.input.consume("Space"),
    );
    if (p.y < -35 || edge(p.x, p.z) > 1.08) {
      this.physics.teleport(0, 11, -115);
      this.ui.toast("Os ventos trouxeram você de volta à vila.");
    }
    this.player!.group.position.copy(p);
    if (moving) {
      const target = Math.atan2(dx, dz);
      this.player!.group.rotation.y +=
        Math.atan2(
          Math.sin(target - this.player!.group.rotation.y),
          Math.cos(target - this.player!.group.rotation.y),
        ) * 0.2;
    }
    if (this.attackTime <= 0)
      this.player!.play(moving ? (sprint ? "Run" : "Walk") : "Idle");
    this.player!.update(dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.attackTime -= dt;
    this.dodgeTime = Math.max(0, this.dodgeTime - dt);
    if (this.pendingHit && this.attackTime < 0.35) {
      for (const e of this.entities)
        if (
          e.kind === "wolf" &&
          e.hp > 0 &&
          e.object.position.distanceTo(p) < 3.6
        )
          this.hit(e, damage(this.state) * this.pendingHit);
      this.pendingHit = 0;
    }
    this.state.mana = Math.min(100, this.state.mana + dt * 2);
    for (const e of this.entities) {
      e.timer += dt;
      e.cooldown -= dt;
      const dist = e.object.position.distanceTo(p);
      if (e.hp <= 0) {
        if (e.cooldown < 0) {
          e.hp = 45;
          e.object.position.copy(e.origin);
          e.actor?.play("Idle");
        }
        e.actor?.update(dt);
        continue;
      }
      if (e.kind === "wolf" || e.kind === "sheep") {
        let target: T.Vector3 | undefined;
        const chase =
          e.kind === "wolf" &&
          dist < 18 &&
          e.object.position.distanceTo(e.origin) < 30;
        if (chase) {
          target = p;
          if (dist < 2 && e.cooldown <= 0) {
            e.cooldown = 1.5;
            e.actor?.play("Bite", true);
            if (this.dodgeTime <= 0) {
              this.state.hp -= 8;
              this.tone(90);
            }
          }
        } else if (Math.sin(e.timer * 0.4) > 0.1)
          target = e.origin
            .clone()
            .add(
              new T.Vector3(
                Math.sin(e.timer * 0.14) * 5,
                0,
                Math.cos(e.timer * 0.14) * 5,
              ),
            );
        const canMove = target && !(chase && dist < 1.8);
        if (canMove) {
          const d = target!.clone().sub(e.object.position);
          d.y = 0;
          d.normalize();
          const nx = e.object.position.x + d.x * dt * (chase ? 4 : 1),
            nz = e.object.position.z + d.z * dt * (chase ? 4 : 1);
          if (
            lake(nx, nz) > 1.1 &&
            !this.world.obstacles.some(
              (o) =>
                Math.abs(nx - o.x) < o.w / 2 + 0.4 &&
                Math.abs(nz - o.z) < o.d / 2 + 0.4,
            )
          ) {
            e.object.position.set(nx, height(nx, nz), nz);
            e.object.rotation.y = Math.atan2(d.x, d.z);
          }
          if (e.cooldown < 1) e.actor?.play(chase ? "Run" : "Walk");
        } else if (e.cooldown < 1)
          e.actor?.play(e.kind === "sheep" ? "Graze" : "Idle");
      }
      e.actor?.update(dt);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      const before = pr.mesh.position.clone();
      pr.mesh.position.addScaledVector(pr.velocity, dt);
      pr.life -= dt;
      const segment = new T.Line3(before, pr.mesh.position);
      for (const e of this.entities)
        if (
          e.kind === "wolf" &&
          e.hp > 0 &&
          segment
            .closestPointToPoint(
              e.object.position.clone().add(new T.Vector3(0, 0.6, 0)),
              true,
              new T.Vector3(),
            )
            .distanceTo(
              e.object.position.clone().add(new T.Vector3(0, 0.6, 0)),
            ) < 0.8
        ) {
          this.hit(e, pr.damage);
          pr.life = 0;
          break;
        }
      if (pr.life <= 0) {
        pr.mesh.removeFromParent();
        pr.mesh.geometry.dispose();
        (pr.mesh.material as T.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
    if (
      this.state.hp > 0 &&
      this.state.buildings.some(
        (b) => b.type === "campfire" && Math.hypot(b.x - p.x, b.z - p.z) < 4,
      ) &&
      !this.entities.some(
        (e) =>
          e.kind === "wolf" && e.hp > 0 && e.object.position.distanceTo(p) < 15,
      )
    )
      this.state.hp = Math.min(maxHealth(this.state), this.state.hp + dt * 3);
    if (this.state.hp <= 0) {
      this.state.hp = maxHealth(this.state);
      this.state.gold = Math.max(0, this.state.gold - 10);
      const shelter = [...this.state.buildings]
        .reverse()
        .find((b) => b.type === "shelter");
      if (shelter)
        this.physics.teleport(
          shelter.x,
          height(shelter.x, shelter.z) + 0.2,
          shelter.z,
        );
      else this.physics.teleport(0, 11, -115);
      this.ui.toast("Você despertou na vila. Recuperação custou até 10 ouro.");
    }
    if (
      p.x > 116 &&
      p.x < 134 &&
      p.z > -42 &&
      p.z < -23 &&
      p.y > height(125, -32) + 17
    )
      this.questEvent("tower");
    if (Math.hypot(p.x - 8, p.z - 149) < 14) this.questEvent("source");
    this.world.update(dt, p);
  }
  frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.frames++;
    this.frameTime += dt;
    if (this.frameTime > 1) {
      this.fps = this.frames / this.frameTime;
      this.frames = 0;
      this.frameTime = 0;
    }
    if (this.running) {
      if (this.ui.panel.open) this.input.pressed.clear();
      for (const [key, action] of [
        ["KeyI", "inventory"],
        ["KeyJ", "quests"],
        ["KeyM", "map"],
        ["KeyC", "craft"],
        ["KeyB", "build"],
        ["KeyE", "interact"],
        ["KeyF", "attack"],
        ["KeyQ", "skill"],
        ["KeyR", "dodge"],
        ["KeyV", "map"],
      ] as const)
        if (this.input.consume(key)) void this.action(action);
      if (this.input.consume("KeyG")) this.plant();
      if (this.input.consume("KeyH")) this.harvest();
      if (this.input.consume("Escape")) {
        this.preview?.removeFromParent();
        this.preview = undefined;
        this.ui.close();
      }
      if (!this.ui.panel.open && !this.overview) {
        this.accumulator += dt;
        while (this.accumulator >= 1 / 60) {
          this.step();
          this.accumulator -= 1 / 60;
        }
      } else this.input.keys.clear();
      const p = this.physics.position;
      if (this.overview) {
        this.camera.position.lerp(new T.Vector3(290, 245, -340), 0.04);
        this.camera.lookAt(0, 10, 0);
      } else {
        const center = p.clone().add(new T.Vector3(0, 1.35, 0));
        const wanted = center
          .clone()
          .add(
            new T.Vector3(
              Math.sin(this.input.yaw) * Math.cos(this.input.pitch),
              Math.sin(this.input.pitch),
              Math.cos(this.input.yaw) * Math.cos(this.input.pitch),
            ).multiplyScalar(this.input.distance),
          );
        wanted.y = Math.max(wanted.y, height(wanted.x, wanted.z) + 1.1);
        this.raycaster.set(center, wanted.clone().sub(center).normalize());
        this.raycaster.far = center.distanceTo(wanted);
        const hit = this.raycaster
          .intersectObjects(this.world.group.children, false)
          .find(
            (h) => h.object !== this.world.terrain.mesh && h.distance > 0.5,
          );
        if (hit)
          wanted
            .copy(center)
            .addScaledVector(
              this.raycaster.ray.direction,
              Math.max(1, hit.distance - 0.3),
            );
        this.camera.position.lerp(wanted, 1 - Math.exp(-8 * dt));
        this.camera.lookAt(center);
      }
      for (const r of this.resources) r.object.visible = r.ready < Date.now();
      if (this.preview) {
        this.preview.position
          .copy(p)
          .add(
            new T.Vector3(
              Math.sin(this.player!.group.rotation.y) * 4,
              0,
              Math.cos(this.player!.group.rotation.y) * 4,
            ),
          );
        this.preview.position.y =
          height(this.preview.position.x, this.preview.position.z) + 0.9;
        (this.preview.material as T.MeshBasicMaterial).color.set(
          this.validBuild(this.preview.position.x, this.preview.position.z)
            ? "#71ce96"
            : "#ef7068",
        );
      }
      if (this.fishing && now > this.fishReady + 2200) {
        this.fishing = 0;
        this.ui.toast("O peixe escapou. Tente novamente.");
      }
      const n = this.nearest();
      const prompt = this.nearChest()
        ? "E · Abrir baú"
        : this.preview
          ? "E · Confirmar construção · Esc cancelar"
          : this.fishing
            ? now > this.fishReady
              ? "Fisgou! Pressione E agora!"
              : "Aguarde a fisgada…"
            : n
              ? "E · " +
                ("item" in n
                  ? items[n.item].name
                  : n.kind === "sheep"
                    ? "Recolher lã"
                    : n.kind === "wolf"
                      ? "Atacar"
                      : n.id)
              : lake(p.x, p.z) < 1.35
                ? "E · Pescar na margem"
                : "";
      this.hudTimer += dt;
      if (this.hudTimer > 0.12) {
        this.ui.update(this.state, this.stamina, p, prompt);
        this.hudTimer = 0;
        document.getElementById("stats")!.textContent = this.debug
          ? `${this.fps.toFixed(0)} FPS · ${this.renderer.info.render.calls} calls · ${this.renderer.info.render.triangles.toLocaleString()} triângulos · ${this.assets.loaded} modelos · ${this.renderer.info.memory.textures} texturas`
          : "";
      }
      this.saveTimer += dt;
      if (this.saveTimer > 30) {
        this.saveTimer = 0;
        void this.save(true);
        this.updateCrops();
      }
    }
    this.renderer.render(this.scene, this.camera);
  };
}
