import * as T from "three";
export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  axis = new T.Vector2();
  yaw = 0;
  pitch = 0.27;
  distance = 7;
  target: T.Vector3 | null = null;
  dragging = false;
  private lastX = 0;
  private lastY = 0;
  private dragDistance = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  constructor(
    public canvas: HTMLCanvasElement,
    public onClick: (x: number, y: number) => void,
  ) {
    window.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (
        [
          "Space",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
        ].includes(e.code)
      )
        e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.axis.set(0, 0);
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragDistance = 0;
      this.dragging = true;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()],
          d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch)
          this.distance = T.MathUtils.clamp(
            this.distance + (this.pinch - d) * 0.025,
            3,
            18,
          );
        this.pinch = d;
        return;
      }
      const dx = e.clientX - this.lastX,
        dy = e.clientY - this.lastY;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      this.yaw -= dx * 0.005;
      this.pitch = T.MathUtils.clamp(this.pitch + dy * 0.004, -0.15, 1.2);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener("pointerup", (e) => {
      this.pointers.delete(e.pointerId);
      if (this.dragDistance < 5 && e.button === 0)
        this.onClick(e.clientX, e.clientY);
      this.dragging = this.pointers.size > 0;
      this.pinch = 0;
    });
    canvas.addEventListener("pointercancel", () => {
      this.pointers.clear();
      this.dragging = false;
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.distance = T.MathUtils.clamp(
          this.distance + e.deltaY * 0.012,
          3,
          18,
        );
      },
      { passive: false },
    );
  }
  consume(code: string) {
    const yes = this.pressed.has(code);
    this.pressed.delete(code);
    return yes;
  }
  movement() {
    return new T.Vector2(
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
        Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")) +
        this.axis.x,
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
        Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
        this.axis.y,
    ).clampLength(0, 1);
  }
}
