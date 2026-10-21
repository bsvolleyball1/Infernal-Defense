import { element, elements, setText } from './dom';
import type { BattleViewModel } from './battle-view-model';

/** Binds battle status and dragon controls. It does not read simulation rules. */
export class HudView {
  render(view: BattleViewModel): void {
    setText('#gold', view.gold);
    setText('#waveNum', view.wave);
    setText('#lives', view.lives);
    setText('#hpText', view.hpText);
    element<HTMLElement>('#hpBar').style.width = view.hpWidth;
    setText('#nestCount', view.nestCount);
    const start = element<HTMLButtonElement>('#start');
    start.disabled = view.startDisabled;
    start.hidden = view.startHidden;
    setText('#start', view.startLabel);
    start.setAttribute('aria-label', view.startLabel);
    start.title = view.startLabel;
    setText('#waveState', view.waveState);
    setText('#waveTitle', view.waveTitle);
    setText('#waveDesc', view.waveDesc);
    setText('#levelHeading', view.levelHeading);
    setText('#speed', view.speed);
    const speed = element<HTMLButtonElement>('#speed');
    speed.setAttribute('aria-label', 'Change game speed');
    speed.title = 'Change game speed';
    const pause = element<HTMLButtonElement>('#pause');
    setText('#pause', view.pauseGlyph);
    pause.setAttribute('aria-label', view.pauseAria);
    pause.title = view.pauseAria;
    pause.disabled = view.pauseDisabled;
    const panelOpen = !view.pauseOverlayHidden || element('#gameScreen').hasAttribute('data-pause-open');
    const overlay = element<HTMLElement>('#pauseOverlay');
    const wasHidden = overlay.hidden;
    overlay.hidden = !panelOpen;
    if (panelOpen) {
      setText('#pause', '▶');
      pause.setAttribute('aria-label', 'Resume');
      pause.title = 'Resume';
    }
    for (const selector of [
      '#battleWorld',
      '#battleSpells',
      '#battleDragons',
      '#battleStatus',
      '#speed',
      '#start',
      '.actions',
    ])
      element<HTMLElement>(selector).inert = panelOpen;
    if (panelOpen && wasHidden) element('#resumeBattle').focus();
    const upgrade = element<HTMLButtonElement>('#upgrade');
    upgrade.disabled = view.upgradeDisabled;
    upgrade.setAttribute('aria-label', view.upgradeLabel);
    upgrade.title = view.upgradeLabel;
    setText('#actionCost', view.actionCost);
    const sell = element<HTMLButtonElement>('#sell');
    sell.disabled = view.sellDisabled;
    sell.setAttribute('aria-label', view.sellLabel);
    sell.title = view.sellLabel;
    setText('#info', view.info);
    elements<HTMLButtonElement>('.tower').forEach((button) => {
      const placement = view.placement.find((item) => item.type === button.dataset.type);
      if (!placement) return;
      button.classList.toggle('selected', placement.selected);
      button.setAttribute('aria-pressed', String(placement.selected));
      button.setAttribute('aria-label', placement.label);
      button.title = placement.label;
      button.hidden = placement.hidden;
      button.disabled = placement.disabled;
    });
  }
}
