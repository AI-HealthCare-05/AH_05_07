/** Garden-only drawing-buffer budget. CSS viewport size never implies full DPR. */
export function gardenPixelRatio(width: number, height: number, deviceRatio: number) {
  const pixels = Math.max(1, width) * Math.max(1, height);
  const dpr = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  // At most 2 MP and 1.5x density, including sub-1 density on large displays.
  return Math.min(dpr, 1.5, Math.sqrt(2_000_000 / pixels));
}
