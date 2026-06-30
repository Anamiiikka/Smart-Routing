import { describe, expect, it } from "vitest";
import { can, canViewTicket, canCommentOnTicket } from "./rbac";

describe("can()", () => {
  it("grants ADMIN every capability", () => {
    expect(can("ADMIN", "user.manage")).toBe(true);
    expect(can("ADMIN", "ticket.delete")).toBe(true);
    expect(can("ADMIN", "dashboard.systemHealth")).toBe(true);
  });

  it("lets MANAGER assign and see system health, but not manage users", () => {
    expect(can("MANAGER", "ticket.assign")).toBe(true);
    expect(can("MANAGER", "dashboard.systemHealth")).toBe(true);
    expect(can("MANAGER", "user.manage")).toBe(false);
  });

  it("lets AGENT update status but not assign or see system health", () => {
    expect(can("AGENT", "ticket.updateStatus")).toBe(true);
    expect(can("AGENT", "ticket.assign")).toBe(false);
    expect(can("AGENT", "dashboard.systemHealth")).toBe(false);
  });

  it("limits REQUESTER to creating and commenting", () => {
    expect(can("REQUESTER", "ticket.create")).toBe(true);
    expect(can("REQUESTER", "ticket.comment")).toBe(true);
    expect(can("REQUESTER", "ticket.readAll")).toBe(false);
    expect(can("REQUESTER", "dashboard.view")).toBe(false);
  });
});

describe("canViewTicket()", () => {
  const ticket = { requesterId: "u-req", assigneeId: "u-agent" };

  it("lets staff with readAll view any ticket", () => {
    expect(canViewTicket({ id: "x", role: "MANAGER" }, ticket)).toBe(true);
  });

  it("lets the requester view their own ticket", () => {
    expect(canViewTicket({ id: "u-req", role: "REQUESTER" }, ticket)).toBe(true);
  });

  it("blocks a requester from viewing someone else's ticket", () => {
    expect(canViewTicket({ id: "u-other", role: "REQUESTER" }, ticket)).toBe(false);
  });

  it("lets the assignee view it even without readAll", () => {
    const t = { requesterId: "u-req", assigneeId: "u-x" };
    expect(canViewTicket({ id: "u-x", role: "REQUESTER" }, t)).toBe(true);
  });
});

describe("canCommentOnTicket()", () => {
  it("requires both comment capability and visibility", () => {
    const ticket = { requesterId: "u-req", assigneeId: null };
    expect(canCommentOnTicket({ id: "u-req", role: "REQUESTER" }, ticket)).toBe(true);
    expect(canCommentOnTicket({ id: "u-other", role: "REQUESTER" }, ticket)).toBe(false);
  });
});
