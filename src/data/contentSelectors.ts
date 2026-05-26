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

  if (contentTier === 'rare') {
    const rarePhaseMultiplier: Record<PhaseId, number> = {
      opening: 0.02,
      mid: 0.38,
      late: 0.48,
      finalPrep: 0.92,
      finalBattle: 1.08,
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
        mid: 1.22,
        late: 1.34,
        finalPrep: 1.14,
        finalBattle: 0,
        ended: 0,
      }[context.phase];
    case 'hybrid':
      return {
        opening: 0.74,
        mid: 1.24,
        late: 1.32,
        finalPrep: 1.08,
        finalBattle: 0,
        ended: 0,
      }[context.phase];
    case 'bossEcho':
      return {
        opening: 0,
        mid: 0.46,
        late: 1.66,
        finalPrep: 1.78,
        finalBattle: 0,
        ended: 0,
      }[context.phase];
    case 'routeWindow':
    default:
      return {
        opening: 0.94,
        mid: 0.78,
        late: 0.58,
        finalPrep: 0.42,
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
    weight: getSelectionWeight(archetype.selection, archetype.routeId, archetype.contentTier, context, source),
  }));
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
): void {
  limitRouteCardsInUpgradeChoices(picks, genericPool, context, 1);
  limitDuplicateGenericPrimaryStats(picks, genericPool, context);
  limitRouteCardsInUpgradeChoices(picks, genericPool, context, 1);
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
    const starter = pickWeightedUnique(
      UPGRADE_ARCHETYPES.filter(
        (archetype) =>
          archetype.routeId === route.id &&
          archetype.tags?.includes('starter') &&
          canOfferUpgrade(archetype, context),
      ).map((archetype) => ({
        item: archetype,
        weight: getSelectionWeight(archetype.selection, archetype.routeId, archetype.contentTier, context, source),
      })),
      1,
    )[0];

    return starter ? buildUpgradeChoice(starter, pickUpgradeRarity(context, source, starter)) : undefined;
  }).filter(Boolean) as UpgradeDefinition[];
}

function buildLevelUpRouteWindowPool(
  context: ContentContext,
): Array<{ item: UpgradeArchetype; weight: number }> {
  const phase = context.phase;
  const isOpening = phase === 'opening';
  const isMid = phase === 'mid';
  const isLate = phase === 'late' || phase === 'finalPrep';
  const routeCount = Math.max(...Object.values(context.selectedUpgradeIds).map((_, i) => i + 1), 0);
  const dominantRoute = context.dominantRoute;
  const committedRoute = context.committedRoute || context.maturedRoute;

  // 阶段投放控制参数
  const allowBridge = phase !== 'opening' || routeCount >= 1;
  const allowEarlyPayoff = isMid && routeCount >= 2;
  const allowFinisher = isLate && routeCount >= 4;

  if (!dominantRoute) {
    // 无主导路线时只出starter和少量bridge
    return weightedMerge([
      [
        scaleWeightedPool(
          filterPoolByTags(
            buildWeightedUpgradePool(context, 'levelUp', (a) => Boolean(a.routeId)),
            ['starter'],
          ),
          1.2,
        ),
        1.2,
      ],
      [
        scaleWeightedPool(
          filterPoolByTags(
            buildWeightedUpgradePool(context, 'levelUp', (a) => Boolean(a.routeId)),
            ['bridge'],
          ),
          0.35,
        ),
        0.35,
      ],
    ]);
  }

  const dominantRoutePool = buildWeightedUpgradePool(
    context,
    'levelUp',
    (archetype) => archetype.routeId === dominantRoute,
  );

  if (isOpening) {
    // 开场：starter为主，少量bridge，不出payoff/finisher
    return weightedMerge([
      [scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['starter']), 1.2), 1.2],
      [scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['bridge']), allowBridge ? 0.35 : 0), 0.35],
      [
        scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['payoff', 'finisher']), 0),
        0,
      ],
    ]);
  }

  if (isMid) {
    // 中段：bridge稳定出现，允许少量payoff提前
    return weightedMerge([
      [scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['starter']), 0.35), 0.35],
      [scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['bridge']), 1.25), 1.25],
      [scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['payoff']), allowEarlyPayoff ? 0.55 : 0.15), 0.55],
      [scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['finisher']), 0), 0],
    ]);
  }

  // 后段/最终整备：payoff和finisher更容易出现
  return weightedMerge([
    [scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['bridge']), 0.65), 0.65],
    [scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['payoff']), 1.2), 1.2],
    [scaleWeightedPool(filterPoolByTags(dominantRoutePool, ['finisher']), allowFinisher ? 0.85 : 0.25), 0.85],
  ]);
}

