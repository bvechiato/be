import { describe, it, expect, vi, beforeEach } from "vitest";
import { DealType, VolunteerFormData, DocumentStatusType, LangProficiency } from "need4deed-sdk";

vi.mock("../../../data/utils", () => {
  return {
    getRRULE: vi.fn((day: string) => `RRULE-${day}`),
    getStartEnd: vi.fn((range: string) => ({
      start: new Date("2020-01-01T09:00:00.000Z"),
      end: new Date("2020-01-01T12:00:00.000Z"),
    })),
  };
});

vi.mock("../../../server/utils", () => {
  const getPostcode = vi.fn(async (pc: string) => `pc-${pc}`);

  const getProfileEntityByTitle = vi.fn(async (...args: any[]) => {
    const [title, , , , key] = args;
    // return shape expected by dealParser for district (key === "district")
    if (key === "district") return { district: title };
    // default: return simple object (languages/activities/skills)
    return { gotTitle: title };
  });

  const getTimeslot = vi.fn(async (opts: any) => ({ ...opts, id: "mock-timeslot" }));

  return { getPostcode, getProfileEntityByTitle, getTimeslot };
});

import { dealParser } from "../../../services/dto/dealParser";
import * as serverUtils from "../../../server/utils";
import * as dataUtils from "../../../data/utils";

const defaultForm = (): Partial<VolunteerFormData> => ({
  fullName: "John Doe",
  phone: "1234567890",
  email: "email@example.com",
  postcode: 12345,
  goodConductCertificate: DocumentStatusType.YES,
  measlesVaccination: DocumentStatusType.YES,
  leadFrom: ["Lead1"],
  comments: "No comments",
});

function buildForm(overrides: Partial<VolunteerFormData> = {}): VolunteerFormData {
  return { ...(defaultForm() as VolunteerFormData), ...(overrides as any) };
}

