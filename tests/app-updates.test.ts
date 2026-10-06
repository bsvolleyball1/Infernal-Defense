import { describe, expect, it, vi } from 'vitest';
import { AppUpdates } from '../src/services/app-updates';

function scenario() {
  const actions = {
    canApplyAutomatically: vi.fn(() => true), saveBeforeUpdate: vi.fn(() => true),
    activate: vi.fn(async () => {}), reload: vi.fn(), onStatus: vi.fn(), onFailure: vi.fn(),
  };
  return { actions, updates: new AppUpdates(actions) };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('guarded automatic app updates', () => {
  it('automatically saves and activates an update at a safe point, then rechecks the save before reload', async () => {
    const { actions, updates } = scenario(); updates.waiting(); await settle();
    expect(actions.saveBeforeUpdate).toHaveBeenCalledTimes(1); expect(actions.activate).toHaveBeenCalledTimes(1);
    expect(actions.reload).not.toHaveBeenCalled(); updates.activated();
    expect(actions.saveBeforeUpdate).toHaveBeenCalledTimes(2); expect(actions.reload).toHaveBeenCalledTimes(1);
  });

  it('does not save, activate or reload a running wave or hidden tab', async () => {
    const { actions, updates } = scenario(); actions.canApplyAutomatically.mockReturnValue(false);
    updates.waiting(); updates.applyWhenSafe(); updates.journeySaved(); await settle();
    expect(actions.saveBeforeUpdate).not.toHaveBeenCalled(); expect(actions.activate).not.toHaveBeenCalled();
    expect(actions.reload).not.toHaveBeenCalled(); expect(actions.onStatus).toHaveBeenCalledWith('waiting');
    actions.canApplyAutomatically.mockReturnValue(true); updates.journeySaved(); await settle();
    expect(actions.activate).toHaveBeenCalledTimes(1);
  });

  it.each(['false', 'exception'])('blocks activation on a %s save failure and retries after a successful player save', async mode => {
    const { actions, updates } = scenario();
    if (mode === 'false') actions.saveBeforeUpdate.mockReturnValue(false);
    else actions.saveBeforeUpdate.mockImplementation(() => { throw new Error('Storage denied'); });
    updates.waiting(); updates.waiting(); updates.applyWhenSafe(); await settle();
    expect(actions.activate).not.toHaveBeenCalled(); expect(actions.onFailure).toHaveBeenCalledTimes(1);
    expect(actions.onStatus).toHaveBeenLastCalledWith('blocked');
    actions.saveBeforeUpdate.mockImplementation(() => true); updates.journeySaved(); await settle();
    expect(actions.activate).toHaveBeenCalledTimes(1);
  });

  it('blocks a reload when saving fails after worker activation', async () => {
    const { actions, updates } = scenario(); updates.waiting(); await settle();
    actions.saveBeforeUpdate.mockReturnValue(false); updates.activated();
    expect(actions.reload).not.toHaveBeenCalled(); expect(actions.onFailure).toHaveBeenCalledWith('save');
    actions.saveBeforeUpdate.mockReturnValue(true); updates.journeySaved();
    expect(actions.reload).toHaveBeenCalledTimes(1);
  });

  it('defers another tab’s worker activation until this tab is safe and independently saved', () => {
    const { actions, updates } = scenario(); actions.canApplyAutomatically.mockReturnValue(false);
    updates.activated(); expect(actions.reload).not.toHaveBeenCalled();
    actions.canApplyAutomatically.mockReturnValue(true); actions.saveBeforeUpdate.mockReturnValue(false);
    updates.applyWhenSafe(); expect(actions.reload).not.toHaveBeenCalled();
    actions.saveBeforeUpdate.mockReturnValue(true); updates.journeySaved();
    expect(actions.reload).toHaveBeenCalledTimes(1); expect(actions.activate).not.toHaveBeenCalled();
  });

  it('does not duplicate activation or reload for repeated native and Workbox events', async () => {
    const { actions, updates } = scenario(); updates.waiting(); updates.waiting(); updates.applyWhenSafe(); await settle();
    expect(actions.activate).toHaveBeenCalledTimes(1);
    updates.activated(); updates.activated(); updates.journeySaved(); updates.waiting();
    expect(actions.reload).toHaveBeenCalledTimes(1);
  });

  it('handles reentrant notifications from the save guard without recursion', async () => {
    const { actions, updates } = scenario();
    actions.saveBeforeUpdate.mockImplementation(() => { updates.journeySaved(); return true; });
    updates.waiting(); await settle(); expect(actions.activate).toHaveBeenCalledTimes(1);
    expect(actions.saveBeforeUpdate).toHaveBeenCalledTimes(1);
  });

  it('keeps a battle started during activation open until its next safe point', async () => {
    const { actions, updates } = scenario(); updates.waiting(); await settle();
    actions.canApplyAutomatically.mockReturnValue(false); updates.activated();
    expect(actions.reload).not.toHaveBeenCalled(); actions.canApplyAutomatically.mockReturnValue(true);
    updates.journeySaved(); expect(actions.reload).toHaveBeenCalledTimes(1);
  });

  it('reports activation failure and permits an explicit retry', async () => {
    const { actions, updates } = scenario(); actions.activate.mockRejectedValueOnce(new Error('Worker failed'));
    updates.waiting(); await settle(); await settle();
    expect(actions.onFailure).toHaveBeenCalledWith('activation'); expect(actions.reload).not.toHaveBeenCalled();
    updates.retry(); await settle(); expect(actions.activate).toHaveBeenCalledTimes(2);
  });

  it('handles a worker becoming redundant without endlessly activating a missing worker', async () => {
    const { actions, updates } = scenario(); updates.waiting(); await settle(); updates.installationFailed();
    updates.retry(); await settle(); expect(actions.activate).toHaveBeenCalledTimes(1);
    updates.waiting(); await settle(); expect(actions.activate).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no update is pending', () => {
    const { actions, updates } = scenario(); updates.journeySaved(); updates.applyWhenSafe(); updates.retry();
    expect(actions.saveBeforeUpdate).not.toHaveBeenCalled(); expect(actions.reload).not.toHaveBeenCalled();
  });
});
