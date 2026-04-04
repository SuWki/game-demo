import { getUpgradeRarityWeights } from './balance';
import { EVENT_CATALOG } from './events';
import { ROUTES } from './routes';
import { buildUpgradeChoice, UPGRADE_ARCHETYPES } from './upgrades';
import type {
  ContentEffect,
  ContentSelectionProfile,
  EventDefinition,
  EventOption,
  PhaseId,
  RouteId,
  RouteReference,
  RunState,
  UpgradeArchetype,
  UpgradeDefinition,
  UpgradeRarity,
  UpgradeSource,
} from '../game/types';

interface ContentContext {
  round: number;
  level: number;
  phase: PhaseId;
  dominantRoute: RouteId | null;
  committedRoute: RouteId | null;
  maturedRoute: RouteId | null;
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

function pickWeightedOne<T>(entries: Array<{ item: T; weight: number }>): T {
  const filtered = entries.filter((entry) => entry.weight > 0);
  const totalWeight = filtered.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of filtered) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.item;
    }
  }
  return filtered[filtered.length - 1].item;
}

function getSelectionWeight(
  profile: ContentSelectionProfile | undefined,
  routeId: RouteId | undefined,
  context: ContentContext,
  source: UpgradeSource,
): number {
  const rule = profile ?? {};
  if (rule.minRound && context.round < rule.minRound) {
    return 0;
  }
  if (rule.maxRound && context.round > rule.maxRound) {
    return 0;
  }
  if (rule.excludeFromFinalPrep && source === 'nodePrep') {
    return 0;
  }

  let weight = rule.baseWeight ?? 1;

  if (rule.phaseBonuses?.[context.phase]) {
    weight += rule.phaseBonuses[context.phase] ?? 0;
  }

  if (!context.dominantRoute) {
    weight += rule.noDominantRouteBonus ?? 0;
  }

  if (source === 'nodePrep') {
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

function buildContentContext(state: Readonly<RunState>): ContentContext {
  const dominantRoute = (Object.entries(state.routeCounts) as Array<[RouteId, number]>)
    .sort((left, right) => right[1] - left[1])[0];

  return {
    round: Math.max(1, state.round || 1),
    level: state.level,
    phase: state.phase,
    dominantRoute: dominantRoute && dominantRoute[1] > 0 ? dominantRoute[0] : null,
    committedRoute: state.committedRoute,
    maturedRoute: state.maturedRoute,
    selectedUpgradeIds: state.selectedUpgrades,
  };
}

function canOfferUpgrade(archetype: UpgradeArchetype, context: ContentContext): boolean {
  return archetype.repeatable || !context.selectedUpgradeIds.includes(archetype.id);
}

function buildWeightedUpgradePool(
  context: ContentContext,
  source: UpgradeSource,
  predicate: (archetype: UpgradeArchetype) => boolean,
): Array<{ item: UpgradeArchetype; weight: number }> {
  return UPGRADE_ARCHETYPES.filter((archetype) => canOfferUpgrade(archetype, context) && predicate(archetype)).map((archetype) => ({
    item: archetype,
    weight: getSelectionWeight(archetype.selection, archetype.routeId, context, source),
  }));
}

function appendUniquePicks<T extends { id: string }>(
  picks: T[],
  entries: Array<{ item: T; weight: number }>,
  count: number,
): void {
  if (count <= 0) {
    return;
  }

  const pickedIds = new Set(picks.map((item) => item.id));
  const next = pickWeightedUnique(
    entries.filter((entry) => !pickedIds.has(entry.item.id)),
    count,
  );
  picks.push(...next);
}

function pickUpgradeRarity(context: ContentContext, source: UpgradeSource): UpgradeRarity {
  const phase = source === 'nodePrep' ? 'finalPrep' : context.phase;
  const weights = getUpgradeRarityWeights(context.round, phase, context.level, source);
  return pickWeightedOne(
    (Object.entries(weights) as Array<[UpgradeRarity, number]>).map(([rarity, weight]) => ({
      item: rarity,
      weight,
    })),
  );
}

function selectStarterSet(context: ContentContext, source: UpgradeSource): UpgradeDefinition[] {
  return ROUTES.map((route) => {
    const starter = pickWeightedUnique(
      UPGRADE_ARCHETYPES.filter(
        (archetype) =>
          archetype.routeId === route.id &&
          archetype.tags?.includes('starter') &&
          canOfferUpgrade(archetype, context),
      ).map((archetype) => ({
        item: archetype,
        weight: getSelectionWeight(archetype.selection, archetype.routeId, context, source),
      })),
      1,
    )[0];

    return starter ? buildUpgradeChoice(starter, pickUpgradeRarity(context, source)) : undefined;
  }).filter(Boolean) as UpgradeDefinition[];
}

export function rollUpgradeChoices(
  state: Readonly<RunState>,
  source: UpgradeSource,
): UpgradeDefinition[] {
  const context = buildContentContext(state);
  if (!context.dominantRoute) {
    return selectStarterSet(context, source).slice(0, 3);
  }

  const picks: UpgradeArchetype[] = [];
  const dominantRoute = context.dominantRoute;
  const dominantRoutePool = buildWeightedUpgradePool(context, source, (archetype) => archetype.routeId === dominantRoute);
  const dominantBridgePool = dominantRoutePool.filter((entry) =>
    entry.item.tags?.some((tag) => tag === 'bridge' || tag === 'payoff' || tag === 'finisher'),
  );
  const dominantStarterPool = dominantRoutePool.filter((entry) => entry.item.tags?.includes('starter'));
  const genericPool = buildWeightedUpgradePool(context, source, (archetype) => !archetype.routeId);
  const offRoutePool = buildWeightedUpgradePool(
    context,
    source,
    (archetype) => Boolean(archetype.routeId) && archetype.routeId !== dominantRoute,
  );
  const allWeightedPool = [...dominantRoutePool, ...genericPool, ...offRoutePool];
  const routeLocked = context.committedRoute === dominantRoute || context.maturedRoute === dominantRoute;

  if (!context.committedRoute && context.round <= 2) {
    appendUniquePicks(picks, dominantStarterPool.length > 0 ? dominantStarterPool : dominantRoutePool, 1);
    appendUniquePicks(picks, genericPool, 1);
    appendUniquePicks(picks, [...dominantRoutePool, ...genericPool, ...offRoutePool], 1);
  } else if (routeLocked || source === 'nodePrep') {
    appendUniquePicks(picks, dominantBridgePool.length > 0 ? dominantBridgePool : dominantRoutePool, 1);
    appendUniquePicks(picks, dominantRoutePool, 1);
    appendUniquePicks(picks, genericPool.length > 0 ? genericPool : offRoutePool, 1);
  } else {
    appendUniquePicks(picks, dominantRoutePool, 1);
    appendUniquePicks(picks, genericPool, 1);
    appendUniquePicks(picks, [...dominantRoutePool, ...genericPool, ...offRoutePool], 1);
  }

  if (picks.length < 3) {
    appendUniquePicks(picks, allWeightedPool, 3 - picks.length);
  }

  if (picks.length < 3) {
    const fallback = pickWeightedUnique(
      UPGRADE_ARCHETYPES.filter(
        (archetype) => canOfferUpgrade(archetype, context) && !picks.some((picked) => picked.id === archetype.id),
      ).map((archetype) => ({
        item: archetype,
        weight: 1,
      })),
      3 - picks.length,
    );
    picks.push(...fallback);
  }

  return picks.map((archetype) => buildUpgradeChoice(archetype, pickUpgradeRarity(context, source)));
}

function getEventRouteAffinity(eventDef: EventDefinition): RouteId | undefined {
  return eventDef.routeAffinity && eventDef.routeAffinity !== 'dominant' ? eventDef.routeAffinity : undefined;
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
  const context = buildContentContext(state);
  const dominantRoute = context.dominantRoute;
  const weightedEvents = EVENT_CATALOG.map((eventDef) => ({
    item: eventDef,
    weight: getSelectionWeight(
      eventDef.selection,
      eventDef.routeAffinity === 'dominant' ? dominantRoute ?? undefined : getEventRouteAffinity(eventDef),
      context,
      'levelUp',
    ),
  }));
  const selected = pickWeightedUnique(weightedEvents, 1)[0] ?? EVENT_CATALOG[0];
  return resolveEventDefinition(selected, dominantRoute);
}