function weightedMerge<T extends { id: string }>(
  pools: [Array<{ item: T; weight: number }>, number][],
): Array<{ item: T; weight: number }> {
  const merged = new Map<string, { item: T; weight: number }>();

  for (const [pool, weightMultiplier] of pools) {
    for (const entry of pool) {
      const existing = merged.get(entry.item.id);
      if (existing) {
        existing.weight += entry.weight * weightMultiplier;
      } else {
        merged.set(entry.item.id, {
          item: entry.item,
          weight: entry.weight * weightMultiplier,
        });
      }
    }
  }

  return Array.from(merged.values()).filter((entry) => entry.weight > 0);
}

function rollLevelUpChoices(context: ContentContext): UpgradeDefinition[] {
  const openingLevelUp = context.phase === 'opening';
  const earlyMidLevelUp = openingLevelUp || context.phase === 'mid';
  const hasCommittedRoute = Boolean(context.committedRoute || context.maturedRoute);
  const dominantHintedEarlyMid = Boolean(context.dominantRoute) && !hasCommittedRoute && earlyMidLevelUp;
  const picks: UpgradeArchetype[] = [];
  const genericPool = buildWeightedUpgradePool(context, 'levelUp', (archetype) => !archetype.routeId);
  const genericCorePool = filterPoolByTags(genericPool, ['stabilizer', 'bridge'], ['payoff', 'rare']);
  const genericPrimaryPool = genericCorePool.length > 0 ? genericCorePool : genericPool;
  const genericSecondaryPool = mergeWeightedPools(
    scaleWeightedPool(genericPrimaryPool, 1.18, 0.08),
    scaleWeightedPool(genericPool, 1.05),
  );
  const routeWindowPool = buildLevelUpRouteWindowPool(context);
  const flexPool = mergeWeightedPools(
    scaleWeightedPool(
      genericSecondaryPool.length > 0 ? genericSecondaryPool : genericPool,
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

  stabilizeUpgradeChoicePicks(picks, genericPool, context);

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
  const genericTransitionPool = filterPoolByTags(genericPool, ['bridge', 'stabilizer']);
  const genericHybridPool = filterPoolByTags(genericPool, ['hybrid', 'redirect'], ['payoff', 'finisher']);
  const genericLatePayoffPool = filterPoolByTags(genericPool, ['payoff'], ['starter']);
  const genericLateFlexPool = [...genericLatePayoffPool, ...genericHybridPool, ...genericTransitionPool];
  const allRoutePool = buildWeightedUpgradePool(context, source, (archetype) => Boolean(archetype.routeId));
  const noFocusStarterPool = filterPoolByTags(allRoutePool, ['starter']);
  const noFocusBridgePool = filterPoolByTags(allRoutePool, ['starter', 'bridge'], ['payoff', 'finisher', 'redirect']);
  const noFocusLateRoutePool = filterPoolByTags(allRoutePool, ['starter', 'bridge'], ['payoff', 'finisher']);
  const dominantRoute = context.dominantRoute;
  const dominantRoutePool =
    dominantRoute === null
      ? []
      : buildWeightedUpgradePool(context, source, (archetype) => archetype.routeId === dominantRoute);
  const dominantNonRedirectPool = dominantRoutePool.filter((entry) => !entry.item.tags?.includes('redirect'));
  const dominantHintPool = filterPoolByTags(dominantRoutePool, ['starter', 'bridge'], ['payoff', 'finisher', 'redirect']);
  const dominantBridgePool = filterPoolByTags(dominantRoutePool, ['bridge'], ['payoff', 'finisher', 'redirect']);
  const dominantStarterPool = filterPoolByTags(dominantRoutePool, ['starter']);
  const dominantCommittedPool = filterPoolByTags(dominantRoutePool, ['bridge', 'payoff', 'finisher'], ['redirect']);
  const dominantPayoffPool = filterPoolByTags(dominantRoutePool, ['payoff', 'finisher']);
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
    ['stabilizer', 'bridge', 'payoff'],
    ['hybrid', 'redirect'],
  );
  const finalPrepGenericCloseoutPool = mergeWeightedPools(
    scaleWeightedPool(
      finalPrepGenericPatchPool.length > 0 ? finalPrepGenericPatchPool : genericLateFlexPool.length > 0 ? genericLateFlexPool : genericPool,
      1.18,
    ),
    scaleWeightedPool(genericLatePayoffPool.length > 0 ? genericLatePayoffPool : genericPool, 1.12),
  );
  const finalPrepRouteSealPool =
    dominantPayoffPool.length > 0
      ? dominantPayoffPool
      : dominantCommittedPool.length > 0
        ? dominantCommittedPool
        : dominantNonRedirectPool;
  const finalPrepDominantFlexPool = mergeWeightedPools(
    scaleWeightedPool(finalPrepRouteSealPool.length > 0 ? finalPrepRouteSealPool : dominantRoutePool, 1.92),
    scaleWeightedPool(finalPrepGenericCloseoutPool.length > 0 ? finalPrepGenericCloseoutPool : genericPool, 0.92),
  );
  const allWeightedPool = [...dominantNonRedirectPool, ...genericPool, ...offRoutePool];
  const routeMatured = context.maturedRoute === dominantRoute;
  const routeCommittedOrMatured = Boolean(context.committedRoute || routeMatured);
  const allowRedirectWindow = context.phase !== 'opening' || context.round >= 2;
  const nodePrepGenericCorePool = genericTransitionPool.length > 0 ? genericTransitionPool : genericPool;
  const nodePrepGenericSupportPool =
    context.phase === 'late' || context.phase === 'finalPrep'
      ? mergeWeightedPools(
          scaleWeightedPool(genericLateFlexPool.length > 0 ? genericLateFlexPool : genericPool, 1.1),
          scaleWeightedPool(genericHybridPool.length > 0 ? genericHybridPool : nodePrepGenericCorePool, 0.96),
          scaleWeightedPool(nodePrepGenericCorePool.length > 0 ? nodePrepGenericCorePool : genericPool, 0.86),
        )
      : mergeWeightedPools(
          scaleWeightedPool(nodePrepGenericCorePool.length > 0 ? nodePrepGenericCorePool : genericPool, 1.14, 0.08),
          scaleWeightedPool(genericHybridPool.length > 0 ? genericHybridPool : genericPool, 1.02),
          scaleWeightedPool(genericPool, 0.84),
        );

  if (source === 'nodePrep') {
    const lateOrFinalPrepPhase = context.phase === 'late' || context.phase === 'finalPrep';
    const finalPrepPhase = context.phase === 'finalPrep';

    if (context.phase === 'finalPrep') {
      if (!context.dominantRoute) {
        appendUniquePicks(
          picks,
          finalPrepGenericPatchPool.length > 0 ? finalPrepGenericPatchPool : genericPool,
          1,
        );
        appendUniquePicks(
          picks,
          finalPrepGenericCloseoutPool.length > 0 ? finalPrepGenericCloseoutPool : genericPool,
          1,
        );
        appendUniquePicks(
          picks,
          genericLatePayoffPool.length > 0 ? genericLatePayoffPool : finalPrepGenericCloseoutPool.length > 0 ? finalPrepGenericCloseoutPool : genericPool,
          1,
        );
      } else {
        appendUniquePicks(
          picks,
          finalPrepRouteSealPool.length > 0 ? finalPrepRouteSealPool : dominantRoutePool,
          1,
        );
        appendUniquePicks(
          picks,
          finalPrepGenericPatchPool.length > 0 ? finalPrepGenericPatchPool : genericPool,
          1,
        );
        appendUniquePicks(
          picks,
          finalPrepDominantFlexPool.length > 0 ? finalPrepDominantFlexPool : finalPrepGenericCloseoutPool.length > 0 ? finalPrepGenericCloseoutPool : genericPool,
          1,
        );
      }

      if (picks.length < 3) {
        appendUniquePicks(
          picks,
          finalPrepGenericCloseoutPool.length > 0 ? finalPrepGenericCloseoutPool : genericPool,
          3 - picks.length,
        );
      }

      if (picks.length < 3) {
        appendUniquePicks(
          picks,
          finalPrepRouteSealPool.length > 0 ? finalPrepRouteSealPool : allWeightedPool,
          3 - picks.length,
        );
      }

      // 所有升级路径都必须执行路线牌最多1张和同属性不重复的兜底
      stabilizeUpgradeChoicePicks(picks, genericPool, context);

      return picks.map((archetype) => buildUpgradeChoice(archetype, pickUpgradeRarity(context, source, archetype)));
    }

    const earlyMidNoFocus = context.phase === 'opening' || context.phase === 'mid';
    const nodePrepNoFocusFlexPool = mergeWeightedPools(
      scaleWeightedPool(
        lateOrFinalPrepPhase && noFocusLateRoutePool.length > 0
          ? noFocusLateRoutePool
          : noFocusBridgePool.length > 0
            ? noFocusBridgePool
            : noFocusStarterPool,
        earlyMidNoFocus ? 1.72 : 1.08,
      ),
      scaleWeightedPool(genericHybridPool.length > 0 ? genericHybridPool : nodePrepGenericCorePool, earlyMidNoFocus ? 0.24 : 0.82),
      scaleWeightedPool(
        lateOrFinalPrepPhase
          ? genericLateFlexPool.length > 0
            ? genericLateFlexPool
            : genericPool
          : nodePrepGenericCorePool.length > 0
            ? nodePrepGenericCorePool
            : genericPool,
        earlyMidNoFocus ? 0.08 : 0.48,
      ),
    );
    const nodePrepHintFlexPool = mergeWeightedPools(
      scaleWeightedPool(
        dominantHintPool.length > 0
          ? dominantHintPool
          : dominantBridgePool.length > 0
            ? dominantBridgePool
          : dominantStarterPool.length > 0
              ? dominantStarterPool
              : dominantRoutePool,
        1.86,
      ),
      scaleWeightedPool(allowRedirectWindow ? offRouteRedirectPool : [], 0.38),
      scaleWeightedPool(genericHybridPool.length > 0 ? genericHybridPool : genericPool, 0.18),
    );
    const nodePrepCommittedFlexPool = mergeWeightedPools(
      scaleWeightedPool(
        dominantPayoffPool.length > 0
          ? dominantPayoffPool
          : dominantCommittedPool.length > 0
            ? dominantCommittedPool
            : dominantRoutePool,
        routeCommittedOrMatured ? 1.52 : 1.42,
      ),
      scaleWeightedPool(finalPrepPhase ? [] : offRouteRedirectPool, routeCommittedOrMatured ? 0.56 : 0.72),
      scaleWeightedPool(nodePrepLateFlexPool.length > 0 ? nodePrepLateFlexPool : genericPool, routeCommittedOrMatured ? 0.46 : 0.54),
    );

    appendUniquePicks(picks, nodePrepGenericCorePool.length > 0 ? nodePrepGenericCorePool : genericPool, 1);
    appendUniquePicks(picks, nodePrepGenericSupportPool.length > 0 ? nodePrepGenericSupportPool : genericPool, 1);

    if (!context.dominantRoute) {
      appendUniquePicks(
        picks,
        nodePrepNoFocusFlexPool.length > 0
          ? nodePrepNoFocusFlexPool
          : noFocusStarterPool.length > 0
            ? noFocusStarterPool
            : genericPool,
        1,
      );
    } else if (context.committedRoute || routeMatured || context.round >= 3) {
      appendUniquePicks(
        picks,
        nodePrepCommittedFlexPool.length > 0
          ? nodePrepCommittedFlexPool
          : dominantCommittedPool.length > 0
            ? dominantCommittedPool
            : nodePrepLateFlexPool.length > 0
              ? nodePrepLateFlexPool
              : genericPool,
        1,
      );
    } else {
      appendUniquePicks(
        picks,
        nodePrepHintFlexPool.length > 0
          ? nodePrepHintFlexPool
          : dominantHintPool.length > 0
            ? dominantHintPool
            : midRedirectWindowPool.length > 0
              ? midRedirectWindowPool
              : genericPool,
        1,
      );
    }

    if (picks.length < 3) {
      appendUniquePicks(
        picks,
        nodePrepGenericSupportPool.length > 0 ? nodePrepGenericSupportPool : genericPool,
        3 - picks.length,
      );
    }

    if (picks.length < 3) {
      appendUniquePicks(picks, genericPool, 3 - picks.length);
    }

    stabilizeUpgradeChoicePicks(picks, genericPool, context);

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

  stabilizeUpgradeChoicePicks(picks, genericPool, context);

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

export function rollEventDefinition(
  state: Readonly<RunState>,
  contentKind: EventContentKind = 'event',
): EventDefinition {
  const context = buildContentContext(state);
  const dominantRoute = context.dominantRoute;
  const catalog = getEventCatalogByKind(contentKind);
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
