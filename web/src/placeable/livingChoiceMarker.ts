import { keepsakeMedia } from "./keepsakeMedia";
import { CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3 } from "three";

/** One still, low stone medallion beside the garden. No reward, motion or world state. */
export function createLivingChoiceMarker() {
  const marker = new Group(); marker.name = "living-choice-marker"; marker.visible = false;
  marker.position.set(-2.9, 0, 0.45); marker.rotation.x = -0.22;
  const stone = new MeshStandardMaterial({ color: "#d0c5a8", roughness: 0.9 });
  const face = new MeshStandardMaterial({ color: "#f5ead4", roughness: 0.9 });
  const foot = new Mesh(new CylinderGeometry(0.32, 0.38, 0.1, 32), stone);
  foot.position.y = 0.07; marker.add(foot);
  const disc = new Mesh(new CylinderGeometry(0.29, 0.29, 0.13, 40), stone);
  disc.rotation.x = Math.PI / 2; disc.position.set(0, 0.36, 0); marker.add(disc);
  const inset = new Mesh(new CylinderGeometry(0.235, 0.235, 0.016, 40), face);
  inset.name = "keepsake-face";
  inset.rotation.x = Math.PI / 2; inset.position.set(0, 0.36, 0.075); marker.add(inset);
  const motifs = [
    { id: "plaza-ribbon-v1", color: keepsakeMedia["plaza-ribbon-v1"].accent, paths: [[[-0.13, -0.12], [0.08, -0.07], [0, 0], [-0.08, 0.07], [0.13, 0.12]]] },
    { id: "quiet-moon-v1", color: keepsakeMedia["quiet-moon-v1"].accent, paths: [[[0.04, 0.15], [-0.13, 0.1], [-0.15, -0.06], [-0.03, -0.15], [0.13, -0.07], [0.01, -0.05], [-0.05, 0.05], [0.04, 0.15]]] },
    { id: "garden-leaf-v1", color: keepsakeMedia["garden-leaf-v1"].accent, paths: [[[-0.13, -0.1], [-0.13, 0.06], [0, 0.13], [0.13, 0.13], [0.12, -0.03], [0, -0.1], [-0.13, -0.1]], [[-0.13, -0.1], [0.02, 0.04], [0.07, 0.08]]] },
  ];
  for (const motif of motifs) {
    const detail = new Group(); detail.name = `choice-detail:${motif.id}`; detail.visible = false;
    const accent = new MeshStandardMaterial({ color: motif.color, roughness: 0.9 });
    for (const path of motif.paths) {
      const curve = new CatmullRomCurve3(path.map(([x, y]) => new Vector3(x, y + 0.36, 0.095)));
      detail.add(new Mesh(new TubeGeometry(curve, 32, 0.018, 8, false), accent));
    }
    marker.add(detail);
  }
  return marker;
}
