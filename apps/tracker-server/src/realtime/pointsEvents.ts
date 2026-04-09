import { EventEmitter } from "node:events";

type TeamPointsStreamEvent = {
  event: "team-points";
  data: {
    time: string;
    items: Array<{
      teamId: string;
      points: number;
    }>;
  };
};

type UserPointsStreamEvent = {
  event: "user-points";
  data: {
    time: string;
    items: Array<{
      userId: string;
      points: number;
    }>;
  };
};

type UserActivityPointsStreamEvent = {
  event: "user-activity-points";
  data: {
    time: string;
    items: Array<{
      userId: string;
      activityId: string;
      value: number;
      points: number;
    }>;
  };
};

type UserActivityVisibilityStreamEvent = {
  event: "user-activity-visibility";
  data: {
    time: string;
    items: Array<{
      userId: string;
      isActivityPublic: boolean;
    }>;
  };
};

export type PointsStreamEvent =
  | TeamPointsStreamEvent
  | UserPointsStreamEvent
  | UserActivityPointsStreamEvent
  | UserActivityVisibilityStreamEvent;

type PointsStreamListener = (event: PointsStreamEvent) => void;

const POINTS_EVENT_NAME = "points-event";
const pointsEventEmitter = new EventEmitter();

pointsEventEmitter.setMaxListeners(0);

export function emitPointsStreamEvent(event: PointsStreamEvent): void {
  pointsEventEmitter.emit(POINTS_EVENT_NAME, event);
}

export function subscribeToPointsStream(
  listener: PointsStreamListener
): () => void {
  pointsEventEmitter.on(POINTS_EVENT_NAME, listener);

  return () => {
    pointsEventEmitter.off(POINTS_EVENT_NAME, listener);
  };
}
