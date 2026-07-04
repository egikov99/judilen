export type SmtpDiagnosticStage = "configuration" | "dns" | "connection" | "tls" | "authentication" | "send";

export type SmtpDiagnosticError = {
  success: false;
  stage: SmtpDiagnosticStage;
  code: string;
  message: string;
  description: string;
  details: string;
  recommendations: string[];
};

type ErrorLike = Error & {
  code?: string;
  errno?: string | number;
  syscall?: string;
  address?: string;
  port?: number;
  command?: string;
  response?: string;
  responseCode?: number;
};

const connectionCodes = new Set(["ECONNREFUSED", "ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"]);
const dnsCodes = new Set(["ENOTFOUND", "EAI_AGAIN", "ENODATA"]);

export function classifySmtpError(error: unknown, fallbackStage: SmtpDiagnosticStage = "connection"): SmtpDiagnosticError {
  if (
    error && typeof error === "object" && "success" in error && error.success === false &&
    "stage" in error && "code" in error && "details" in error && "recommendations" in error
  ) {
    return error as SmtpDiagnosticError;
  }
  const value = error instanceof Error ? error as ErrorLike : new Error(String(error)) as ErrorLike;
  const rawCode = String(value.code ?? value.errno ?? "SMTP_ERROR").toUpperCase();
  const technical = [value.message, value.response, value.command && `Command: ${value.command}`, value.syscall && `Syscall: ${value.syscall}`, value.address && `Address: ${value.address}`, value.port && `Port: ${value.port}`]
    .filter(Boolean).join("\n");
  const lower = technical.toLowerCase();

  let stage: SmtpDiagnosticStage = fallbackStage;
  let code = rawCode;
  const message = value.message || "Неизвестная ошибка SMTP";
  let description = "SMTP-сервер вернул ошибку.";
  let recommendations = ["Проверьте SMTP host, порт и параметры шифрования.", "Проверьте журнал SMTP-провайдера."];

  if (dnsCodes.has(rawCode) || lower.includes("getaddrinfo") || lower.includes("host not found")) {
    stage = "dns";
    description = "Не удалось найти SMTP-сервер по указанному имени.";
    recommendations = ["Проверьте SMTP host на опечатки.", "Проверьте DNS и доступ сервера в интернет."];
  } else if (rawCode === "EAUTH" || value.responseCode === 535 || lower.includes("authentication failed") || lower.includes("invalid login")) {
    stage = "authentication";
    code = rawCode === "SMTP_ERROR" ? "EAUTH" : rawCode;
    description = "SMTP-сервер отклонил логин или пароль.";
    recommendations = ["Проверьте SMTP username и пароль.", "Для Gmail/Yandex/Mail.ru используйте пароль приложения.", "Убедитесь, что SMTP-доступ разрешён в настройках почтового аккаунта."];
  } else if (lower.includes("certificate") || lower.includes("self signed") || lower.includes("tls") || lower.includes("ssl") || rawCode.startsWith("ERR_TLS")) {
    stage = "tls";
    description = "Не удалось установить защищённое SSL/TLS-соединение.";
    recommendations = ["Проверьте тип шифрования и порт: обычно SSL — 465, STARTTLS — 587.", "Проверьте срок действия и цепочку сертификата SMTP-сервера.", "Не отключайте проверку сертификата в production."];
  } else if (rawCode === "ETIMEDOUT" || lower.includes("timed out") || lower.includes("timeout")) {
    stage = "connection";
    code = "ETIMEDOUT";
    description = "SMTP-сервер не ответил за отведённое время.";
    recommendations = ["Проверьте host и порт.", "Проверьте Firewall и исходящие соединения хостинга.", "Уточните у провайдера, не заблокирован ли SMTP-порт."];
  } else if (connectionCodes.has(rawCode)) {
    stage = "connection";
    description = rawCode === "ECONNREFUSED" ? "SMTP-сервер отказал в подключении." : "Сетевое соединение с SMTP-сервером прервано или недоступно.";
    recommendations = ["Проверьте SMTP host и порт.", "Проверьте Firewall и сетевые правила.", "Уточните у провайдера, разрешены ли исходящие SMTP-соединения."];
  } else if (fallbackStage === "configuration") {
    description = "SMTP-настройки заполнены не полностью или содержат некорректные значения.";
    recommendations = ["Заполните host, port и From email.", "Проверьте соответствие порта выбранному типу шифрования."];
  } else if (fallbackStage === "send") {
    description = "Соединение установлено, но SMTP-сервер не принял тестовое письмо.";
    recommendations = ["Проверьте адрес отправителя и получателя.", "Проверьте ограничения SMTP-провайдера и разрешённые From-адреса.", "Изучите технический ответ сервера ниже."];
  }

  return {
    success: false,
    stage,
    code,
    message,
    description,
    details: technical || message,
    recommendations
  };
}
