const SW_FILE = "service-workerA.js";

function getRegistrationScriptUrl(registration) {
  const worker =
    registration.active ||
    registration.waiting ||
    registration.installing;
  return worker?.scriptURL || "";
}

async function unregisterLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  const targetName = `/${SW_FILE}`;

  await Promise.all(
    registrations.map(async (registration) => {
      const scriptUrl = getRegistrationScriptUrl(registration);
      if (!scriptUrl.endsWith(targetName)) {
        await registration.unregister();
      }
    })
  );
}

async function registerNsosoServiceWorker() {
  const swUrl = new URL(SW_FILE, window.location.href);
  await navigator.serviceWorker.register(swUrl.pathname);
}

window.addEventListener("load", () => {
  unregisterLegacyServiceWorkers()
    .then(registerNsosoServiceWorker)
    .catch(() => {});
});
