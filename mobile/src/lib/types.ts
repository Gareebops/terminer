export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type AdminTenant = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

export type TodayBooking = {
  id: string;
  startTime: string; // "HH:MM"
  endTime: string;
  customerName: string;
  status: BookingStatus;
  serviceName: string;
  staffName: string;
};
