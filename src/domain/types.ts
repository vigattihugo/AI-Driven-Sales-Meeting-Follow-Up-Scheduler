export type CalendarEvent = {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  timeZone?: string;
  attendees: Attendee[];
};

export type Attendee = {
  email: string;
  self?: boolean;
};

export type Slot = {
  start: Date;
  end: Date;
};

export type Approval = {
  id: string;
  event: CalendarEvent;
  contactEmail: string;
  slots: Slot[];
  status: "pending" | "approved" | "declined";
  createdAt: Date;
};

export type ApprovalDecision = "approve" | "decline";
