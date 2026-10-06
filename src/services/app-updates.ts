export type UpdateStatus = 'waiting' | 'applying' | 'blocked';

export interface UpdateActions {
  canApplyAutomatically: () => boolean;
  saveBeforeUpdate: () => boolean;
  activate: () => Promise<void>;
  reload: () => void;
  onStatus: (status: UpdateStatus) => void;
  onFailure: (reason: 'save' | 'activation') => void;
}

/** Update decisions are independent of DOM and worker registration mechanics. */
export class AppUpdates {
  private pending = false;
  private applying = false;
  private reloadPending = false;
  private reloading = false;
  private blocked = false;
  private status: UpdateStatus | null = null;

  constructor(private readonly actions: UpdateActions) {}

  waiting(): void {
    this.pending = true;
    if (this.blocked || this.applying || this.reloading) return;
    this.report('waiting');
    this.applyWhenSafe();
  }

  activated(): void {
    // Activation in another tab never authorizes this tab to skip its save guard.
    this.reloadPending = true;
    this.pending = true;
    this.applying = false;
    this.applyWhenSafe();
  }

  journeySaved(): void {
    this.blocked = false;
    this.applyWhenSafe();
  }

  retry(): void {
    this.blocked = false;
    this.applyWhenSafe();
  }

  installationFailed(): void {
    if (!this.pending || this.reloading) return;
    this.pending = this.reloadPending;
    this.fail('activation');
  }

  applyWhenSafe(): void {
    if (!this.pending || this.applying || this.reloading || this.blocked) return;
    if (!this.actions.canApplyAutomatically()) { this.report('waiting'); return; }
    // Mark busy before saving: a successful save can call journeySaved reentrantly.
    this.applying = true;
    try {
      if (this.actions.saveBeforeUpdate() !== true) { this.fail('save'); return; }
    } catch { this.fail('save'); return; }
    this.report('applying');
    if (this.reloadPending) {
      this.reloading = true;
      this.actions.reload();
      return;
    }
    void Promise.resolve().then(() => this.actions.activate()).catch(() => this.fail('activation'));
  }

  private fail(reason: 'save' | 'activation'): void {
    this.applying = false;
    this.blocked = true;
    this.report('blocked');
    this.actions.onFailure(reason);
  }

  private report(status: UpdateStatus): void {
    if (this.reloading || this.status === status) return;
    this.status = status;
    this.actions.onStatus(status);
  }
}
