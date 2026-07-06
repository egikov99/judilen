import { mkdir, readFile, unlink } from "node:fs/promises";

export function expenseReceiptRoot() {
  return process.env.EXPENSE_RECEIPT_DIR ?? "/app/storage/expense-receipts";
}

export async function ensureExpenseReceiptRoot() {
  const root = expenseReceiptRoot();
  await mkdir(root, { recursive: true });
  return root;
}

export function safeExpenseReceiptName(value: string) {
  return /^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(value) ? value : null;
}

export async function readExpenseReceipt(filename: string) {
  const safeName = safeExpenseReceiptName(filename);
  if (!safeName) return null;
  return readFile(`${expenseReceiptRoot()}/${safeName}`).catch(() => null);
}

export async function removeExpenseReceipt(url: string) {
  const prefix = "/api/admin/expense-receipts/";
  if (!url.startsWith(prefix)) return;
  const filename = safeExpenseReceiptName(url.slice(prefix.length));
  if (!filename) return;
  await unlink(`${expenseReceiptRoot()}/${filename}`).catch(() => undefined);
}
