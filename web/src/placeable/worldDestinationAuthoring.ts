import { Group } from "three";

export type PlazaDestinationAuthoringRole = "semantic" | "utility";
export type PlazaDestinationGrounding = "plaza-floor";
export type PlazaDestinationCompactPolicy = "retain";
export type PlazaDestinationSemanticFallback = "parent-semantic-control";
export type PlazaDestinationWayfindingRole = "destination" | "utility";

export type PlazaDestinationAuthoring = Readonly<{
  id: string;
  label: string;
  role: PlazaDestinationAuthoringRole;
  rootName: string;
  x: number;
  z: number;
  labelY: number;
  grounding: PlazaDestinationGrounding;
  compact: PlazaDestinationCompactPolicy;
  cameraObstacle: true;
  semanticFallback: PlazaDestinationSemanticFallback;
}>;

export type PlazaDestinationLabelDescriptor = Readonly<{
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  wayfindingRole: PlazaDestinationWayfindingRole;
}>;

export type PlazaDestinationUnit = Readonly<{
  spec: PlazaDestinationAuthoring;
  root: Group;
  landmark: Group;
  setAvailable: (available: boolean) => boolean;
  labelDescriptor: () => PlazaDestinationLabelDescriptor | null;
  obstacleRoot: () => Group | null;
}>;

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function definePlazaDestination(
  candidate: PlazaDestinationAuthoring,
): PlazaDestinationAuthoring {
  if (!nonBlank(candidate.id) || !nonBlank(candidate.label) || !nonBlank(candidate.rootName)) {
    throw new Error("Plaza destination authoring requires non-empty id, label and rootName");
  }
  if (![candidate.x, candidate.z, candidate.labelY].every(Number.isFinite)) {
    throw new Error("Plaza destination authoring requires finite x, z and labelY");
  }
  if (candidate.role !== "semantic" && candidate.role !== "utility") {
    throw new Error("Plaza destination authoring has an unsupported role");
  }
  if (candidate.grounding !== "plaza-floor"
    || candidate.compact !== "retain"
    || candidate.cameraObstacle !== true
    || candidate.semanticFallback !== "parent-semantic-control") {
    throw new Error("Plaza destination authoring has an unsupported envelope");
  }
  return Object.freeze({ ...candidate });
}

export function authorPlazaDestination(
  spec: PlazaDestinationAuthoring,
  buildLandmark: (landmark: Group) => void,
): PlazaDestinationUnit {
  const authoring = definePlazaDestination(spec);
  if (typeof buildLandmark !== "function") {
    throw new Error("Plaza destination authoring requires a landmark builder");
  }

  const root = new Group();
  root.name = authoring.rootName;
  const landmark = new Group();
  landmark.name = authoring.id;
  landmark.position.set(authoring.x, 0, authoring.z);
  buildLandmark(landmark);
  if (landmark.children.length === 0) {
    throw new Error(`Plaza destination ${authoring.id} must author visible landmark geometry`);
  }
  root.add(landmark);

  return Object.freeze({
    spec: authoring,
    root,
    landmark,
    setAvailable(available: boolean) {
      if (root.visible === available) return false;
      root.visible = available;
      return true;
    },
    labelDescriptor() {
      if (!root.visible) return null;
      return {
        id: authoring.id,
        label: authoring.label,
        x: authoring.x,
        y: authoring.labelY,
        z: authoring.z,
        wayfindingRole: authoring.role === "semantic" ? "destination" : "utility",
      };
    },
    obstacleRoot() {
      return root.visible && authoring.cameraObstacle ? root : null;
    },
  });
}
