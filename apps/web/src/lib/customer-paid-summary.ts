const excludedStatuses = new Set(["blocked", "cancelled", "declined", "import_removed"]);

type CustomerBookingPayment = {
  status: string;
  paymentStatus: string;
  paidAmount: string | number | null;
};

export function calculateCustomerPaidSummary(bookings: CustomerBookingPayment[]) {
  const paidBookings = bookings.filter((booking) => (
    !excludedStatuses.has(booking.status) &&
    booking.paymentStatus !== "refunded" &&
    Number(booking.paidAmount) > 0
  ));
  const total = paidBookings.reduce((sum, booking) => sum + Number(booking.paidAmount), 0);
  return {
    total,
    count: paidBookings.length,
    average: paidBookings.length ? total / paidBookings.length : 0
  };
}
