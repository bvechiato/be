import { describe, it, expect } from "vitest";
import { commentSerializer } from "../../../services/dto/dto-comment";

describe("dto-comment serializer", () => {
  it("maps author and timestamps", () => {
    const updatedAt = new Date("2021-06-01");
    const comment: any = {
      id: 7,
      text: "hello",
      entityId: 42,
      entityType: "volunteer",
      user: { person: { name: "Bob" } },
      updatedAt,
    };

    const out = commentSerializer(comment);
    expect(out.id).toBe(7);
    expect(out.content).toBe("hello");
    expect(out.entityId).toBe(42);
    expect(out.entityType).toBe("volunteer");
    expect(out.authorName).toBe("Bob");
    expect(out.timestamp).toBe(updatedAt);
  });
});