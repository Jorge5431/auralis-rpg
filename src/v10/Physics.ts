import R from "@dimforge/rapier3d-compat";
import * as T from "three";
import type { World, Obstacle } from "./World";
export class Physics {
  world: R.World;
  body: R.RigidBody;
  collider: R.Collider;
  controller: R.KinematicCharacterController;
  velocityY = 0;
  grounded = false;
  position = new T.Vector3();
  constructor(world: World) {
    this.world = new R.World({ x: 0, y: -22, z: 0 });
    this.world.timestep = 1 / 60;
    this.world.createCollider(
      R.ColliderDesc.trimesh(world.terrain.positions, world.terrain.indices),
    );
    for (const o of world.obstacles) this.obstacle(o);
    this.body = this.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 13, -115),
    );
    this.collider = this.world.createCollider(
      R.ColliderDesc.capsule(0.55, 0.32),
      this.body,
    );
    this.controller = this.world.createCharacterController(0.03);
    this.controller.enableAutostep(0.4, 0.2, true);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle(Math.PI * 0.28);
    this.controller.setMinSlopeSlideAngle(Math.PI * 0.34);
    this.world.step();
  }
  static async init(world: World) {
    await R.init();
    return new Physics(world);
  }
  obstacle(o: Obstacle) {
    return this.world.createCollider(
      R.ColliderDesc.cuboid(o.w / 2, o.h / 2, o.d / 2).setTranslation(
        o.x,
        o.y + o.h / 2,
        o.z,
      ),
    );
  }
  teleport(x: number, y: number, z: number) {
    this.body.setTranslation({ x, y: y + 0.9, z }, true);
    this.velocityY = 0;
    this.position.set(x, y, z);
    this.world.step();
  }
  step(dx: number, dz: number, jump: boolean) {
    if (jump && this.grounded) this.velocityY = 8;
    this.velocityY = Math.max(-35, this.velocityY - 22 / 60);
    this.controller.computeColliderMovement(this.collider, {
      x: dx,
      y: this.velocityY / 60,
      z: dz,
    });
    const movement = this.controller.computedMovement(),
      p = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: p.x + movement.x,
      y: p.y + movement.y,
      z: p.z + movement.z,
    });
    this.world.step();
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.velocityY < 0) this.velocityY = 0;
    const n = this.body.translation();
    this.position.set(n.x, n.y - 0.87, n.z);
    return this.position;
  }
}
