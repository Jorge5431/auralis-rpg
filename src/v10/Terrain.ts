import * as T from "three";
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (x: number, z: number) => {
  const n = Math.sin(x * 127.1 + z * 311.7 + 17) * 43758.5453;
  return n - Math.floor(n);
};
export function noise(x: number, z: number) {
  const i = Math.floor(x),
    j = Math.floor(z),
    a = smooth(0, 1, x - i),
    b = smooth(0, 1, z - j);
  return T.MathUtils.lerp(
    T.MathUtils.lerp(hash(i, j), hash(i + 1, j), a),
    T.MathUtils.lerp(hash(i, j + 1), hash(i + 1, j + 1), a),
    b,
  );
}
export function random(seed = 41) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export const roads = [
  [
    [0, -145],
    [0, -98],
    [-68, -65],
    [-82, 0],
    [-75, 65],
    [-45, 108],
    [-65, 145],
    [-25, 160],
    [8, 149],
  ],
  [
    [0, -110],
    [65, -115],
    [115, -110],
  ],
  [
    [115, -110],
    [128, -65],
    [125, -30],
  ],
  [
    [0, -98],
    [30, -70],
    [50, -48],
  ],
] as number[][][];
export function pathDistance(x: number, z: number) {
  let d = 1e6;
  for (const road of roads)
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1],
        b = road[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz));
      d = Math.min(d, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
    }
  return d;
}
export function edge(x: number, z: number) {
  const angle = Math.atan2(z / 235, x / 185);
  const r =
    1 +
    0.065 * Math.sin(angle * 5) +
    0.045 * Math.sin(angle * 9 + 1) +
    0.03 * Math.cos(angle * 13);
  return Math.hypot(x / 185, z / 235) / r;
}
export function lake(x: number, z: number) {
  const a = Math.atan2(z / 58, x / 62);
  return (
    Math.hypot(x / 62, z / 58) /
    (1 + 0.09 * Math.sin(a * 3) + 0.05 * Math.cos(a * 5))
  );
}
export function height(x: number, z: number) {
  const n =
    (noise(x / 55, z / 55) - 0.5) * 9 +
    (noise(x / 19, z / 19) - 0.5) * 3 +
    (noise(x / 7, z / 7) - 0.5) * 0.7;
  let h = 9 + n;
  for (const [mx, mz, amp, sx, sz] of [
    [-60, 172, 78, 42, 47],
    [10, 193, 110, 36, 40],
    [72, 165, 83, 40, 44],
    [-110, 130, 40, 30, 40],
  ])
    h +=
      amp *
      Math.exp(-((x - mx) ** 2 / sx ** 2 + (z - mz) ** 2 / sz ** 2)) *
      (0.77 + 0.36 * noise(x / 15, z / 17));
  const road = smooth(3, 11, pathDistance(x, z));
  h = T.MathUtils.lerp(9 + Math.max(0, z - 100) * 0.65, h, road);
  const village = 1 - smooth(45, 82, Math.hypot(x, z + 135));
  h = T.MathUtils.lerp(h, 10, village);
  const farm = 1 - smooth(23, 42, Math.hypot(x - 110, z + 115));
  h = T.MathUtils.lerp(h, 11, farm);
  const l = lake(x, z);
  h = T.MathUtils.lerp(1.5, h, smooth(0.78, 1.22, l));
  // The southern river cuts a channel from the mountain basin into the lake.
  const riverX = 8 + Math.sin(z * 0.055) * 5;
  if (z > 45 && z < 145)
    h = T.MathUtils.lerp(
      h,
      5 + (z - 50) * 0.1,
      (1 - smooth(4, 10, Math.abs(x - riverX))) * smooth(45, 60, z),
    );
  return h;
}
export function region(x: number, z: number) {
  return z > 105
    ? "Cordilheira da Nascente"
    : x > 90 && z < -75
      ? "Fazenda dos Ventos"
      : x > 95
        ? "Torre da Aurora"
        : z < -88
          ? "Vila de Auralis"
          : lake(x, z) < 1.25
            ? "Lago dos Céus"
            : "Bosque das Brumas";
}
export class Terrain {
  mesh: T.Mesh;
  positions: Float32Array;
  indices: Uint32Array;
  constructor() {
    const vertices: number[] = [],
      colors: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    const n = 240,
      w = 420,
      d = 530;
    const green = new T.Color(),
      sand = new T.Color("#b9aa7d"),
      rock = new T.Color("#8d9387");
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const x = (i / n - 0.5) * w,
          z = (j / n - 0.5) * d,
          y = height(x, z);
        vertices.push(x, y, z);
        uv.push(x / 12, z / 12);
        green.setHSL(
          0.24 + noise(x / 40, z / 40) * 0.03,
          0.48,
          0.24 + noise(x / 13, z / 13) * 0.12,
        );
        const slope = Math.hypot(height(x + 1, z) - y, height(x, z + 1) - y);
        green.lerp(rock, smooth(0.5, 1.5, slope));
        green.lerp(sand, 1 - smooth(2.6, 4.5, pathDistance(x, z)));
        green.lerp(sand, (1 - smooth(0.97, 1.13, lake(x, z))) * 0.75);
        if (y > 80) green.lerp(new T.Color("#e5e8dc"), smooth(80, 102, y));
        colors.push(green.r, green.g, green.b);
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n - 0.5) * w,
          z = ((j + 0.5) / n - 0.5) * d;
        if (edge(x, z) > 1) continue;
        const a = j * (n + 1) + i,
          b = a + 1,
          c = a + n + 1,
          e = c + 1;
        indices.push(a, c, b, b, c, e);
      }
    this.positions = new Float32Array(vertices);
    this.indices = new Uint32Array(indices);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(this.positions, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(new T.BufferAttribute(this.indices, 1));
    g.computeVertexNormals();
    this.mesh = new T.Mesh(
      g,
      new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    );
    this.mesh.receiveShadow = true;
  }
}
