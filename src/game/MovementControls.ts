type MoveHandler = (dx: number, dy: number, deltaMs: number) => void;
type ActionHandler = () => void;

const MOVEMENT_CODES = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "KeyA", "KeyD", "KeyW", "KeyS",
]);

export class MovementControls {
  private readonly root: HTMLElement;
  private readonly joystick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly onMove: MoveHandler;
  private readonly onAction: ActionHandler | null;
  private readonly keys = new Set<string>();
  private stick = { x: 0, y: 0, pointerId: -1 };
  private enabled = false;
  private frame = 0;
  private lastFrame = performance.now();

  constructor(root: HTMLElement, onMove: MoveHandler, onAction: ActionHandler | null = null) {
    this.root = root;
    this.joystick = root.querySelector<HTMLElement>("[data-joystick]")!;
    this.knob = root.querySelector<HTMLElement>("[data-joystick-knob]")!;
    this.onMove = onMove;
    this.onAction = onAction;
    this.bind();
    this.frame = requestAnimationFrame(this.tick);
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.root.classList.toggle("is-disabled", !enabled);
    this.root.setAttribute("aria-disabled", String(!enabled));
    if (!enabled) this.reset();
  }

  private bind(): void {
    window.addEventListener("keydown", event => {
      if (!this.enabled || isTypingTarget(event.target)) return;
      if ((event.code === "KeyR" || event.code === "Space") && this.onAction) {
        if (!event.repeat) this.onAction();
        event.preventDefault();
        return;
      }
      if (!MOVEMENT_CODES.has(event.code)) return;
      const alreadyPressed = this.keys.has(event.code);
      this.keys.add(event.code);
      if (!alreadyPressed) {
        const vector = keyVector(event.code);
        this.onMove(vector.x, vector.y, 16.7);
      }
      event.preventDefault();
    });
    window.addEventListener("keyup", event => {
      if (!MOVEMENT_CODES.has(event.code)) return;
      this.keys.delete(event.code);
    });
    window.addEventListener("blur", () => this.reset());

    this.joystick.addEventListener("pointerdown", event => {
      if (!this.enabled) return;
      this.stick.pointerId = event.pointerId;
      this.joystick.setPointerCapture(event.pointerId);
      this.updateStick(event);
      event.preventDefault();
    });
    this.joystick.addEventListener("pointermove", event => {
      if (event.pointerId !== this.stick.pointerId) return;
      this.updateStick(event);
      event.preventDefault();
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.stick.pointerId) return;
      this.resetStick();
    };
    this.joystick.addEventListener("pointerup", release);
    this.joystick.addEventListener("pointercancel", release);
    this.joystick.addEventListener("lostpointercapture", () => this.resetStick());
  }

  private updateStick(event: PointerEvent): void {
    const rect = this.joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
    let x = event.clientX - (rect.left + rect.width / 2);
    let y = event.clientY - (rect.top + rect.height / 2);
    const length = Math.sqrt(x * x + y * y);
    if (length > radius) {
      x *= radius / length;
      y *= radius / length;
    }
    this.stick.x = x / radius;
    this.stick.y = y / radius;
    this.knob.style.transform = `translate(${x}px, ${y}px)`;
  }

  private reset(): void {
    this.keys.clear();
    this.resetStick();
  }

  private resetStick(): void {
    this.stick = { x: 0, y: 0, pointerId: -1 };
    this.knob.style.transform = "translate(0, 0)";
  }

  private readonly tick = (time: number): void => {
    const deltaMs = Math.min(40, Math.max(0, time - this.lastFrame));
    this.lastFrame = time;
    if (this.enabled) {
      let dx = this.stick.x;
      let dy = this.stick.y;
      if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) dx -= 1;
      if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) dx += 1;
      if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) dy -= 1;
      if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) dy += 1;
      if (Math.abs(dx) > 0.08 || Math.abs(dy) > 0.08) this.onMove(dx, dy, deltaMs);
    }
    this.frame = requestAnimationFrame(this.tick);
  };
}

function keyVector(code: string): { x: number; y: number } {
  if (code === "ArrowLeft" || code === "KeyA") return { x: -1, y: 0 };
  if (code === "ArrowRight" || code === "KeyD") return { x: 1, y: 0 };
  if (code === "ArrowUp" || code === "KeyW") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable);
}
