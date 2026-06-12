export type ApprovalStatus = "pending" | "approved" | "declined";

export type SuggestedSlot = {
  id: string;
  approvalId: string;
  start: string;
  end: string;
  selected: boolean;
};

export type FollowUpApproval = {
  id: string;
  googleEventId: string;
  contactEmail: string;
  meetingSummary: string;
  meetingStart: string;
  meetingEnd: string;
  meetingTimeZone?: string | null;
  status: ApprovalStatus;
  calendarEventId?: string | null;
  createdAt: string;
  updatedAt: string;
  slots: SuggestedSlot[];
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export function listApprovals(): Promise<FollowUpApproval[]> {
  return request<FollowUpApproval[]>("/approvals");
}

export function runFollowUpJob(): Promise<{ scanned: number; approvalsSent: number }> {
  return request("/jobs/follow-ups/run", { method: "POST" });
}

export function respondToApproval(
  id: string,
  body: { decision: "approve" | "decline"; slotStart?: string }
): Promise<{ status: string; calendarEventId?: string }> {
  return request(`/approvals/${id}/respond`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}
