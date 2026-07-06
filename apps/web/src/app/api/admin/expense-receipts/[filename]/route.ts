import { readExpenseReceipt, safeExpenseReceiptName } from "@/lib/expense-receipts";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const auth = await requirePermission("expenses.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { filename } = await params;
  const safeName = safeExpenseReceiptName(filename);
  if (!safeName) return problem(404, "Чек не найден");
  const bytes = await readExpenseReceipt(safeName);
  if (!bytes) return problem(404, "Чек не найден");
  const extension = safeName.split(".").pop()!;
  return new Response(bytes, {
    headers: {
      "Content-Type": contentTypes[extension] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
