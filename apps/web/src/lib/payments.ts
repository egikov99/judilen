export function onlinePaymentsEnabled() {
  return process.env.ONLINE_PAYMENTS_ENABLED === "true";
}
