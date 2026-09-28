/** A single camera pointer; the walk pad owns its independent pointer. CSS pixels. */
export class PlazaPointerGesture {
  pointer: number | null = null;
  dragging = false;
  #start = { x: 0, y: 0 };
  #last = this.#start;
  begin(id: number, x: number, y: number) {
    if (this.pointer !== null || !Number.isSafeInteger(id) || id === -1) return false;
    this.pointer = id; this.dragging = false;
    this.#start = this.#last = { x, y }; return true;
  }
  move(id: number, x: number, y: number) {
    if (id !== this.pointer) return null;
    if (!this.dragging && Math.hypot(x - this.#start.x, y - this.#start.y) < 8) return null;
    this.dragging = true;
    const delta = { x: x - this.#last.x, y: y - this.#last.y };
    this.#last = { x, y }; return delta;
  }
  end(id: number, x: number, y: number) {
    if (id !== this.pointer) return false;
    this.move(id, x, y); // A distant release is never a tap, even without pointermove.
    const tap = !this.dragging; this.clear(); return tap;
  }
  clear() { this.pointer = null; this.dragging = false; }
}
