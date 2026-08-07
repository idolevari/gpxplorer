import type { ActivityType } from './db-types';

export function activityLabel(a: ActivityType): string {
  const labels: Record<ActivityType, string> = {
    cycling: 'Cycling', hiking: 'Hiking', running: 'Running',
    campervan: 'Campervan', motorcycle: 'Motorcycle', other: 'Trip',
  };
  return labels[a];
}
