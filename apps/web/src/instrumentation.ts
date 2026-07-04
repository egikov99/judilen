export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureVapidConfiguration } = await import("./lib/vapid");
    const configuration = await ensureVapidConfiguration();
    console.info("vapid_configuration_ready", { source: configuration.source });
  } catch (error) {
    console.error("vapid_configuration_initialization_failed", error);
  }
}
