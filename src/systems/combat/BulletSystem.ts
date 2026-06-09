import type { BattleState } from '../../game/types';
import { ARENA_WIDTH, ARENA_HEIGHT } from '../../data/balance';

export interface BulletSystemDeps {
  resolveBulletHit: (battle: BattleState, bullet: BattleState['bullets'][number], enemy: BattleState['enemies'][number]) => boolean;
}

export function updateBullets(battle: BattleState, dt: number, deps: BulletSystemDeps): void {
  const nextBullets = [];
  for (const bullet of battle.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.lifeSec -= dt;
    let bulletActive = bullet.lifeSec > 0;

    for (const enemy of battle.enemies) {
      if (!bulletActive) {
        break;
      }
      const distance = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
      if (distance > enemy.radius + 4) {
        continue;
      }

      deps.resolveBulletHit(battle, bullet, enemy);

      if (bullet.pierceRemaining > 0) {
        bullet.pierceRemaining -= 1;
      } else {
        bulletActive = false;
      }
    }

    if (bulletActive) {
      nextBullets.push(bullet);
    }
  }

  battle.bullets = nextBullets.filter(
    (bullet) =>
      bullet.x >= -40 &&
      bullet.x <= ARENA_WIDTH + 40 &&
      bullet.y >= -40 &&
      bullet.y <= ARENA_HEIGHT + 40 &&
      bullet.lifeSec > 0,
  );
}
