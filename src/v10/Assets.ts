import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import catalog from "../../assets/ASSET_CATALOG.json";
type Variant = {
  original: string;
  desktop: { path: string };
  mobile: { path: string };
};
export class Assets {
  manager = new T.LoadingManager();
  loader = new GLTFLoader(this.manager);
  cache = new Map<string, Promise<GLTF>>();
  textures = new Map<string, T.Texture>();
  loaded = 0;
  errors: string[] = [];
  async init(mobile: boolean) {
    const variants: Variant[] = await fetch(
      "/assets/optimized/texture-variants.json",
    ).then((r) => r.json());
    const paths = new Map(
      variants.map((v) => [v.original, v[mobile ? "mobile" : "desktop"].path]),
    );
    this.manager.setURLModifier((url) => {
      const path = decodeURI(url).replace(/^.*\/assets\//, "");
      return paths.has(path) ? "/assets/" + paths.get(path) : url;
    });
    this.manager.onError = (url) => {
      this.errors.push(url);
    };
  }
  async model(path: string) {
    if (!catalog.models.includes(path))
      throw new Error("Recurso fora do catálogo: " + path);
    if (!this.cache.has(path))
      this.cache.set(
        path,
        this.loader
          .loadAsync("/assets/" + path)
          .then((g) => {
            this.loaded++;
            return g;
          })
          .catch((e) => {
            this.cache.delete(path);
            throw e;
          }),
      );
    return this.cache.get(path)!;
  }
  async instance(path: string, targetHeight: number) {
    const gltf = await this.model(path),
      root = clone(gltf.scene);
    root.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(root),
      size = box.getSize(new T.Vector3());
    const scale = targetHeight / size.y;
    root.scale.multiplyScalar(scale);
    root.position.y -= box.min.y * scale;
    const group = new T.Group();
    group.add(root);
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return { group, clips: gltf.animations, root };
  }
  texture(path: string, repeat = 1) {
    if (!catalog.assets.some((a) => a.path === path))
      throw new Error("Textura fora do catálogo: " + path);
    const key = path + repeat;
    if (this.textures.has(key)) return this.textures.get(key)!;
    const t = new T.TextureLoader(this.manager).load("/assets/" + path);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    this.textures.set(key, t);
    return t;
  }
}
