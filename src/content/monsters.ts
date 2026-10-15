import type { MonsterKind } from '../domain/model';
import { enemyRoster } from './enemies';

export const monsters: Record<MonsterKind, { name: string; description: string }> = {
  ...enemyRoster,
  scout: { name: 'Pass raider', description: 'A quick-footed egg thief with little armor.' },
  shield: { name: 'Iron guard', description: 'A slower raider protected by a heavy shield.' },
  runner: { name: 'Ash runner', description: 'A fast scout who races through the pass.' },
  chief: { name: 'Raid chief', description: 'A formidable leader who can endure a great deal of fire.' },
};
