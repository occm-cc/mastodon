import type { AxiosResponse } from 'axios';

import api, { apiRequestDelete, apiRequestGet, getLinks } from '../api';
import type { ApiScheduledStatusJSON } from '../api_types/scheduled_statuses';

export const apiGetScheduledStatus = (id: string) =>
  apiRequestGet<ApiScheduledStatusJSON>(`v2/scheduled_statuses/${id}`);

export const apiDeleteScheduledStatus = (id: string) =>
  apiRequestDelete(`v2/scheduled_statuses/${id}`);

export async function apiGetScheduledStatuses(signal: AbortSignal) {
  // Capture one account's authorization for every page of this request.
  const client = api();
  const items = new Map<string, ApiScheduledStatusJSON>();
  let url: string | undefined = '/api/v2/scheduled_statuses?limit=40';
  const visited = new Set<string>();

  while (url && !visited.has(url)) {
    visited.add(url);
    const response: AxiosResponse<ApiScheduledStatusJSON[]> = await client.get<
      ApiScheduledStatusJSON[]
    >(url, {
      signal,
    });
    for (const item of response.data) items.set(item.id, item);
    url = getLinks(response).refs.find((link) => link.rel === 'next')?.uri;
  }

  return [...items.values()].sort(
    (a, b) =>
      Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at) ||
      a.id.localeCompare(b.id, undefined, { numeric: true }),
  );
}
