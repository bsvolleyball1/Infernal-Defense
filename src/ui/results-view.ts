import { element, setText } from './dom';
import type { BattleViewModel } from './battle-view-model';

/** Binds the result dialog. It does not read simulation rules. */
export class ResultsView {
  render(view: BattleViewModel): void {
    element('#gameOver').classList.toggle('show', view.showResults);
    if (view.ended) {
      setText('#resultKicker', view.resultKicker);
      setText('#resultTitle', view.resultTitle);
      setText('#resultEnemies', view.resultEnemies);
      setText('#resultEggs', view.resultEggs);
      setText('#resultGold', view.resultGold);
    }
    setText('#bankedGold', view.bankedGold);
  }
}
