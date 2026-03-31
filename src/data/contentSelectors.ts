import { EVENT_CATALOG } from './events';
import { ROUTES } from './routes';
import { UPGRADE_CATALOG } from './upgrades';
import type {
  ContentEffect,
  ContentSelectionProfile,
  EventDefinition,
  EventOption,
  RouteId,
  RouteReference,
  RunState,
  UpgradeDefinition,
} from '../game/types';

interface ContentContext {
  round: number;
  dominantRoute: RouteId | null;
  committedRoute: RouteId | null;
  maturedRoute: RouteId | null;
  isFinalPrep: boolean;
  selectedUpgradeIds: string[];
}

function pickWeightedUnique<T extends { id: string }>(
  entries: Array<{
    item: T;
    weight: number;
  }>,
  count: number,
): T[] {
  const pool = entries
    .filter((entry) => entry.weight > 0)
    .map((entry) => ({
      ...entry,
    }));
  const picks: T[] = [];

  while (pool.length > 0 && picks.length < count) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let index = 0; index < pool.length; index += 1) {
      roll -= pool[index].weight;
      if (roll <= 0) {
        selectedIndex = index;
        break;
      }
    }

    picks.push(pool[selectedIndex].item);
    pool.splice(selectedIndex, 1);
  }

  return picks;
}

function getSelectionWeight(
  profile: ContentSelectionProfile | undefined,
  routeId: RouteId | undefined,
  context: ContentContext,
): number {
  const rule = profile ?? {};
  if (rule.minRound && context.round < rule.minRound) {
    return 0;
  }
  if (rule.maxRound && context.round > rule.maxRound) {
    return 0;
  }
  if (rule.excludeFromFinalPrep && context.isFinalPrep) {
    return 0;
  }

  let weight = rule.baseWeight ?? 1;

  if (!context.dominantRoute) {
    weight += rule.noDominantRouteBonus ?? 0;
  }

  if (context.isFinalPrep) {
    weight += rule.finalPrepBonus ?? 0;
  }

  if (routeId && context.dominantRoute) {
    if (routeId === context.dominantRoute) {
      weight += rule.dominantRouteBonus ?? 0;
    } else {
      weight *= rule.offRouteMultiplier ?? 1;
    }
  }

  if (routeId && context.committedRoute === routeId) {
    weight += rule.committedRouteBonus ?? 0;
  }

  if (routeId && context.maturedRoute === routeId) {
    weight += rule.maturedRouteBonus ?? 0;
  }

  return Math.max(0, weight);
}

function buildContentContext(state: Readonly<RunState>, isFinalPrep: boolean): ContentContext {
  const dominantRoute = (Object.entries(state.routeCounts) as Array<[RouteId, number]>)
    .sort((left, right) => right[1] - left[1])[0];

  return {
    round: Math.max(1, state.round),
    dominantRoute: dominantRoute && dominantRoute[1] > 0 ? dominantRoute[0] : null,
    committedRoute: state.committedRoute,
    maturedRoute: state.maturedRoute,
    isFinalPrep,
    selectedUpgradeIds: state.selectedUpgrades,
  };
}

function selectStarterSet(context: ContentContext): UpgradeDefinition[] {
  return ROUTES.map((route) =>
    pickWeightedUnique(
      UPGRADE_CATALOG.filter(
        (upgrade) =>
          upgrade.routeId === route.id &&
          upgrade.tags?.includes('starter') &&
          !context.selectedUpgradeIds.includes(upgrade.id),
      ).map((upgrade) => ({
        item: upgrade,
        weight: getSelectionWeight(upgrade.selection, upgrade.routeId, context),
      })),
      1,
    )[0],
  ).filter(Boolean) as UpgradeDefinition[];
}

export function rollUpgradeChoices(state: Readonly<RunState>, isFinalPrep: boolean): UpgradeDefinition[] {
  const context = buildContentContext(state, isFinalPrep);
  if (!context.dominantRoute) {
    return selectStarterSet(context).slice(0, 3);
  }

  const weightedPool = UPGRADE_CATALOG.filter((upgrade) => !context.selectedUpgradeIds.includes(upgrade.id)).map(
    (upgrade) => ({
      item: upgrade,
      weight: getSelectionWeight(upgrade.selection, upgrade.routeId, context),
    }),
  );

  const choices = pickWeightedUnique(weightedPool, 3);
  if (choices.length === 3) {
    return choices;
  }

  const fallbackPool = UPGRADE_CATALOG.filter((upgrade) => !context.selectedUpgradeIds.includes(upgrade.id)).map(
    (upgrade) => ({
      item: upgrade,
      weight: 1,
    }),
  );
  const fallback = pickWeightedUnique(
    fallbackPool.filter((entry) => !choices.some((choice) => choice.id === entry.item.id)),
    3 - choices.length,
  );
  return [...choices, ...fallback];
}

function resolveRouteReference(routeRef: RouteReference | undefined, dominantRoute: RouteId | null): RouteId | undefined {
  if (!routeRef) {
    return undefined;
  }
  if (routeRef === 'dominant') {
    return dominantRoute ?? undefined;
  }
  return routeRef;
}

function resolveEffects(effects: ContentEffect[] | undefined, dominantRoute: RouteId | null): ContentEffect[] {
  if (!effects) {
    return [];
  }
  return effects.flatMap((effect) => {
    if (effect.type !== 'route') {
      return effect;
    }
    const resolvedRoute = resolveRouteReference(effect.routeId, dominantRoute);
    if (!resolvedRoute) {
      return [];
    }
    return {
      type: 'route',
      routeId: resolvedRoute,
    };
  });
}

function resolveEventDefinition(eventDef: EventDefinition, dominantRoute: RouteId | null): EventDefinition {
  return {
    ...eventDef,
    options: eventDef.options.map(
      (option): EventOption => ({
        ...option,
        routeId: resolveRouteReference(option.routeId, dominantRoute),
        effects: resolveEffects(option.effects, dominantRoute),
      }),
    ),
  };
}

export function rollEventDefinition(state: Readonly<RunState>): EventDefinition {
  const context = buildContentContext(state, false);
  const weightedEvents = EVENT_CATALOG.map((eventDef) => ({
    item: eventDef,
    weight: getSelectionWeight(eventDef.selection, undefined, context),
  }));
  const selected = pickWeightedUnique(weightedEvents, 1)[0] ?? EVENT_CATALOG[0];
  return resolveEventDefinition(selected, context.dominantRoute);
}