function expectBasicDealAssertions(deal: any, postcodeStr = "12345") {
  expect(serverUtils.getPostcode).toHaveBeenCalledTimes(1);
  expect((serverUtils.getPostcode as any).mock.calls[0][0]).toBe(postcodeStr);
  expect(deal.type).toBe(DealType.VOLUNTEER);
  expect(deal.postcode).toBe(`pc-${postcodeStr}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("services/dto/dealParser", () => {
  it("parses full form and calls helpers correctly", async () => {
    const formData = buildForm({
      activities: ["Act1"],
      skills: ["Skill1"],
      languages: [{ id: 1, title: "en", proficiency: LangProficiency.INTERMEDIATE } as any],
      schedule: [
        [1, "09:00-12:00"],
        [null, "OCCASIONAL"],
      ],
      districts: ["Reinickendorf"],
    });

    const deal = await dealParser(formData);

    expectBasicDealAssertions(deal, "12345");

    // profile entity lookups (activities, skills, languages, district)
    expect(serverUtils.getProfileEntityByTitle).toHaveBeenCalledTimes(4);
    const titles = (serverUtils.getProfileEntityByTitle as any).mock.calls.map((c: any[]) => c[0]);
    expect(titles).toEqual(expect.arrayContaining(["Act1", "Skill1", "en", "Reinickendorf"]));

    // language mutated with proficiency and present in profile
    expect(deal.profile).toBeDefined();
    expect(deal.profile.profileLanguage).toHaveLength(1);
    expect(deal.profile.profileLanguage[0].proficiency).toBe(LangProficiency.INTERMEDIATE);

    // timeslots: day-based -> rrule + start/end ; occasional -> occasional
    expect(serverUtils.getTimeslot).toHaveBeenCalledTimes(2);
    expect((dataUtils.getStartEnd as any)).toHaveBeenCalledWith("09:00-12:00");
    expect((dataUtils.getRRULE as any)).toHaveBeenCalledWith("Monday");

    expect(deal.time.timeTimeslot).toHaveLength(2);
    const firstTs = deal.time.timeTimeslot[0].timeslot;
    expect(firstTs.id).toBe("mock-timeslot");
    expect(firstTs.rrule).toBe("RRULE-Monday");
    expect(firstTs.start).toBeInstanceOf(Date);
    const secondTs = deal.time.timeTimeslot[1].timeslot;
    expect(secondTs.id).toBe("mock-timeslot");
    expect(secondTs.occasional).toBe("OCCASIONAL");

    // location/districts
    expect(deal.location.locationDistrict).toHaveLength(1);
    expect(deal.location.locationDistrict[0].district).toBe("Reinickendorf");
  });

  it("handles multiple activities/skills/languages/districts", async () => {
    const formData = buildForm({
      postcode: 99999,
      activities: ["A1", "A2"],
      skills: ["S1", "S2"],
      languages: [{ title: "de", proficiency: 1 }, { title: "en", proficiency: 2 }],
      schedule: [],
      districts: ["D1", "D2"],
    });

    const deal = await dealParser(formData);
    // 2 activities + 2 skills + 2 languages + 2 districts => 8 lookups
    expect(serverUtils.getProfileEntityByTitle).toHaveBeenCalledTimes(8);
    expect(deal.profile.profileActivity).toHaveLength(2);
    expect(deal.profile.profileSkill).toHaveLength(2);
    expect(deal.profile.profileLanguage).toHaveLength(2);
    expect(deal.location.locationDistrict).toHaveLength(2);
  });

  it("skips null profile entities and doesn't push them", async () => {
    // make getProfileEntityByTitle return null for the skill entry only
    (serverUtils.getProfileEntityByTitle as any)
      .mockImplementationOnce(async (t: any) => ({ gotTitle: t })) // activity
      .mockImplementationOnce(async () => null) // skill missing -> should be skipped
      .mockImplementationOnce(async (t: any) => ({ gotTitle: t })) // language
      .mockImplementationOnce(async (t: any) => ({ district: t })); // district

    const formData = buildForm({
      postcode: 11111,
      activities: ["Act1"],
      skills: ["Skill1"],
      languages: [{ id: 1, title: "en", proficiency: LangProficiency.NATIVE }],
      schedule: [],
      districts: ["Dist1"],
    });

    const deal = await dealParser(formData);

    expect(serverUtils.getProfileEntityByTitle).toHaveBeenCalledTimes(4);
    expect(deal.profile.profileActivity).toHaveLength(1);
    expect(deal.profile.profileSkill).toHaveLength(0);
    expect(deal.profile.profileLanguage).toHaveLength(1);
    expect(deal.location.locationDistrict).toHaveLength(1);
  });

  it.each([
    [1, "Monday"],
    [2, "Tuesday"],
    [3, "Wednesday"],
    [4, "Thursday"],
    [5, "Friday"],
    [6, "Saturday"],
    [7, "Sunday"],
  ])("maps day %i to RRULE-%s", async (dayNum, dayName) => {
    const formData = buildForm({ postcode: 55555, schedule: [[dayNum, "09:00-10:00"]] });
    await dealParser(formData);
    expect((dataUtils.getRRULE as any)).toHaveBeenCalledWith(dayName);
    expect(serverUtils.getTimeslot).toHaveBeenCalled();
  });

  it("treats day = 0 as falsy (occasional) and passes occasional to getTimeslot", async () => {
    const formData = buildForm({ postcode: 22222, schedule: [[0, "OCCASIONAL"]] });
    const deal = await dealParser(formData);
    expect(serverUtils.getTimeslot).toHaveBeenCalledTimes(1);
    const tsArg = (serverUtils.getTimeslot as any).mock.calls[0][0];
    expect(tsArg.occasional).toBe("OCCASIONAL");
    expect(dataUtils.getStartEnd).not.toHaveBeenCalled();
    expect(dataUtils.getRRULE).not.toHaveBeenCalled();
    expect(deal.time.timeTimeslot).toHaveLength(1);
  });

  it("handles empty/partial form without throwing and minimises helper calls", async () => {
    const deal = await dealParser({} as any);
    expect(serverUtils.getPostcode).toHaveBeenCalledTimes(1);
    expect(serverUtils.getPostcode).toHaveBeenCalledWith("undefined");
    expect(serverUtils.getProfileEntityByTitle).not.toHaveBeenCalled();
    expect(serverUtils.getTimeslot).not.toHaveBeenCalled();
    expect(deal).toBeDefined();
  });
});