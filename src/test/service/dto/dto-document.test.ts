import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../server/utils", () => ({
  getDocumentUrl: vi.fn((s3Key: string) => `https://cdn.example/${s3Key}`),
}));

import { documentSerializer } from "../../../services/dto/dto-document";
import * as serverUtils from "../../../server/utils";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dto-document serializer", () => {
  it("calls getDocumentUrl and maps fields", () => {
    const createdAt = new Date("2022-01-01");
    const doc: any = {
      id: 5,
      type: "ID",
      originalName: "file.pdf",
      s3Key: "bucket/key",
      mimeType: "application/pdf",
      createdAt,
    };

    const out = documentSerializer(doc);
    expect(serverUtils.getDocumentUrl).toHaveBeenCalledWith("bucket/key");
    expect(out.id).toBe(5);
    expect(out.type).toBe("ID");
    expect(out.originalName).toBe("file.pdf");
    expect(out.url).toBe("https://cdn.example/bucket/key");
    expect(out.mimeType).toBe("application/pdf");
    expect(out.createdAt).toBe(createdAt);
  });
});