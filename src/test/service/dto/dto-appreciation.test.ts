import { describe, it, expect, vi, beforeEach } from "vitest";
import { dtoAppreciation } from "../../../services/dto/dto-appreciation";

describe("dto-appeciation serializer", () => {
  it("maps fields", () => {
    const now = new Date();
    const appreciation: any = {
      id: 1,
      title: "Thanks",
      dateDue: now,
      dateDelivery: now,
      volunteerId: 11,
      opportunityId: 22,
      userId: 33,
    };

    const out = dtoAppreciation(appreciation);
    expect(out.id).toBe(1);
    expect(out.title).toBe("Thanks");
    expect(out.dateDue).toBe(now);
    expect(out.dateDelivery).toBe(now);
    expect(out.volunteerId).toBe(11);
    expect(out.opportunityId).toBe(22);
    expect(out.userId).toBe(33);
  });
});
