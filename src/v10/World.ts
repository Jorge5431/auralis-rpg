import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Assets } from "./Assets";
import {
  Terrain,
  height,
  edge,
  lake,
  pathDistance,
  random,
  noise,
} from "./Terrain";
export type Obstacle = {
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  h: number;
};
export class World {
  terrain = new Terrain();
  group = new T.Group();
  obstacles: Obstacle[] = [];
  water: T.ShaderMaterial;
  clouds = new T.Group();
  sun = new T.DirectionalLight("#fff0ce", 3);
  ambient = new T.HemisphereLight("#d0efff", "#67734c", 2);
  time = 10;
  private batches = new Map<T.Material, T.BufferGeometry[]>();
  constructor(
    public scene: T.Scene,
    public assets: Assets,
    public mobile: boolean,
  ) {
    scene.background = new T.Color("#9dcfe8");
    scene.fog = new T.FogExp2("#b4d9e4", 0.00085);
    scene.add(
      this.group,
      this.clouds,
      this.sun,
      this.ambient,
      new T.AmbientLight("#d8e6ed", 0.45),
    );
    this.group.add(this.terrain.mesh);
    this.groundDetail();
    this.sun.position.set(-80, 170, -80);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -80,
      right: 80,
      top: 80,
      bottom: -80,
      near: 1,
      far: 350,
    });
    this.sun.shadow.normalBias = 0.08;
    scene.add(this.sun.target);
    this.water = new T.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        deep: { value: new T.Color("#147f99") },
        shallow: { value: new T.Color("#64d6c9") },
      },
      vertexShader: `varying vec3 vPos; varying vec3 vWorld; uniform float time; void main(){vec3 p=position;p.z+=sin(p.x*.21+time)*.11+cos(p.y*.27+time*.7)*.09;vPos=p;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `varying vec3 vPos;varying vec3 vWorld;uniform float time;uniform vec3 deep;uniform vec3 shallow;void main(){float a=atan(vPos.y/58.,vPos.x/62.);float r=length(vec2(vPos.x/62.,vPos.y/58.))/(1.+.09*sin(a*3.)+.05*cos(a*5.));if(r>1.04)discard;float ripple=sin(vPos.x*.7+sin(vPos.y*.43+time)*2.+time)*cos(vPos.y*.54-time*.6);vec3 c=mix(deep,shallow,smoothstep(.25,1.,r));float fres=pow(1.-abs(normalize(cameraPosition-vWorld).y),3.);c=mix(c,vec3(.74,.9,.96),fres*.5);c+=pow(max(0.,ripple),18.)*.32;c=mix(c,vec3(.84,.97,.89),smoothstep(.96,1.04,r)*(.65+.15*sin(a*80.+time*2.)));gl_FragColor=vec4(c,1.);}`,
      side: T.DoubleSide,
    });
    const water = new T.Mesh(new T.PlaneGeometry(145, 140, 80, 80), this.water);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 5.4;
    this.group.add(water);
  }
  groundDetail() {
    const mat = this.terrain.mesh.material as T.MeshStandardMaterial;
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 terrainPos;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nterrainPos=position;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
varying vec3 terrainPos;
float terrainNoise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
float grain=terrainNoise(floor(terrainPos.xz*22.));
float mottling=terrainNoise(floor(terrainPos.xz*3.));
float rock=sin(terrainPos.y*2.3+sin(terrainPos.x*.6)*3.+sin(terrainPos.z*.45));
diffuseColor.rgb*=.76+grain*.30+mottling*.16;
diffuseColor.rgb*=1.-smoothstep(25.,70.,terrainPos.y)*(.07+.08*rock);
`,
        );
    };
  }
  material(color: string, texture?: string) {
    return new T.MeshStandardMaterial({
      color: texture ? "#ece5d5" : color,
      roughness: 0.93,
      map: texture
        ? this.assets.texture("textures/polyhaven/" + texture + "_4k/color.jpg")
        : null,
    });
  }
  add(
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    rz = 0,
  ) {
    const matrix = new T.Matrix4().compose(
      new T.Vector3(x, y, z),
      new T.Quaternion().setFromEuler(new T.Euler(0, 0, rz)),
      new T.Vector3(sx, sy, sz),
    );
    g = g.clone().applyMatrix4(matrix);
    if (!this.batches.has(m)) this.batches.set(m, []);
    this.batches.get(m)!.push(g);
  }
  box(
    m: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rz = 0,
  ) {
    this.add(new T.BoxGeometry(), m, x, y, z, w, h, d, rz);
  }
  flush() {
    for (const [mat, geoms] of this.batches) {
      const mesh = new T.Mesh(mergeGeometries(geoms), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      geoms.forEach((g) => g.dispose());
    }
    this.batches.clear();
  }
  async build() {
    const rand = random(),
      stone = this.material("#989c8c", "stone_brick_wall_001"),
      rock = this.material("#777e77", "dark_rock_02"),
      wood = this.material("#776047", "weathered_planks"),
      plaster = this.material("#eadabb"),
      roof = this.material("#a45e46"),
      dark = this.material("#233c42"),
      gold = this.material("#dfae66");
    // A continuous, deeply fractured ring anchors the island surface.
    const pv: number[] = [],
      pi: number[] = [];
    const steps = 320,
      rings = 8;
    for (let j = 0; j <= rings; j++)
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2,
          r =
            1 +
            0.065 * Math.sin(a * 5) +
            0.045 * Math.sin(a * 9 + 1) +
            0.03 * Math.cos(a * 13);
        const t = j / rings,
          fracture = (noise(i * 0.13, j * 0.7) - 0.5) * 15 * t;
        const taper = 1 - 0.45 * t * t;
        const x = Math.cos(a) * 185 * r * taper + fracture,
          z = Math.sin(a) * 235 * r * taper + fracture;
        const top = height(Math.cos(a) * 185 * r, Math.sin(a) * 235 * r);
        pv.push(
          x,
          top * (1 - t) - 90 * t - 25 * Math.sin(a * 7) ** 2 * t + fracture,
          z,
        );
        if (j < rings && i < steps) {
          const q = j * (steps + 1) + i;
          pi.push(q, q + 1, q + steps + 1, q + 1, q + steps + 2, q + steps + 1);
        }
      }
    const underside = new T.BufferGeometry();
    underside.setAttribute("position", new T.Float32BufferAttribute(pv, 3));
    underside.setIndex(pi);
    underside.computeVertexNormals();
    const cliff = new T.Mesh(
      underside,
      new T.MeshStandardMaterial({
        color: "#737e78",
        roughness: 1,
        side: T.DoubleSide,
      }),
    );
    this.group.add(cliff);
    for (let i = 0; i < 100; i++) {
      const a = rand() * Math.PI * 2,
        r = 0.91;
      const x = Math.cos(a) * 185 * r,
        z = Math.sin(a) * 235 * r;
      this.add(
        new T.DodecahedronGeometry(1, 1),
        rock,
        x,
        height(x, z) - 26,
        z,
        6 + rand() * 8,
        16 + rand() * 15,
        6 + rand() * 8,
      );
    }
    const houses = [
      [-34, -155, 9, 12],
      [-14, -171, 10, 10],
      [18, -169, 12, 11],
      [42, -148, 10, 12],
      [-35, -123, 11, 10],
      [30, -118, 10, 10],
      [-27, -95, 9, 10],
      [102, -143, 14, 10],
    ];
    for (const [x, z, w, d] of houses) {
      const y = height(x, z),
        h = 7.4;
      this.box(stone, x, y + 1, z, w, 2, d);
      this.box(plaster, x, y + 4.3, z, w, 6.6, d);
      this.obstacles.push({ x, z, y, w, d, h: 11 });
      for (const dx of [-w / 2, 0, w / 2])
        this.box(wood, x + dx, y + 4, z, 0.22, 8, d + 0.15);
      for (const dz of [-d / 2, d / 2]) {
        for (const dy of [1.9, 4.5, 7.5])
          this.box(wood, x, y + dy, z + dz, w + 0.25, 0.22, 0.22);
        for (const dx of [-w * 0.32, w * 0.32]) {
          this.box(dark, x + dx, y + 5.8, z + dz * 1.012, 1.5, 1.9, 0.15);
          this.box(wood, x + dx, y + 5.8, z + dz * 1.025, 0.1, 2, 0.14);
          this.box(wood, x + dx, y + 5.8, z + dz * 1.025, 1.6, 0.1, 0.14);
          this.box(wood, x + dx, y + 4.8, z + dz * 1.07, 1.9, 0.25, 0.7);
        }
        this.box(wood, x, y + 1.8, z + dz * 1.02, 1.9, 3.4, 0.2);
        this.box(gold, x + 0.65, y + 1.9, z + dz * 1.04, 0.15, 0.15, 0.15);
      }
      // Individual roof courses, overhangs, ridge, chimney and diagonal timber braces.
      for (let side = -1; side <= 1; side += 2) {
        const rw = w / 2 + 0.8,
          angle = -side * Math.atan2(3.4, rw);
        this.box(
          roof,
          x + (side * rw) / 2,
          y + 9,
          z,
          Math.hypot(rw, 3.4) + 0.2,
          0.25,
          d + 1.7,
          angle,
        );
        for (let k = 0; k < 9; k++) {
          const t = k / 9;
          this.box(
            roof,
            x + side * rw * t,
            y + 10.8 - t * 3.4,
            z,
            0.14,
            0.16,
            d + 1.8,
            angle,
          );
        }
        this.box(
          wood,
          x + side * w * 0.25,
          y + 6,
          z + d / 2 + 0.14,
          0.22,
          3.5,
          0.2,
          side * 0.65,
        );
      }
      const gable = new T.BufferGeometry();
      gable.setAttribute(
        "position",
        new T.Float32BufferAttribute(
          [-w / 2, 7.5, 0, w / 2, 7.5, 0, 0, 10.7, 0],
          3,
        ),
      );
      gable.setAttribute(
        "uv",
        new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2),
      );
      gable.setIndex([0, 1, 2, 2, 1, 0]);
      gable.computeVertexNormals();
      this.add(gable, plaster, x, y, z + d / 2);
      this.add(gable, plaster, x, y, z - d / 2);
      this.box(roof, x, y + 10.85, z, 0.45, 0.35, d + 2);
      this.box(stone, x + w * 0.28, y + 10, z - d * 0.23, 1.1, 4, 1.1);
      this.box(stone, x + w * 0.28, y + 12.1, z - d * 0.23, 1.4, 0.3, 1.4);
    }
    // Village well and farm fences with a real walk-through gate.
    const wellY = height(0, -134);
    this.add(
      new T.TorusGeometry(2, 0.4, 8, 20).rotateX(Math.PI / 2),
      stone,
      0,
      wellY + 0.7,
      -134,
    );
    for (const x of [-2, 2]) this.box(wood, x, wellY + 2, -134, 0.25, 4, 0.25);
    this.box(roof, 0, wellY + 4, -134, 5, 0.25, 3);
    for (let i = 0; i < 13; i++) {
      for (const z of [-132, -92]) {
        const x = 88 + i * 3.4;
        this.box(wood, x, 12, z, 0.16, 2, 0.16);
        if (i < 12) this.box(wood, x + 1.7, 12.4, z, 3.4, 0.13, 0.13);
      }
      for (const x of [88, 129]) {
        const z = -132 + i * 3.3;
        if (x === 88 && i > 4 && i < 8) continue;
        this.box(wood, x, 12, z, 0.16, 2, 0.16);
        if (i < 12) this.box(wood, x, 12.4, z + 1.6, 0.13, 0.13, 3.3);
      }
    }
    // Spiral stairs climb the observation tower; no inaccessible solid tower collider.
    const tx = 125,
      tz = -32,
      ty = height(tx, tz);
    for (let i = 0; i < 68; i++) {
      const a = (i / 68) * Math.PI * 4,
        x = tx + Math.sin(a) * 4,
        z = tz + Math.cos(a) * 4,
        y = ty + i * 0.285;
      this.box(stone, x, y, z, 1.15, 0.3, 1.15);
      this.obstacles.push({ x, z, y: y - 0.15, w: 1.15, d: 1.15, h: 0.3 });
    }
    this.add(new T.CylinderGeometry(1.9, 2.4, 20, 16), stone, tx, ty + 10, tz);
    this.obstacles.push({ x: tx, z: tz, y: ty, w: 3.5, d: 3.5, h: 20 });
    // The western stairwell remains open; the eastern terrace is accessible from the last step.
    for (const [dx, dz] of [
      [2.5, 2.5],
      [2.5, -2.5],
    ]) {
      this.box(stone, tx + dx, ty + 19.3, tz + dz, 5, 0.3, 5);
      this.obstacles.push({
        x: tx + dx,
        z: tz + dz,
        y: ty + 19.15,
        w: 5,
        d: 5,
        h: 0.3,
      });
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (Math.sin(a) < 0) continue;
      this.box(
        stone,
        tx + Math.sin(a) * 5.5,
        ty + 20,
        tz + Math.cos(a) * 5.5,
        1,
        1.6,
        1,
      );
    }
    // Stream and falling water share the southern channel.
    const streamMat = new T.MeshStandardMaterial({
      color: "#61d3d8",
      roughness: 0.18,
      metalness: 0.3,
    });
    for (let z = 54; z < 143; z += 2) {
      const x = 8 + Math.sin(z * 0.055) * 5;
      this.box(streamMat, x, 5.5 + (z - 50) * 0.1, z, 7, 0.2, 2.4);
    }
    const fy = height(8, 149);
    const falls = new T.Mesh(
      new T.PlaneGeometry(7, Math.max(12, fy - 14), 16, 32),
      new T.MeshStandardMaterial({
        color: "#d4f8f1",
        transparent: true,
        opacity: 0.8,
        side: T.DoubleSide,
        roughness: 0.3,
      }),
    );
    falls.position.set(8, (fy + 14) / 2, 145);
    this.group.add(falls);
    const mist = new T.Points(
      new T.BufferGeometry(),
      new T.PointsMaterial({
        color: "#e2fcfa",
        size: 1.3,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    );
    const mistP = [];
    for (let i = 0; i < 160; i++)
      mistP.push(
        8 + (rand() - 0.5) * 13,
        13 + rand() * 7,
        142 + (rand() - 0.5) * 10,
      );
    mist.geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(mistP, 3),
    );
    this.group.add(mist);
    const paving = this.material("#c6bc9b");
    for (let i = 0; i < 500; i++) {
      const x = (rand() - 0.5) * 24,
        z = -134 + (rand() - 0.5) * 33;
      if (Math.hypot(x, z + 134) < 2.5) continue;
      this.add(
        new T.CylinderGeometry(0.5, 0.58, 0.1, 6),
        paving,
        x,
        height(x, z) + 0.06,
        z,
        0.8 + rand() * 0.4,
        1,
        0.65 + rand() * 0.4,
      );
    }
    this.flush();
    // Instance each primitive in the authorized models: hundreds of trees, only a handful of draw calls.
    for (const name of [
      "tree_oak",
      "tree_default",
      "rock_largeA",
      "flower_purpleA",
      "flower_yellowA",
    ]) {
      const source = (
        await this.assets.instance("models/kenney/nature/" + name + ".glb", 1)
      ).group;
      source.updateMatrixWorld(true);
      const transforms: T.Matrix4[] = [];
      const count = name.startsWith("tree")
        ? this.mobile
          ? 160
          : 320
        : name.startsWith("flower")
          ? this.mobile
            ? 250
            : 650
          : 100;
      for (let i = 0; i < count * 6 && transforms.length < count; i++) {
        const x = (rand() - 0.5) * 350,
          z = (rand() - 0.5) * 430,
          y = height(x, z);
        if (
          edge(x, z) > 0.92 ||
          lake(x, z) < 1.17 ||
          pathDistance(x, z) < 6 ||
          (z < -90 && Math.abs(x) < 65) ||
          (x > 80 && z < -75) ||
          y > 72 ||
          this.obstacles.some(
            (o) =>
              Math.abs(x - o.x) < o.w / 2 + 4 &&
              Math.abs(z - o.z) < o.d / 2 + 4,
          )
        )
          continue;
        const s = name.startsWith("tree")
          ? 9 + rand() * 8
          : name.startsWith("flower")
            ? 0.4 + rand() * 0.5
            : 1 + rand() * 3;
        transforms.push(
          new T.Matrix4().compose(
            new T.Vector3(x, y - 0.08, z),
            new T.Quaternion().setFromAxisAngle(
              new T.Vector3(0, 1, 0),
              rand() * 6.28,
            ),
            new T.Vector3(s, s, s),
          ),
        );
        if (name.startsWith("tree"))
          this.obstacles.push({ x, z, y, w: 0.65, d: 0.65, h: 5 });
      }
      source.traverse((o) => {
        if (o instanceof T.Mesh) {
          const material = (o.material as T.MeshStandardMaterial).clone();
          material.metalness = 0;
          material.roughness = 0.95;
          if (material.name.toLowerCase().includes("leaf"))
            material.color.set(name === "tree_oak" ? "#589348" : "#3e744a");
          if (material.name.toLowerCase().includes("bark"))
            material.color.set("#82664a");
          if (name.startsWith("rock")) material.color.set("#9a9d8d");
          let geometry = o.geometry;
          if (material.name.toLowerCase().includes("leaf")) {
            const positions = geometry.getAttribute("position"),
              index = geometry.index;
            const center = new T.Vector3();
            let minY = Infinity,
              maxY = -Infinity,
              minX = Infinity,
              maxX = -Infinity,
              minZ = Infinity,
              maxZ = -Infinity;
            for (let k = 0; k < (index?.count ?? positions.count); k++) {
              const v = index ? index.getX(k) : k;
              minX = Math.min(minX, positions.getX(v));
              maxX = Math.max(maxX, positions.getX(v));
              minY = Math.min(minY, positions.getY(v));
              maxY = Math.max(maxY, positions.getY(v));
              minZ = Math.min(minZ, positions.getZ(v));
              maxZ = Math.max(maxZ, positions.getZ(v));
            }
            center.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
            const lobes: T.BufferGeometry[] = [];
            for (let k = 0; k < (this.mobile ? 12 : 24); k++) {
              const a = rand() * Math.PI * 2,
                r = Math.sqrt(rand()),
                yy = (rand() - 0.5) * 1.4;
              const lobe = new T.IcosahedronGeometry(1, this.mobile ? 0 : 1);
              lobe.scale(
                (maxX - minX) * (0.14 + rand() * 0.1),
                (maxY - minY) * (0.13 + rand() * 0.12),
                (maxZ - minZ) * (0.14 + rand() * 0.1),
              );
              lobe.translate(
                center.x + Math.cos(a) * r * (maxX - minX) * 0.35,
                center.y + yy * (maxY - minY) * 0.35,
                center.z + Math.sin(a) * r * (maxZ - minZ) * 0.35,
              );
              lobes.push(lobe);
            }
            geometry = mergeGeometries(lobes);
            lobes.forEach((g) => g.dispose());
          }
          const mesh = new T.InstancedMesh(
            geometry,
            material,
            transforms.length,
          );
          for (let i = 0; i < transforms.length; i++) {
            mesh.setMatrixAt(i, transforms[i].clone().multiply(o.matrixWorld));
            mesh.setColorAt(
              i,
              new T.Color().setHSL(0.12, 0.08, 0.72 + rand() * 0.22),
            );
          }
          mesh.castShadow = name.startsWith("tree");
          mesh.receiveShadow = true;
          mesh.computeBoundingSphere();
          this.group.add(mesh);
        }
      });
    }
    const blade = new T.BufferGeometry();
    blade.setAttribute(
      "position",
      new T.Float32BufferAttribute(
        [
          -0.07, 0, 0, 0.07, 0, 0, 0.025, 0.6, 0.04, 0, 0, -0.07, 0, 0, 0.07,
          0.04, 0.48, 0.02,
        ],
        3,
      ),
    );
    blade.computeVertexNormals();
    const grass = new T.InstancedMesh(
      blade,
      new T.MeshStandardMaterial({
        color: "#6b963e",
        roughness: 1,
        side: T.DoubleSide,
      }),
      this.mobile ? 4000 : 14000,
    );
    let gi = 0;
    for (let i = 0; i < 100000 && gi < grass.count; i++) {
      const x = (rand() - 0.5) * 340,
        z = (rand() - 0.5) * 400;
      if (
        edge(x, z) > 0.93 ||
        lake(x, z) < 1.15 ||
        pathDistance(x, z) < 4 ||
        height(x, z) > 60 ||
        (z < -90 && Math.abs(x) < 60) ||
        this.obstacles.some(
          (o) =>
            Math.abs(o.x - x) < o.w / 2 + 1 && Math.abs(o.z - z) < o.d / 2 + 1,
        )
      )
        continue;
      const scale = 0.5 + rand();
      grass.setMatrixAt(
        gi++,
        new T.Matrix4().compose(
          new T.Vector3(x, height(x, z), z),
          new T.Quaternion().setFromAxisAngle(
            new T.Vector3(0, 1, 0),
            rand() * 6.28,
          ),
          new T.Vector3(scale, scale, scale),
        ),
      );
    }
    grass.count = gi;
    grass.receiveShadow = true;
    this.group.add(grass);
    const stall = await this.assets.instance(
      "models/kenney/fantasy-town/stall-green.glb",
      3,
    );
    stall.group.position.set(13, height(13, -138), -138);
    this.group.add(stall.group);
    const cloudMat = new T.MeshBasicMaterial({
      color: "#edf5f8",
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const cloudGeo = new T.IcosahedronGeometry(1, 2);
    const clouds = new T.InstancedMesh(cloudGeo, cloudMat, 180);
    for (let i = 0; i < 180; i++) {
      const a = rand() * Math.PI * 2,
        r = 220 + rand() * 500;
      clouds.setMatrixAt(
        i,
        new T.Matrix4().compose(
          new T.Vector3(Math.cos(a) * r, -40 - rand() * 95, Math.sin(a) * r),
          new T.Quaternion(),
          new T.Vector3(30 + rand() * 50, 6 + rand() * 12, 20 + rand() * 30),
        ),
      );
    }
    this.clouds.add(clouds);
  }
  update(dt: number, player: T.Vector3) {
    this.time = (this.time + dt / 100) % 24;
    this.water.uniforms.time.value += dt;
    this.clouds.rotation.y += dt * 0.0003;
    const day = Math.max(0.12, Math.sin(((this.time - 6) / 24) * Math.PI * 2));
    this.sun.intensity = day * 2.3;
    this.ambient.intensity = 0.65 + day * 1.5;
    this.sun.position.set(player.x - 60, player.y + 130, player.z - 70);
    this.sun.target.position.copy(player);
    (this.scene.background as T.Color).setHSL(0.56, 0.43, 0.12 + day * 0.63);
    (this.scene.fog as T.FogExp2).color.copy(this.scene.background as T.Color);
  }
}
