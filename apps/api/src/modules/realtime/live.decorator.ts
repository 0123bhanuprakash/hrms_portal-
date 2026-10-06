import { SetMetadata } from '@nestjs/common';
import type { LiveArea } from './realtime.service';

export const LIVE_AREA_KEY = 'live:area';
export const LIVE_ACCESS_KEY = 'live:access';

/** Who hears about a change: people who watch the area (see AREA_VIEW), or the whole company. */
export type LiveAudience = 'watchers' | 'company';
export interface LiveAreaMeta {
  area: LiveArea;
  to: LiveAudience;
}

/**
 * Every successful change (POST / PUT / PATCH / DELETE) under this controller
 * or handler tells the audience — and the person who made it — to reload.
 * A handler-level @Live overrides the controller's; @NoLive turns it off.
 */
export const Live = (area: LiveArea, to: LiveAudience = 'watchers') => SetMetadata(LIVE_AREA_KEY, { area, to } satisfies LiveAreaMeta);

/** This handler's changes are not pushed (e.g. a POST that only previews). */
export const NoLive = () => SetMetadata(LIVE_AREA_KEY, null);

/**
 * Successful changes here can change what people may do. Who is refreshed:
 *   'user'    — the person in the :userId or :id param (else the caller's company)
 *   'company' — the company in the :id param (:userId, when present, wins)
 *   'caller'  — the caller's whole company (e.g. a role edit reaches everyone holding it)
 */
export type LiveAccessScope = 'user' | 'company' | 'caller';
export const LiveAccess = (scope: LiveAccessScope = 'user') => SetMetadata(LIVE_ACCESS_KEY, scope);
