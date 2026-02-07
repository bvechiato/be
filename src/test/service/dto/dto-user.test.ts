import { describe, it, expect } from "vitest";
import { serializeUserToMeDTO } from "../../../services/dto/dto-user";

describe("dto-user serializer", () => {
  it("maps user fields and applies defaults", () => {
    const userWithPerson: any = {
      id: 10,
      email: "a@b",
      isActive: true,
      role: "admin",
      person: { firstName: "F", name: "Full Name", avatarUrl: "avatar.png" },
      // language/timezone omitted -> defaults
    };

    const dto = serializeUserToMeDTO(userWithPerson);
    expect(dto.id).toBe(10);
    expect(dto.email).toBe("a@b");
    expect(dto.firstName).toBe("F");
    expect(dto.fullName).toBe("Full Name");
    expect(dto.avatarUrl).toBe("avatar.png");
    expect(dto.isoCode).toBe("en");
    expect(dto.timezone).toBe("CET");

    const userNoPerson: any = { id: 20, email: "x@y", isActive: false, role: "user" };
    const dto2 = serializeUserToMeDTO(userNoPerson);
    expect(dto2.firstName).toBe("");
    expect(dto2.fullName).toBe("");
    expect(dto2.avatarUrl).toBe("");
  });
});