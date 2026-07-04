export const excludedPaidMetricStatuses = ["blocked", "cancelled", "declined", "import_removed"] as const;

type BookingMetricRow = {
  status: string;
  paymentStatus: string;
  totalAmount: string | number | null;
  paidAmount: string | number | null;
};

export function calculatePaidBookingMetrics(rows: BookingMetricRow[]) {
  const paidBookings = rows.filter((booking) => (
    booking.paymentStatus === "paid" &&
    !excludedPaidMetricStatuses.includes(booking.status as typeof excludedPaidMetricStatuses[number]) &&
    Number(booking.totalAmount) > 0
  ));
  const revenue = paidBookings.reduce((sum, booking) => sum + Math.max(0, Number(booking.paidAmount) || 0), 0);
  const paidTotal = paidBookings.reduce((sum, booking) => sum + Number(booking.totalAmount), 0);
  return {
    revenue,
    averageCheck: paidBookings.length ? paidTotal / paidBookings.length : 0,
    paidBookingCount: paidBookings.length
  };
}
