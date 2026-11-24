import * as T from "three";
import { Assets } from "./Assets";
export class Actor {
  mixer: T.AnimationMixer;
  current = "";
  actions = new Map<string, T.AnimationAction>();
  constructor(
    public group: T.Group,
    root: T.Object3D,
    clips: T.AnimationClip[],
  ) {
    this.mixer = new T.AnimationMixer(root);
    for (const clip of clips)
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.play("Idle");
  }
  static async load(assets: Assets, path: string, height = 1.8) {
    const { group, root, clips } = await assets.instance(path, height);
    return new Actor(group, root, clips);
  }
  play(name: string, once = false) {
    if (this.current === name) return;
    const next = this.actions.get(name);
    if (!next) return;
    const old = this.actions.get(this.current);
    next.reset();
    next.setLoop(once ? T.LoopOnce : T.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.play();
    old?.fadeOut(0.18);
    next.fadeIn(0.18);
    this.current = name;
  }
  update(dt: number) {
    this.mixer.update(dt);
  }
}
