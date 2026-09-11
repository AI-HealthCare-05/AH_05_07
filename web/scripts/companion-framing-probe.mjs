// Browser-only test/capture probe; never imported by the application.
// Preserve the buffer solely to inspect actual WebGL alpha pixels before CSS clipping.
export function installCompanionFramingProbe() {
  const originalContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attributes) {
    return originalContext.call(this, type, /^webgl/.test(type)
      ? { ...attributes, preserveDrawingBuffer: true } : attributes);
  };
  const samples = [];
  let paused = false;
  let pauseAt = null;
  const counts = {};
  const sample = () => {
    const canvas = document.querySelector('[data-companion-canvas]');
    const host = canvas?.parentElement;
    if (!canvas || host?.dataset.companionStatus !== 'ready') return null;
    const gl = originalContext.call(canvas, 'webgl2');
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const canvasBox = canvas.getBoundingClientRect();
    const ripple = canvas.closest('.save-ripple');
    const clipBox = ripple?.getBoundingClientRect();
    const style = ripple && getComputedStyle(ripple);
    const radii = style && [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].map(value => {
      const [x, y = x] = value.split(' ');
      const length = (part, total) => parseFloat(part) * (part.endsWith('%') ? total / 100 : 1);
      return [length(x, clipBox.width), length(y, clipBox.height)];
    });
    const insideClip = (x, y) => {
      if (!clipBox || !/hidden|clip/.test(style.overflow)) return true;
      const px = canvasBox.left - clipBox.left + (x + .5) * canvasBox.width / width;
      const py = canvasBox.top - clipBox.top + (height - y - .5) * canvasBox.height / height;
      if (px < 0 || py < 0 || px > clipBox.width || py > clipBox.height) return false;
      return radii.every(([rx, ry], corner) => {
        const dx = corner % 2 ? clipBox.width - px : px;
        const dy = corner >= 2 ? clipBox.height - py : py;
        return dx >= rx || dy >= ry || ((dx - rx) / rx) ** 2 + ((dy - ry) / ry) ** 2 <= 1;
      });
    };
    let left = width, right = -1, top = height, bottom = -1;
    let cssClippedPixels = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] <= 8) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, height - 1 - y); bottom = Math.max(bottom, height - 1 - y);
      if (!insideClip(x, y)) cssClippedPixels++;
    }
    return { phase: host.dataset.companionPhase, width, height, left, top,
      right: width - 1 - right, bottom: height - 1 - bottom, paintedHeight: bottom - top + 1, cssClippedPixels };
  };
  const originalRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => originalRaf(time => {
    if (paused) return;
    callback(time);
    const bounds = sample();
    if (!bounds) return;
    samples.push(bounds);
    counts[bounds.phase] = (counts[bounds.phase] ?? 0) + 1;
    if (pauseAt?.phase === bounds.phase && counts[bounds.phase] >= pauseAt.frames) paused = true;
  });
  window.__companionFramingProbe = {
    sample, report: () => ({ samples, counts, paused }),
    pauseAfter: (phase, frames) => { pauseAt = { phase, frames }; },
  };
}
