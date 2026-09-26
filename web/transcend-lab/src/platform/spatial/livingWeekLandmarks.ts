import { worldPoint, type WorldPoint3 } from "./worldSpaceClock";

export const LIVING_WEEK_BOUND_METRES = 4;

export const LIVING_WEEK_DAYS = Object.freeze([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const);

export type LivingWeekDay = (typeof LIVING_WEEK_DAYS)[number];

export type LivingWeekLandmark = Readonly<{
  id: `weekday:${LivingWeekDay}`;
  day: LivingWeekDay;
  ordinal: number;
  label: string;
  position: WorldPoint3;
}>;

export type LivingWeekConnection = Readonly<{
  from: LivingWeekLandmark["id"];
  to: LivingWeekLandmark["id"];
}>;

const LANDMARK_SEEDS = Object.freeze([
  ["monday", "Monday", -3, -2.5],
  ["tuesday", "Tuesday", 0, -3],
  ["wednesday", "Wednesday", 3, -2],
  ["thursday", "Thursday", 3.5, 1],
  ["friday", "Friday", 1.5, 3],
  ["saturday", "Saturday", -1.5, 3],
  ["sunday", "Sunday", -3.5, 1],
] as const);

export const LIVING_WEEK_LANDMARKS: readonly LivingWeekLandmark[] =
  Object.freeze(
    LANDMARK_SEEDS.map(([day, label, x, z], ordinal) =>
      Object.freeze({
        id: `weekday:${day}` as const,
        day,
        ordinal,
        label,
        position: worldPoint(x, 0, z),
      }),
    ),
  );

export const LIVING_WEEK_CONNECTIONS: readonly LivingWeekConnection[] =
  Object.freeze(
    LIVING_WEEK_LANDMARKS.slice(0, -1).map((landmark, index) =>
      Object.freeze({
        from: landmark.id,
        to: LIVING_WEEK_LANDMARKS[index + 1].id,
      }),
    ),
  );
