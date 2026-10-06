import { registerSW } from 'virtual:pwa-register';
import { AppUpdates } from './app-updates';

export interface PwaMessageAction {
  label: string;
  onClick: () => void;
  persistent?: boolean;
}

export interface PwaOptions {
  /** Never automatically interrupt a running wave or reload a hidden tab. */
  canAutoUpdate: () => boolean;
  /** Return true only when the current journey is safely saved. */
  beforeUpdate: () => boolean;
  onMessage: (text: string, action?: PwaMessageAction) => void;
}
export interface PwaController { onJourneySaved: () => void; checkPendingUpdate: () => void }
const inactiveController: PwaController = { onJourneySaved: () => {}, checkPendingUpdate: () => {} };

let initialized = false;

export function initPwa({ canAutoUpdate, beforeUpdate, onMessage }: PwaOptions): PwaController {
  if (initialized || typeof window === 'undefined') return inactiveController;
  initialized = true;

  let offlineReady = false;
  const markOfflineReady = () => {
    if (offlineReady) return;
    offlineReady = true;
    onMessage('Ready to play offline.');
  };
  const announceConnectivity = () => {
    onMessage(navigator.onLine
      ? offlineReady ? 'Online · ready to play offline.' : 'Online'
      : offlineReady ? 'Offline · ready to play.' : 'Offline · connect to prepare.');
  };
  window.addEventListener('online', announceConnectivity);
  window.addEventListener('offline', announceConnectivity);

  if (!('serviceWorker' in navigator)) {
    onMessage('This browser does not support offline installation.');
    return inactiveController;
  }
  if (import.meta.env.DEV) return inactiveController;
  let updateSW: (reload?: boolean) => Promise<void>;
  let checkForUpdate = () => {};
  const updates = new AppUpdates({
    canApplyAutomatically: canAutoUpdate,
    saveBeforeUpdate: beforeUpdate,
    activate: () => updateSW(true),
    reload: () => window.location.reload(),
    onStatus: state => {
      if (state === 'blocked') {
        onMessage('Update paused because your journey could not be saved.', {
          label: 'Retry update',
          persistent: true,
          onClick: () => { updates.retry(); checkForUpdate(); },
        });
        return;
      }
      onMessage(state === 'waiting'
        ? 'Update ready · applies automatically when the battle pauses or the wave ends.'
        : 'Journey saved · updating automatically…');
    },
    onFailure: reason => {
      if (reason === 'save') return;
      onMessage('The app update failed. Your current game remains open.', {
        label: 'Retry update',
        persistent: true,
        onClick: () => { updates.retry(); checkForUpdate(); },
      });
    },
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updates.applyWhenSafe();
  });
  let controlledWorker = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const next = navigator.serviceWorker.controller;
    if (controlledWorker && controlledWorker !== next) updates.activated();
    controlledWorker = next;
  });
  try {
    updateSW = registerSW({
      immediate: true,
      onNeedReload() {
        // Another app tab may activate a worker; it cannot authorize this tab's reload.
        updates.activated();
      },
      onNeedRefresh() {
        // Ignore Workbox's rapid-install heuristic unless a real replacement is waiting.
        void navigator.serviceWorker.getRegistration().then(registration => {
          if (registration?.active && registration.waiting) updates.waiting();
        }).catch(() => onMessage('Could not inspect the pending app update.'));
      },
      onOfflineReady: markOfflineReady,
      onRegisterError() { onMessage('Offline setup failed. Check your connection and reload to retry.'); },
      onRegisteredSW(url, registration) {
        if (!registration) return;
        const scriptURL = new URL(url, window.location.href).href;
        const markActiveReady = (candidate: ServiceWorkerRegistration) => {
          // generateSW activation follows successful, atomic installation of its precache.
          if (candidate.scope === new URL(import.meta.env.BASE_URL, window.location.origin).href &&
              candidate.active?.scriptURL === scriptURL && candidate.active.state === 'activated') {
            markOfflineReady();
          }
        };
        markActiveReady(registration);
        void navigator.serviceWorker.ready.then(markActiveReady).catch(() => onMessage('Offline setup could not complete.'));
        const checkWaiting = () => {
          // Use native lifecycle state as well as Workbox's time-based callbacks.
          // Rapid consecutive builds can otherwise be classified as external installs.
          if (registration.active && registration.waiting) updates.waiting();
        };
        checkWaiting();
        const watched = new WeakSet<ServiceWorker>();
        const watchWorker = (worker: ServiceWorker | null) => {
          if (!worker || watched.has(worker)) return;
          watched.add(worker);
          let activated = worker.state === 'activated';
          worker.addEventListener('error', () => onMessage('The offline worker failed. Reconnect and reload to retry.'));
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
              checkWaiting();
              setTimeout(checkWaiting, 0);
            }
            if (worker.state === 'activated') { activated = true; markActiveReady(registration); }
            if (worker.state === 'redundant' && !activated) {
              onMessage('The app update could not be installed. Try again when online.');
              updates.installationFailed();
            }
          });
        };
        watchWorker(registration.installing);
        watchWorker(registration.waiting);
        watchWorker(registration.active);
        checkForUpdate = () => {
          updates.applyWhenSafe();
          if (navigator.onLine && !document.hidden) {
            void registration.update().catch(() => onMessage('Could not check for an app update.'));
          }
        };
        window.addEventListener('online', checkForUpdate);
        window.addEventListener('focus', checkForUpdate);
        document.addEventListener('visibilitychange', checkForUpdate);
        setInterval(checkForUpdate, 60_000);
        checkForUpdate();
        registration.addEventListener('updatefound', () => {
          watchWorker(registration.installing);
        });
      },
    });
  } catch { onMessage('Offline setup failed. Reload to retry.'); }
  return { onJourneySaved: () => updates.journeySaved(), checkPendingUpdate: () => updates.applyWhenSafe() };
}
