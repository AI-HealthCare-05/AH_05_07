import {
  LIVING_WEEK_CONNECTIONS,
  LIVING_WEEK_LANDMARKS,
  type LivingWeekConnection,
  type LivingWeekLandmark,
} from "./livingWeekLandmarks";
import type { WorldPoint3 } from "./worldSpaceClock";

export type LivingWeekMarkerDescriptor = Readonly<{
  id: LivingWeekLandmark["id"];
  label: string;
  ordinal: number;
  position: WorldPoint3;
}>;

export type LivingWeekSegmentDescriptor = Readonly<{
  id: `edge:${LivingWeekConnection["from"]}->${LivingWeekConnection["to"]}`;
  from: LivingWeekConnection["from"];
  to: LivingWeekConnection["to"];
  start: WorldPoint3;
  end: WorldPoint3;
  lengthMetres: number;
}>;

const LANDMARK_BY_ID = new Map(
  LIVING_WEEK_LANDMARKS.map((landmark) => [landmark.id, landmark] as const),
);

export function livingWeekMarkers(): readonly LivingWeekMarkerDescriptor[] {
  return Object.freeze(LIVING_WEEK_LANDMARKS.map((landmark) => Object.freeze({
    id: landmark.id,
    label: landmark.label,
    ordinal: landmark.ordinal,
    position: landmark.position,
  })));
}

export function livingWeekSegments(): readonly LivingWeekSegmentDescriptor[] {
  return Object.freeze(LIVING_WEEK_CONNECTIONS.map((connection) => {
    const from = LANDMARK_BY_ID.get(connection.from);
    const to = LANDMARK_BY_ID.get(connection.to);
    if (!from || !to) throw new Error("Living Week connection references an unknown landmark");
    return Object.freeze({
      id: `edge:${connection.from}->${connection.to}` as const,
      from: connection.from,
      to: connection.to,
      start: from.position,
      end: to.position,
      lengthMetres: Math.hypot(to.position.x - from.position.x, to.position.z - from.position.z),
    });
  }));
}
