export function redactSensitiveText(value: unknown) {
  return String(value ?? "")
    .replace(/(authorization\s*:\s*(?:bearer|basic)\s+)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/((?:password|passwd|pass|token|secret|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/([a-z0-9._%+-])[a-z0-9._%+-]*(@[a-z0-9.-]+\.[a-z]{2,})/gi, "$1•••$2")
    .replace(/(smtp(?:s)?:\/\/[^:/\s]+:)[^@\s]+@/gi, "$1[REDACTED]@");
}

export function safeErrorForLog(error: unknown) {
  if (!(error instanceof Error)) return { message: redactSensitiveText(error) };
  const code = "code" in error ? redactSensitiveText(error.code) : undefined;
  return {
    name: error.name,
    code,
    message: redactSensitiveText(error.message),
    stack: redactSensitiveText(error.stack)
  };
}
