import { router } from 'expo-router';

import type { GameModeId } from '@/core';

/** Opens the immersive gameplay screen (outside the tab bar). */
export function startGame(mode: GameModeId, scenarioIds?: string[]) {
  router.push({
    pathname: '/game/[mode]',
    params: scenarioIds && scenarioIds.length > 0 ? { mode, ids: scenarioIds.join(',') } : { mode },
  });
}
