import { getUpgradeRarityWeights } from './balance';
import { EVENT_CATALOG, getEventCatalogByKind } from './events';
import { ROUTES } from './routes';
import { buildUpgradeChoice, getUpgradePrimaryModifierKey, UPGRADE_ARCHETYPES } from './upgrades';
import type {
  AnomalyClassId,
  ContentEffect,
  EventContentKind,
  ContentTier,
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

const OPENING_EVENT_IDS = new Set([
  'field-maintenance',
  'salvage-bay',
  'early-linecheck',
  'coolant-detour',
  'risky-protocol',
  'cold-start-warp',
]);

const MID_EVENT_IDS = new Set([
  'route-calibration',
  'targeted-telemetry',
  'signal-soften',
  'route-handoff',
  'midline-split',
  'crit-reroute-window',
  'pierce-reroute-window',
  'dash-reroute-window',
  'overload-firecontrol',
  'compressed-cycle',
  'fixed-turret',
  'fixed-turret-protocol',
  'rapid-light-rounds',
  'heavy-buffer-protocol',
]);

const LATE_EVENT_IDS = new Set([
  'closeout-echo',
  'blackbox-bargain',
  'boss-sightline',
  'redline-light-armor',
  'heavy-cannon-overload',
  'pickup-drive-protocol',
  'dash-charge-protocol',
  'crit-lock-protocol',
]);

type RouteShowcaseStage = 'starter' | 'bridge' | 'payoff';

const ROUTE_SHOWCASE_STAGE_IDS: Record<RouteId, Record<RouteShowcaseStage, string[]>> = {
  crit: {
    starter: ['crit-aim'],
    bridge: ['crit-afterglow'],
    payoff: ['crit-embershard'],
  },
  pierce: {
    starter: ['pierce-core'],
    bridge: ['pierce-seamkeep'],
    payoff: ['pierce-riftbloom'],
  },
  dash: {
    starter: ['dash-brush'],
    bridge: ['dash-sidestep-bank'],
    payoff: ['dash-afterimage'],
  },
};

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
  contentTier: ContentTier | undefined,
  context: ContentContext,
  source: UpgradeSource,
  tags?: string[],
): number {
  const rule = profile ?? {};
  if (rule.minRound && context.round < rule.minRound) {
    return 0;
  }
  if (rule.maxRound && context.round > rule.maxRound) {
    return 0;
  }
  if (rule.excludeFromFinalPrep && context.phase === 'finalPrep') {
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
      const routeCommitted = context.committedRoute === routeId || context.maturedRoute === routeId;
      weight += routeCommitted ? (rule.dominantRouteBonus ?? 0) : (rule.hintedRouteBonus ?? 0);
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

  // 展示窗口（1-4轮）：大幅压制 off-route redirect 牌，防止打乱主展示路线
  if (tags && tags.includes('redirect') && context.committedRoute && context.round <= 4) {
    weight *= 0.15;
  }

  const phaseTagBonusMap: Record<PhaseId, Array<{ tag: string; bonus: number }>> = {
    opening: [
      { tag: 'opening', bonus: 0.94 },
      { tag: 'starter', bonus: 0.64 },
    ],
    mid: [
      { tag: 'mid', bonus: 1.04 },
      { tag: 'bridge', bonus: 0.8 },
    ],
    late: [
      { tag: 'late', bonus: 1.26 },
      { tag: 'payoff', bonus: 1.08 },
      { tag: 'finisher', bonus: 0.72 },
    ],
    finalPrep: [
      { tag: 'late', bonus: 1.18 },
      { tag: 'payoff', bonus: 1.38 },
      { tag: 'finisher', bonus: 1.58 },
    ],
    finalBattle: [
      { tag: 'payoff', bonus: 0.58 },
      { tag: 'finisher', bonus: 0.46 },
    ],
    ended: [],
  };

  if (tags && tags.length > 0) {
    for (const entry of phaseTagBonusMap[context.phase]) {
      if (tags.includes(entry.tag)) {
        weight += entry.bonus;
      }
    }
  }

  if (contentTier === 'rare') {
    const rarePhaseMultiplier: Record<PhaseId, number> = {
      opening: 0.01,
      mid: 0.46,
      late: 0.82,
      finalPrep: 1.32,
      finalBattle: 1.24,
      ended: 0,
    };

    let rareMultiplier = rarePhaseMultiplier[context.phase];
    if (source === 'nodePrep') {
      rareMultiplier += 0.16;
    }
    if (!context.dominantRoute) {
      rareMultiplier *= 0.7;
    } else if (!context.committedRoute && !context.maturedRoute) {
      rareMultiplier *= 0.84;
    }
    weight *= rareMultiplier;
  }

  return Math.max(0, weight);
}

function getAnomalyClassMultiplier(anomalyClass: AnomalyClassId | undefined, context: ContentContext): number {
  switch (anomalyClass) {
    case 'distortion':
      return {
        opening: 0.84,
        mid: 1.28,
        late: 1.42,
        finalPrep: 1.18,
        finalBattle: 0,
        ended: 0,
      }[context.phase];
    case 'hybrid':
      return {
        opening: 0.74,
        mid: 1.3,
        late: 1.4,
        finalPrep: 1.12,
        finalBattle: 0,
        ended: 0,
      }[context.phase];
    case 'bossEcho':
      return {
        opening: 0,
        mid: 0.46,
        late: 1.84,
        finalPrep: 1.92,
        finalBattle: 0,
        ended: 0,
      }[context.phase];
    case 'routeWindow':
    default:
      return {
        opening: 0.84,
        mid: 0.96,
        late: 0.66,
        finalPrep: 0.5,
        finalBattle: 0,
        ended: 0,
      }[context.phase];
  }
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
  if (archetype.category === 'route') {
    return !context.selectedUpgradeIds.includes(archetype.id);
  }
  return Boolean(archetype.repeatable) || !context.selectedUpgradeIds.includes(archetype.id);
}

function buildWeightedUpgradePool(
  context: ContentContext,
  source: UpgradeSource,
  predicate: (archetype: UpgradeArchetype) => boolean,
): Array<{ item: UpgradeArchetype; weight: number }> {
  return UPGRADE_ARCHETYPES.filter((archetype) => canOfferUpgrade(archetype, context) && predicate(archetype)).map((archetype) => ({
    item: archetype,
    weight: getSelectionWeight(
      archetype.selection,
      archetype.routeId,
      archetype.contentTier,
      context,
      source,
      archetype.tags,
    ),
  }));
}

function getRouteShowcaseStage(context: ContentContext, source: UpgradeSource): RouteShowcaseStage {
  if (source === 'nodePrep' && context.phase === 'finalPrep') {
    return context.dominantRoute ? 'payoff' : 'starter';
  }

  if (context.phase === 'finalPrep' || context.round >= 4) {
    return context.dominantRoute ? 'payoff' : 'starter';
  }

  if (context.dominantRoute && (context.committedRoute || context.round >= 2)) {
    return 'bridge';
  }

  return 'starter';
}

function buildRouteShowcasePool(
  context: ContentContext,
  source: UpgradeSource,
  stage: RouteShowcaseStage,
  routeId?: RouteId,
): Array<{ item: UpgradeArchetype; weight: number }> {
  const routeIds = routeId ? [routeId] : ROUTES.map((route) => route.id);
  const showcaseIds = new Set(routeIds.flatMap((id) => ROUTE_SHOWCASE_STAGE_IDS[id][stage]));
  return buildWeightedUpgradePool(context, source, (archetype) => Boolean(archetype.routeId) && showcaseIds.has(archetype.id));
}

function hasAnyTag(tags: string[] | undefined, expected: string[]): boolean {
  return expected.some((tag) => tags?.includes(tag));
}

function filterPoolByTags(
  entries: Array<{ item: UpgradeArchetype; weight: number }>,
  expected: string[],
  excluded: string[] = [],
): Array<{ item: UpgradeArchetype; weight: number }> {
  return entries.filter(
    (entry) =>
      hasAnyTag(entry.item.tags, expected) &&
      (excluded.length === 0 || !hasAnyTag(entry.item.tags, excluded)),
  );
}

function scaleWeightedPool<T extends { id: string }>(
  entries: Array<{ item: T; weight: number }>,
  multiplier: number,
  bonus = 0,
): Array<{ item: T; weight: number }> {
  return entries.map((entry) => ({
    item: entry.item,
    weight: entry.weight * multiplier + bonus,
  }));
}

function mergeWeightedPools<T extends { id: string }>(
  ...pools: Array<Array<{ item: T; weight: number }>>
): Array<{ item: T; weight: number }> {
  const merged = new Map<string, { item: T; weight: number }>();

  for (const pool of pools) {
    for (const entry of pool) {
      const existing = merged.get(entry.item.id);
      if (existing) {
        existing.weight += entry.weight;
        continue;
      }
      merged.set(entry.item.id, {
        item: entry.item,
        weight: entry.weight,
      });
    }
  }

  return Array.from(merged.values());
}

function buildGenericPhasePools(
  genericPool: Array<{ item: UpgradeArchetype; weight: number }>,
): Record<'opening' | 'mid' | 'late', Array<{ item: UpgradeArchetype; weight: number }>> {
  return {
    opening: filterPoolByTags(genericPool, ['opening', 'starter'], ['payoff', 'finisher', 'late']),
    mid: filterPoolByTags(genericPool, ['mid', 'bridge'], ['starter', 'payoff', 'finisher']),
    late: filterPoolByTags(genericPool, ['late', 'payoff'], ['starter']),
  };
}

function getPhaseGenericPool(
  genericPhasePools: Record<'opening' | 'mid' | 'late', Array<{ item: UpgradeArchetype; weight: number }>>,
  phase: PhaseId,
): Array<{ item: UpgradeArchetype; weight: number }> {
  if (phase === 'opening') {
    return genericPhasePools.opening;
  }
  if (phase === 'mid') {
    return genericPhasePools.mid;
  }
  return genericPhasePools.late;
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

function limitRouteCardsInUpgradeChoices(
  picks: UpgradeArchetype[],
  genericPool: Array<{ item: UpgradeArchetype; weight: number }>,
  context: ContentContext,
  maxRouteCards = 1,
): void {
  const routeIndices = picks
    .map((p, i) => (p.category === 'route' ? i : -1))
    .filter((i) => i >= 0);
  if (routeIndices.length <= maxRouteCards) {
    return;
  }

  const genericFallback = genericPool.filter(
    (g) => !picks.some((p) => p.id === g.item.id) && canOfferUpgrade(g.item, context),
  );

  for (let i = routeIndices.length - 1; i > 0; i--) {
    const idx = routeIndices[i];
    const fallback = genericFallback.find(
      (g) => !picks.slice(0, idx).some((p) => p.id === g.item.id),
    );
    if (fallback) {
      picks[idx] = fallback.item;
    } else {
      const anyFallback = genericPool.find(
        (g) => !picks.some((p) => p.id === g.item.id) && canOfferUpgrade(g.item, context),
      );
      if (anyFallback) {
        picks[idx] = anyFallback.item;
      } else {
        picks.splice(idx, 1);
      }
    }
  }

  if (picks.length < 3) {
    appendUniquePicks(picks, genericPool, 3 - picks.length);
  }
}

function limitDuplicateGenericPrimaryStats(
  picks: UpgradeArchetype[],
  genericPool: Array<{ item: UpgradeArchetype; weight: number }>,
  context: ContentContext,
): void {
  const seenPrimaryStats = new Set<string>();
  const pickedIds = () => new Set(picks.map((pick) => pick.id));

  for (let index = 0; index < picks.length; index += 1) {
    const pick = picks[index];
    if (pick.category !== 'generic') {
      continue;
    }

    const primaryKey = getUpgradePrimaryModifierKey(pick);
    if (!primaryKey) {
      continue;
    }

    if (!seenPrimaryStats.has(primaryKey)) {
      seenPrimaryStats.add(primaryKey);
      continue;
    }

    const replacement = genericPool.find((entry) => {
      if (pickedIds().has(entry.item.id) || !canOfferUpgrade(entry.item, context)) {
        return false;
      }
      const replacementPrimaryKey = getUpgradePrimaryModifierKey(entry.item);
      return replacementPrimaryKey !== null && !seenPrimaryStats.has(replacementPrimaryKey);
    });

    if (replacement) {
      picks[index] = replacement.item;
      const replacementPrimaryKey = getUpgradePrimaryModifierKey(replacement.item);
      if (replacementPrimaryKey) {
        seenPrimaryStats.add(replacementPrimaryKey);
      }
    } else {
      picks.splice(index, 1);
      index -= 1;
    }
  }

  while (picks.length < 3) {
    const replacement = genericPool.find((entry) => {
      if (pickedIds().has(entry.item.id) || !canOfferUpgrade(entry.item, context)) {
        return false;
      }
      const replacementPrimaryKey = getUpgradePrimaryModifierKey(entry.item);
      return replacementPrimaryKey !== null && !seenPrimaryStats.has(replacementPrimaryKey);
    });

    if (!replacement) {
      break;
    }

    picks.push(replacement.item);
    const replacementPrimaryKey = getUpgradePrimaryModifierKey(replacement.item);
    if (replacementPrimaryKey) {
      seenPrimaryStats.add(replacementPrimaryKey);
    }
  }
}

function stabilizeUpgradeChoicePicks(
  picks: UpgradeArchetype[],
  genericPool: Array<{ item: UpgradeArchetype; weight: number }>,
  context: ContentContext,
  source?: UpgradeSource,
): void {
  // 强化节点(nodePrep)强制3个流派卡，不需要限制流派卡数量
  if (source !== 'nodePrep') {
    limitRouteCardsInUpgradeChoices(picks, genericPool, context, 1);
  }
  limitDuplicateGenericPrimaryStats(picks, genericPool, context);
}

function pickUpgradeRarity(
  context: ContentContext,
  source: UpgradeSource,
  archetype: UpgradeArchetype,
): UpgradeRarity {
  const phase = source === 'nodePrep' ? 'finalPrep' : context.phase;
  const weights = getUpgradeRarityWeights(context.round, phase, context.level, source);
  const rolledRarity = pickWeightedOne(
    (Object.entries(weights) as Array<[UpgradeRarity, number]>).map(([rarity, weight]) => ({
      item: rarity,
      weight,
    })),
  );

  if (archetype.category === 'route' && rolledRarity === 'common') {
    return 'uncommon';
  }

  return rolledRarity;
}

function selectStarterSet(context: ContentContext, source: UpgradeSource): UpgradeDefinition[] {
  return ROUTES.map((route) => {
    const starterPool = buildRouteShowcasePool(context, source, 'starter', route.id);
    const starter = pickWeightedUnique(starterPool, 1)[0];

    return starter ? buildUpgradeChoice(starter, pickUpgradeRarity(context, source, starter)) : undefined;
  }).filter(Boolean) as UpgradeDefinition[];
}

function isFirstUpgradeOffer(context: ContentContext): boolean {
  return context.selectedUpgradeIds.length === 0;
}

function pickEqualRouteStarter(
  context: ContentContext,
  source: UpgradeSource,
): UpgradeArchetype | null {
  const availableRoutes = ROUTES.filter((route) => buildRouteShowcasePool(context, source, 'starter', route.id).length > 0);
  if (availableRoutes.length === 0) {
    return null;
  }

  const pickedRoute = availableRoutes[Math.floor(Math.random() * availableRoutes.length)];
  const starterPool = buildRouteShowcasePool(context, source, 'starter', pickedRoute.id);
  return pickWeightedUnique(starterPool, 1)[0] ?? null;
}

function buildLevelUpRouteWindowPool(
  context: ContentContext,
): Array<{ item: UpgradeArchetype; weight: number }> {
  const stage = getRouteShowcaseStage(context, 'levelUp');
  if (!context.dominantRoute) {
    return scaleWeightedPool(buildRouteShowcasePool(context, 'levelUp', 'starter'), 1.12);
  }

  const dominantPool = buildRouteShowcasePool(context, 'levelUp', stage, context.dominantRoute);
  return scaleWeightedPool(dominantPool, stage === 'payoff' ? 1.12 : stage === 'bridge' ? 1.08 : 1.16);
}

function rollLevelUpChoices(context: ContentContext): UpgradeDefinition[] {
  const openingLevelUp = context.phase === 'opening';
  const earlyMidLevelUp = openingLevelUp || context.phase === 'mid';
  const hasCommittedRoute = Boolean(context.committedRoute || context.maturedRoute);
  const dominantHintedEarlyMid = Boolean(context.dominantRoute) && !hasCommittedRoute && earlyMidLevelUp;
  const firstUpgradeOffer = isFirstUpgradeOffer(context);
  const picks: UpgradeArchetype[] = [];
  const genericPool = buildWeightedUpgradePool(context, 'levelUp', (archetype) => !archetype.routeId);
  const genericPhasePools = buildGenericPhasePools(genericPool);
  const genericPhasePool = getPhaseGenericPool(genericPhasePools, context.phase);
  const genericCorePool = filterPoolByTags(
    genericPhasePool.length > 0 ? genericPhasePool : genericPool,
    ['stabilizer', 'bridge'],
    ['payoff', 'rare'],
  );
  const genericPrimaryPool = genericCorePool.length > 0 ? genericCorePool : genericPhasePool.length > 0 ? genericPhasePool : genericPool;
  const genericSecondaryPool = mergeWeightedPools(
    scaleWeightedPool(genericPrimaryPool, 1.18, 0.08),
    scaleWeightedPool(genericPhasePool.length > 0 ? genericPhasePool : genericPool, 1.08),
  );
  const equalStarter = !context.dominantRoute && openingLevelUp && firstUpgradeOffer
    ? pickEqualRouteStarter(context, 'levelUp')
    : null;
  const routeWindowPool = equalStarter
    ? [{ item: equalStarter, weight: 1 }]
    : buildLevelUpRouteWindowPool(context);
  const flexPool = mergeWeightedPools(
    scaleWeightedPool(
      genericSecondaryPool.length > 0 ? genericSecondaryPool : genericPhasePool.length > 0 ? genericPhasePool : genericPool,
      hasCommittedRoute ? 1.24 : dominantHintedEarlyMid ? 1.18 : openingLevelUp ? 1.24 : earlyMidLevelUp ? 1.28 : 1.28,
      0.1,
    ),
    scaleWeightedPool(
      routeWindowPool,
      hasCommittedRoute ? 0.82 : context.dominantRoute ? (earlyMidLevelUp ? 0.92 : 0.78) : openingLevelUp ? 0.88 : earlyMidLevelUp ? 0.82 : 0.68,
    ),
  );

  if (context.dominantRoute && routeWindowPool.length > 0) {
    appendUniquePicks(picks, routeWindowPool, 1);
    appendUniquePicks(picks, genericSecondaryPool.length > 0 ? genericSecondaryPool : genericPool, 1);
    appendUniquePicks(picks, flexPool.length > 0 ? flexPool : routeWindowPool, 3 - picks.length);
  } else {
    appendUniquePicks(picks, genericPrimaryPool.length > 0 ? genericPrimaryPool : genericPool, 1);
    appendUniquePicks(picks, genericSecondaryPool.length > 0 ? genericSecondaryPool : genericPool, 1);
    appendUniquePicks(picks, flexPool.length > 0 ? flexPool : genericPool, 1);
  }

  if (picks.length < 3) {
    appendUniquePicks(picks, genericPool, 3 - picks.length);
  }

  stabilizeUpgradeChoicePicks(picks, genericPool, context, 'levelUp');

  return picks.map((archetype) => buildUpgradeChoice(archetype, pickUpgradeRarity(context, 'levelUp', archetype)));
}

export function rollUpgradeChoices(
  state: Readonly<RunState>,
  source: UpgradeSource,
): UpgradeDefinition[] {
  const context = buildContentContext(state);
  if (source === 'levelUp') {
    return rollLevelUpChoices(context);
  }

  const picks: UpgradeArchetype[] = [];
  const genericPool = buildWeightedUpgradePool(context, source, (archetype) => !archetype.routeId);
  const genericPhasePools = buildGenericPhasePools(genericPool);
  const genericPhasePool = getPhaseGenericPool(genericPhasePools, context.phase);
  const genericTransitionPool = filterPoolByTags(genericPhasePool.length > 0 ? genericPhasePool : genericPool, ['bridge', 'stabilizer']);
  const genericHybridPool = filterPoolByTags(genericPhasePool.length > 0 ? genericPhasePool : genericPool, ['hybrid', 'redirect'], ['payoff', 'finisher']);
  const genericLatePayoffPool = filterPoolByTags(genericPhasePool.length > 0 ? genericPhasePool : genericPool, ['payoff'], ['starter']);
  const genericLateFlexPool = [...genericLatePayoffPool, ...genericHybridPool, ...genericTransitionPool];
  const dominantRoute = context.dominantRoute;
  const routeShowcaseStage = getRouteShowcaseStage(context, source);
  const firstUpgradeOffer = isFirstUpgradeOffer(context);
  const equalStarter = !context.dominantRoute && context.phase === 'opening' && firstUpgradeOffer
    ? pickEqualRouteStarter(context, source)
    : null;
  const noFocusStarterPool = equalStarter
    ? [{ item: equalStarter, weight: 1 }]
    : buildRouteShowcasePool(context, source, 'starter');
  const noFocusBridgePool: Array<{ item: UpgradeArchetype; weight: number }> = [];
  const noFocusLateRoutePool: Array<{ item: UpgradeArchetype; weight: number }> = [];
  const dominantRoutePool =
    dominantRoute === null
      ? []
      : buildRouteShowcasePool(context, source, routeShowcaseStage, dominantRoute);
  const dominantNonRedirectPool = dominantRoutePool;
  const dominantHintPool = dominantRoute === null ? [] : buildRouteShowcasePool(context, source, 'starter', dominantRoute);
  const dominantBridgePool = dominantRoute === null ? [] : buildRouteShowcasePool(context, source, 'bridge', dominantRoute);
  const dominantStarterPool = dominantRoute === null ? [] : buildRouteShowcasePool(context, source, 'starter', dominantRoute);
  const dominantCommittedPool =
    dominantRoute === null
      ? []
      : buildRouteShowcasePool(
          context,
          source,
          routeShowcaseStage === 'payoff' ? 'payoff' : routeShowcaseStage === 'bridge' ? 'bridge' : 'starter',
          dominantRoute,
        );
  const dominantPayoffPool = dominantRoute === null ? [] : buildRouteShowcasePool(context, source, 'payoff', dominantRoute);
  const offRoutePool = buildWeightedUpgradePool(
    context,
    source,
    (archetype) => Boolean(archetype.routeId) && archetype.routeId !== dominantRoute,
  );
  const offRoutePivotPool = filterPoolByTags(offRoutePool, ['starter', 'bridge'], ['payoff', 'finisher']);
  const offRouteRedirectPool = filterPoolByTags(offRoutePool, ['redirect'], ['payoff', 'finisher']);
  const offRouteBridgePool = filterPoolByTags(offRoutePool, ['bridge'], ['starter', 'payoff', 'finisher']);
  const midRedirectWindowPool = mergeWeightedPools(
    scaleWeightedPool(offRouteRedirectPool, 2.46, 0.14),
    scaleWeightedPool(offRouteBridgePool, 0.72),
    scaleWeightedPool(genericHybridPool, 0.5),
    scaleWeightedPool(genericTransitionPool, 0.6),
  );
  const nodePrepLateFlexPool = mergeWeightedPools(
    scaleWeightedPool(genericLateFlexPool.length > 0 ? genericLateFlexPool : genericPool, 1.08),
    scaleWeightedPool(offRouteRedirectPool, 0.74),
    scaleWeightedPool(genericHybridPool, 0.88),
  );
  const finalPrepGenericPatchPool = filterPoolByTags(
    genericPool,
    ['stabilizer', 'late', 'payoff'],
    ['hybrid', 'redirect', 'starter'],
  );
  const finalPrepGenericAuditPool = mergeWeightedPools(
    scaleWeightedPool(
      finalPrepGenericPatchPool.length > 0
        ? finalPrepGenericPatchPool
        : genericLateFlexPool.length > 0
          ? genericLateFlexPool
          : genericPool,
      1.24,
    ),
    scaleWeightedPool(genericLatePayoffPool.length > 0 ? genericLatePayoffPool : genericPool, 1.18),
  );
  const finalPrepGenericCloseoutPool = mergeWeightedPools(
    scaleWeightedPool(
      finalPrepGenericAuditPool.length > 0
        ? finalPrepGenericAuditPool
        : finalPrepGenericPatchPool.length > 0
          ? finalPrepGenericPatchPool
          : genericLateFlexPool.length > 0
            ? genericLateFlexPool
            : genericPool,
      1.22,
    ),
    scaleWeightedPool(genericLatePayoffPool.length > 0 ? genericLatePayoffPool : genericPool, 1.18),
  );
  const dominantFinalPrepSealPool = dominantPayoffPool;
  const dominantFinalPrepBridgePool = dominantBridgePool;
  const finalPrepRouteSealPool =
    dominantFinalPrepSealPool.length > 0
      ? dominantFinalPrepSealPool
      : dominantPayoffPool.length > 0
        ? dominantPayoffPool
        : dominantFinalPrepBridgePool.length > 0
          ? dominantFinalPrepBridgePool
          : dominantCommittedPool.length > 0
            ? dominantCommittedPool
            : dominantNonRedirectPool;
  const finalPrepDominantFlexPool = mergeWeightedPools(
    scaleWeightedPool(finalPrepRouteSealPool.length > 0 ? finalPrepRouteSealPool : dominantRoutePool, 2.14),
    scaleWeightedPool(finalPrepGenericCloseoutPool.length > 0 ? finalPrepGenericCloseoutPool : genericPool, 0.78),
  );
  const allWeightedPool = [...dominantNonRedirectPool, ...genericPool, ...offRoutePool];
  const routeMatured = context.maturedRoute === dominantRoute;
  const routeCommittedOrMatured = Boolean(context.committedRoute || routeMatured);
  const allowRedirectWindow = context.phase !== 'opening' || context.round >= 2;
  const nodePrepGenericCorePool = genericTransitionPool.length > 0 ? genericTransitionPool : genericPool;
  const nodePrepGenericSupportPool =
    context.phase === 'late' || context.phase === 'finalPrep'
      ? mergeWeightedPools(
          scaleWeightedPool(genericLateFlexPool.length > 0 ? genericLateFlexPool : genericPhasePool.length > 0 ? genericPhasePool : genericPool, 1.24),
          scaleWeightedPool(genericHybridPool.length > 0 ? genericHybridPool : nodePrepGenericCorePool, 0.7),
          scaleWeightedPool(nodePrepGenericCorePool.length > 0 ? nodePrepGenericCorePool : genericPhasePool.length > 0 ? genericPhasePool : genericPool, 0.72),
        )
      : mergeWeightedPools(
          scaleWeightedPool(nodePrepGenericCorePool.length > 0 ? nodePrepGenericCorePool : genericPhasePool.length > 0 ? genericPhasePool : genericPool, 1.14, 0.08),
          scaleWeightedPool(genericHybridPool.length > 0 ? genericHybridPool : genericPhasePool.length > 0 ? genericPhasePool : genericPool, 1.02),
          scaleWeightedPool(genericPhasePool.length > 0 ? genericPhasePool : genericPool, 0.84),
        );

  if (source === 'nodePrep') {
    // 强化节点：强制3个流派（穿梭/暴击/穿透）各选1张卡
    const stage = getRouteShowcaseStage(context, source);
    const stageFallbacks: RouteShowcaseStage[] = stage === 'payoff'
      ? ['payoff', 'bridge', 'starter']
      : stage === 'bridge'
        ? ['bridge', 'starter', 'payoff']
        : ['starter', 'bridge', 'payoff'];

    for (const route of ROUTES) {
      let routePool: Array<{ item: UpgradeArchetype; weight: number }> = [];
      for (const fallbackStage of stageFallbacks) {
        routePool = buildRouteShowcasePool(context, source, fallbackStage, route.id);
        if (routePool.length > 0) break;
      }
      if (routePool.length > 0) {
        appendUniquePicks(picks, routePool, 1);
      }
    }

    // 如果某个流派池为空导致不足3张，用通用卡补齐
    if (picks.length < 3) {
      appendUniquePicks(picks, genericPool, 3 - picks.length);
    }

    stabilizeUpgradeChoicePicks(picks, genericPool, context, source);

    return picks.map((archetype) => buildUpgradeChoice(archetype, pickUpgradeRarity(context, source, archetype)));
  }

  if (!context.dominantRoute) {
    return selectStarterSet(context, source).slice(0, 3);
  }

  if (!context.committedRoute && context.round <= 2) {
    appendUniquePicks(
      picks,
      context.round >= 2 && dominantBridgePool.length > 0
        ? dominantBridgePool
        : dominantHintPool.length > 0
          ? dominantHintPool
          : dominantStarterPool.length > 0
            ? dominantStarterPool
            : dominantRoutePool,
      1,
    );
    appendUniquePicks(picks, genericTransitionPool.length > 0 ? genericTransitionPool : genericPool, 1);
    appendUniquePicks(
      picks,
      allowRedirectWindow && midRedirectWindowPool.length > 0
        ? midRedirectWindowPool
        : genericHybridPool.length > 0
          ? genericHybridPool
          : offRouteRedirectPool.length > 0
            ? offRouteRedirectPool
            : offRouteBridgePool.length > 0
              ? offRouteBridgePool
              : offRoutePivotPool.length > 0
                ? offRoutePivotPool
                : genericTransitionPool.length > 0
                  ? genericTransitionPool
                  : [...genericPool, ...offRoutePool],
      1,
    );
  } else if (source === 'nodePrep' || routeMatured) {
    appendUniquePicks(
      picks,
      dominantPayoffPool.length > 0
        ? dominantPayoffPool
        : dominantCommittedPool.length > 0
          ? dominantCommittedPool
          : dominantRoutePool,
      1,
    );
    appendUniquePicks(
      picks,
      dominantCommittedPool.length > 0 ? dominantCommittedPool : dominantRoutePool,
      1,
    );
    appendUniquePicks(
      picks,
      nodePrepLateFlexPool.length > 0
        ? nodePrepLateFlexPool
        : genericLateFlexPool.length > 0
          ? genericLateFlexPool
          : offRouteRedirectPool.length > 0
            ? offRouteRedirectPool
            : genericPool.length > 0
              ? genericPool
              : offRoutePivotPool,
      1,
    );
  } else if (context.committedRoute && context.round >= 3) {
    appendUniquePicks(
      picks,
      dominantPayoffPool.length > 0
        ? dominantPayoffPool
        : dominantCommittedPool.length > 0
          ? dominantCommittedPool
          : dominantRoutePool,
      1,
    );
    appendUniquePicks(
      picks,
      dominantCommittedPool.length > 0 ? dominantCommittedPool : dominantRoutePool,
      1,
    );
    appendUniquePicks(
      picks,
      genericLateFlexPool.length > 0
        ? genericLateFlexPool
        : offRouteRedirectPool.length > 0
          ? offRouteRedirectPool
          : genericPool.length > 0
            ? genericPool
            : offRoutePivotPool,
      1,
    );
  } else {
    appendUniquePicks(
      picks,
      dominantCommittedPool.length > 0 ? dominantCommittedPool : dominantHintPool.length > 0 ? dominantHintPool : dominantRoutePool,
      1,
    );
    appendUniquePicks(
      picks,
      genericHybridPool.length > 0
        ? genericHybridPool
        : genericTransitionPool.length > 0
          ? genericTransitionPool
          : genericPool,
      1,
    );
    appendUniquePicks(
      picks,
      midRedirectWindowPool.length > 0
        ? midRedirectWindowPool
        : genericHybridPool.length > 0
          ? genericHybridPool
          : offRouteBridgePool.length > 0
            ? offRouteBridgePool
            : genericTransitionPool.length > 0
              ? genericTransitionPool
              : genericPool.length > 0
                ? genericPool
                : [...dominantHintPool, ...dominantRoutePool],
      1,
    );
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

  stabilizeUpgradeChoicePicks(picks, genericPool, context, source);

  return picks.map((archetype) => buildUpgradeChoice(archetype, pickUpgradeRarity(context, source, archetype)));
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

function getPhaseEventIdSet(phase: PhaseId): Set<string> {
  switch (phase) {
    case 'opening':
      return OPENING_EVENT_IDS;
    case 'mid':
      return MID_EVENT_IDS;
    case 'late':
    case 'finalPrep':
      return LATE_EVENT_IDS;
    default:
      return new Set<string>();
  }
}

function filterCatalogByIds(catalog: EventDefinition[], ids: Set<string>): EventDefinition[] {
  if (ids.size === 0) {
    return catalog;
  }
  const filtered = catalog.filter((eventDef) => ids.has(eventDef.id));
  return filtered.length > 0 ? filtered : catalog;
}

function buildPhaseEventCatalog(
  catalog: EventDefinition[],
  context: ContentContext,
  contentKind: EventContentKind,
): EventDefinition[] {
  let phaseCatalog = filterCatalogByIds(catalog, getPhaseEventIdSet(context.phase));

  if (context.phase === 'mid' && !context.dominantRoute) {
    phaseCatalog = [
      ...phaseCatalog,
      ...catalog.filter((eventDef) => OPENING_EVENT_IDS.has(eventDef.id) && !phaseCatalog.some((entry) => entry.id === eventDef.id)),
    ];
  }

  if ((context.phase === 'late' || context.phase === 'finalPrep') && !context.committedRoute && !context.maturedRoute) {
    phaseCatalog = [
      ...phaseCatalog,
      ...catalog.filter((eventDef) => MID_EVENT_IDS.has(eventDef.id) && !phaseCatalog.some((entry) => entry.id === eventDef.id)),
    ];
  }

  if (context.phase === 'finalPrep') {
    const closeoutOnly = phaseCatalog.filter(
      (eventDef) =>
        eventDef.anomalyClass === 'bossEcho' ||
        eventDef.routeAffinity === 'dominant' ||
        eventDef.selection?.minRound === undefined ||
        (eventDef.selection?.minRound ?? 0) >= 3,
    );
    if (closeoutOnly.length > 0) {
      phaseCatalog = closeoutOnly;
    }
  }

  if (contentKind === 'event') {
    const eventOnly = phaseCatalog.filter((eventDef) => (eventDef.contentKind ?? 'event') === 'event');
    return eventOnly.length > 0 ? eventOnly : phaseCatalog;
  }

  return phaseCatalog;
}

export function rollEventDefinition(
  state: Readonly<RunState>,
  contentKind: EventContentKind = 'event',
): EventDefinition {
  const context = buildContentContext(state);
  const dominantRoute = context.dominantRoute;
  const catalog = buildPhaseEventCatalog(getEventCatalogByKind(contentKind), context, contentKind);
  const weightedEvents = catalog.map((eventDef) => ({
    item: eventDef,
    weight:
      getSelectionWeight(
        eventDef.selection,
        eventDef.routeAffinity === 'dominant' ? dominantRoute ?? undefined : getEventRouteAffinity(eventDef),
        eventDef.contentTier,
        context,
        'levelUp',
      ) *
      (contentKind === 'anomaly' ? getAnomalyClassMultiplier(eventDef.anomalyClass, context) : 1),
  }));
  const selected = pickWeightedUnique(weightedEvents, 1)[0] ?? catalog[0] ?? EVENT_CATALOG[0];
  return resolveEventDefinition(selected, dominantRoute);
}
