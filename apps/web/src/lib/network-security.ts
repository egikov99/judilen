import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const allowedSmtpPorts = new Set([25, 465, 587]);

function privateIpv4(value: string) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 88 || b === 168))
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51)
    || (a === 203 && b === 0)
    || a >= 224;
}

export function isPrivateOrReservedIp(value: string) {
  const normalized = value.toLowerCase().split("%")[0];
  if (isIP(normalized) === 4) return privateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized.startsWith("::ffff:")) return privateIpv4(normalized.slice(7));
  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith("ff")
    || normalized.startsWith("2001:db8");
}

export async function assertSafeSmtpTarget(hostValue: string, port: number) {
  const host = hostValue.trim().replace(/^\[|\]$/g, "").toLowerCase();
  if (!allowedSmtpPorts.has(port)) {
    throw Object.assign(new Error("Разрешены только SMTP-порты 25, 465 и 587"), { code: "EPORTNOTALLOWED" });
  }
  if (
    !host
    || host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".internal")
    || host === "host.docker.internal"
    || (!host.includes(".") && isIP(host) === 0)
  ) {
    throw Object.assign(new Error("Локальные и внутренние SMTP-адреса запрещены"), { code: "EHOSTNOTALLOWED" });
  }
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateOrReservedIp(address))) {
    throw Object.assign(new Error("SMTP host указывает на локальный или служебный IP-адрес"), { code: "EHOSTNOTALLOWED" });
  }
  return addresses.map(({ address }) => address);
}
