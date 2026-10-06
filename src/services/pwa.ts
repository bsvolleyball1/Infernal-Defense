import { registerSW } from 'virtual:pwa-register';

export interface PwaOptions {
  /** Return true only when the current journey is safely saved. */
  beforeUpdate: () => boolean;
  onMessage: (text: string) => void;
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let initialized = false;

export function initPwa({ beforeUpdate, onMessage }: PwaOptions): void {
  if (initialized || typeof window === 'undefined') return;
  const panel = document.getElementById('pwaPanel');
  if (!panel) { onMessage('Install controls are unavailable: the PWA panel is missing.'); return; }
  initialized = true;
  panel.hidden = false;
  panel.setAttribute('aria-label', 'App installation and offline status');
  const controls = document.createElement('div');

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const install = document.createElement('button');
  install.type = 'button';
  install.textContent = 'Install';
  install.className = 'back-btn';
  const help = document.createElement('p');
  help.id = 'pwa-install-help';
  help.hidden = true;
  install.setAttribute('aria-controls', help.id);
  install.setAttribute('aria-expanded', 'false');
  const available = document.createElement('button');
  available.type = 'button';
  available.className = 'back-btn';
  available.textContent = 'Update available';
  available.hidden = true;
  available.setAttribute('aria-controls', 'pwa-update-controls');
  available.setAttribute('aria-expanded', 'false');
  const updatePanel = document.createElement('div');
  updatePanel.hidden = true;
  updatePanel.id = 'pwa-update-controls';
  updatePanel.setAttribute('role', 'group');
  updatePanel.setAttribute('aria-label', 'App update available');
  const updateText = document.createElement('p');
  updateText.textContent = 'A new version is ready. Save your journey before updating.';
  const updateNow = document.createElement('button');
  updateNow.type = 'button';
  updateNow.className = 'back-btn';
  updateNow.textContent = 'Update now';
  const updateLater = document.createElement('button');
  updateLater.type = 'button';
  updateLater.className = 'back-btn';
  updateLater.textContent = 'Later';
  updatePanel.append(updateText, updateNow, updateLater);
  controls.append(status, install, available, help, updatePanel);
  panel.append(controls);

  let deferred: InstallPromptEvent | null = null;
  let offlineReady = false;
  let updating = false;
  let reloadRequired = false;
  let reloading = false;
  let installed = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const announce = (text: string) => {
    status.textContent = text;
    onMessage(text);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(syncStatus, 8_000);
  };
  const syncStatus = () => {
    status.textContent = navigator.onLine
      ? offlineReady ? 'Ready to play offline' : 'Online'
      : offlineReady ? 'Offline · ready' : 'Offline · connect to prepare';
  };
  const syncInstall = () => {
    install.hidden = installed;
    if (installed || deferred) {
      help.hidden = true;
      install.setAttribute('aria-expanded', 'false');
    }
    install.textContent = 'Install';
    install.setAttribute('aria-label', deferred ? 'Install Infernal Defense' : 'Show installation guidance');
    help.textContent = ios
      ? 'On iPhone or iPad, open this app in Safari, choose Share, then Add to Home Screen.'
      : 'Use your browser menu to install this app or add it to your home screen when available.';
  };
  syncStatus();
  syncInstall();
  const offerUpdate = () => {
    if (!available.hidden) return;
    available.hidden = false;
    available.setAttribute('aria-expanded', 'true');
    updatePanel.hidden = false;
    syncStatus();
    onMessage('An app update is available. Choose Update now or Later.');
  };
  const requestReload = () => {
    if (updating) {
      if (!reloading) { reloading = true; window.location.reload(); }
      return;
    }
    reloadRequired = true;
    offerUpdate();
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    syncInstall();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    syncInstall();
    announce('Infernal Defense is installed.');
  });
  window.addEventListener('online', syncStatus);
  window.addEventListener('offline', syncStatus);
  install.addEventListener('click', () => {
    const prompt = deferred;
    if (!prompt) {
      help.hidden = !help.hidden;
      install.setAttribute('aria-expanded', String(!help.hidden));
      return;
    }
    deferred = null;
    install.disabled = true;
    void (async () => {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        announce(choice.outcome === 'accepted' ? 'Installation accepted.' : 'Installation postponed.');
      } catch { announce('Installation could not start. Try your browser menu.'); }
      finally { install.disabled = false; syncInstall(); }
    })();
  });
  updateLater.addEventListener('click', () => {
    updatePanel.hidden = true;
    available.setAttribute('aria-expanded', 'false');
    available.focus();
    syncStatus();
    onMessage('Update postponed. Use Update available whenever you are ready.');
  });
  available.addEventListener('click', () => {
    updatePanel.hidden = !updatePanel.hidden;
    available.setAttribute('aria-expanded', String(!updatePanel.hidden));
    if (!updatePanel.hidden) updateNow.focus();
  });

  if (!('serviceWorker' in navigator)) {
    announce('This browser does not support offline installation.');
    return;
  }
  if (import.meta.env.DEV) {
    status.textContent = 'Development · online only';
    return;
  }
  let controlledWorker = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const next = navigator.serviceWorker.controller;
    if (updating || (controlledWorker && controlledWorker !== next)) requestReload();
    controlledWorker = next;
  });
  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedReload() {
        // Another app tab may activate a worker; it cannot authorize this tab's reload.
        requestReload();
      },
      onNeedRefresh() {
        offerUpdate();
      },
      onOfflineReady() { offlineReady = true; syncStatus(); onMessage('Infernal Defense is ready to play offline.'); },
      onRegisterError() { announce('Offline setup failed. Check your connection and reload to retry.'); },
      onRegisteredSW(url, registration) {
        if (!registration) return;
        const scriptURL = new URL(url, window.location.href).href;
        const markActiveReady = (candidate: ServiceWorkerRegistration) => {
          // generateSW activation follows successful, atomic installation of its precache.
          if (candidate.scope === new URL(import.meta.env.BASE_URL, window.location.origin).href &&
              candidate.active?.scriptURL === scriptURL && candidate.active.state === 'activated') {
            offlineReady = true;
            syncStatus();
          }
        };
        markActiveReady(registration);
        void navigator.serviceWorker.ready.then(markActiveReady).catch(() => announce('Offline setup could not complete.'));
        const checkWaiting = () => {
          // Use native lifecycle state as well as Workbox's time-based callbacks.
          // Rapid consecutive builds can otherwise be classified as external installs.
          if (registration.active && registration.waiting) offerUpdate();
        };
        checkWaiting();
        const watched = new WeakSet<ServiceWorker>();
        const watchWorker = (worker: ServiceWorker | null) => {
          if (!worker || watched.has(worker)) return;
          watched.add(worker);
          let activated = worker.state === 'activated';
          worker.addEventListener('error', () => announce('The offline worker failed. Reconnect and reload to retry.'));
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
              checkWaiting();
              setTimeout(checkWaiting, 0);
            }
            if (worker.state === 'activated') { activated = true; markActiveReady(registration); }
            if (worker.state === 'redundant' && !activated) {
              announce('The app update could not be installed. Try again when online.');
              updating = false;
              updateNow.disabled = false;
              updateLater.disabled = false;
              if (!registration.waiting) {
                available.hidden = true;
                updatePanel.hidden = true;
              }
            }
          });
        };
        watchWorker(registration.installing);
        watchWorker(registration.waiting);
        watchWorker(registration.active);
        window.addEventListener('online', () => {
          void registration.update().catch(() => announce('Could not check for an app update.'));
        });
        registration.addEventListener('updatefound', () => {
          watchWorker(registration.installing);
        });
      },
    });
    updateNow.addEventListener('click', () => {
      if (updating) return;
      try {
        if (beforeUpdate() !== true) {
          announce('Journey could not be saved. Update postponed.');
          return;
        }
      } catch { announce('Journey could not be saved. Update postponed.'); return; }
      updating = true;
      updateNow.disabled = true;
      updateLater.disabled = true;
      announce('Journey saved. Applying the app update…');
      if (reloadRequired) { window.location.reload(); return; }
      // Only this explicit, successfully saved action authorizes activation/reload.
      void updateSW(true).catch(() => {
        updating = false;
        updateNow.disabled = false;
        updateLater.disabled = false;
        announce('The app update failed. Your current game remains open.');
      });
    });
  } catch { announce('Offline setup failed. Reload to retry.'); }
}
