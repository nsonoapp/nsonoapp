const SW_FILE = "service-worker.js";
const LEGACY_SW_FILES = ["service-workerA.js"];

async function unregisterLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      const scriptUrl =
        registration.active?.scriptURL ||
        registration.waiting?.scriptURL ||
        registration.installing?.scriptURL ||
        "";

      const isLegacy = LEGACY_SW_FILES.some((name) => scriptUrl.includes(name));
      if (isLegacy) {
        await registration.unregister();
      }
    })
  );
}

async function registerServiceWorker() {
  const swUrl = new URL(SW_FILE, window.location.href);
  await navigator.serviceWorker.register(swUrl.pathname);
}

window.addEventListener("load", () => {
  unregisterLegacyServiceWorkers()
    .then(registerServiceWorker)
    .catch(() => {});
});
