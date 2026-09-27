export const WORLD_DESTINATION_PROXIMITY_EVENT = "sk7:world-destination-proximity";

export type WorldDestinationProximityDetail = Readonly<{
  destinationId: string;
  near: boolean;
}>;

export function worldDestinationProximityEvent(
  destinationId: string,
  near: boolean,
): CustomEvent<WorldDestinationProximityDetail> {
  return new CustomEvent<WorldDestinationProximityDetail>(
    WORLD_DESTINATION_PROXIMITY_EVENT,
    {
      bubbles: true,
      detail: Object.freeze({ destinationId, near }),
    },
  );
}
