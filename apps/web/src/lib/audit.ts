import { auditLogs, db } from "@judilen/db";
import type { Session } from "@judilen/auth";

export async function writeAudit(input: {
  session: Session;
  request: Request;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(auditLogs).values({
    actorId: input.session.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ip: input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: input.request.headers.get("user-agent")
  });
}

