import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiVolunteerGet, LangProficiency } from "need4deed-sdk";

vi.mock("../../../services/dto/utils", () => ({
  getAvailability: vi.fn(() => ({ avail: true })),
  getLanguages: vi.fn(() => [{ id: 1, title: "en", proficiency: LangProficiency.ADVANCED }]),
  getOptionItems: vi.fn((items: any[]) => items.map((_, i) => ({ id: i + 1 }))),
  getTitles: vi.fn((items: any[]) => items.map((it: any) => (it?.activity?.title || it?.skill?.title || it?.district?.title || ""))),
}));

vi.mock("../../../server", () => ({
  fastify: { log: { error: vi.fn() } },
}));

import { volunteerListSerializer, volunteerSerializer } from "../../../services/dto/dto-volunteer";
import * as dtoUtils from "../../../services/dto/utils";
import { fastify } from "../../../server";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dto-volunteer serializer", () => {
  it("returns aggregated fields and calls helpers", () => {
    const volunteer: any = {
      id: 11,
      statusEngagement: "eng",
      statusType: "type",
      person: { name: "Alice", avatarUrl: null },
      deal: {
        profile: {
          profileLanguage: [{ language: { id: 1, title: "en" } }],
          profileActivity: [{ activity: { title: "ActA" } }],
          profileSkill: [{ skill: { title: "SkillA" } }],
        },
        time: { timeTimeslot: [{ timeslot: {} }] },
        location: { locationDistrict: [{ district: { title: "DistA" } }] },
      },
    };

    const result = volunteerListSerializer(volunteer);

    expect(dtoUtils.getLanguages).toHaveBeenCalledWith(volunteer.deal.profile.profileLanguage);
    expect(dtoUtils.getAvailability).toHaveBeenCalledWith(volunteer.deal.time?.timeTimeslot);
    expect(dtoUtils.getTitles).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.id).toBe(11);
    expect(result.name).toBe("Alice");
    expect(result.avatarUrl).toBeNull();
    expect(result.languages).toEqual([{ id: 1, title: "en", proficiency: LangProficiency.ADVANCED }]);
    expect(result.availability).toEqual({ avail: true });
  });

  it("maps address, comments and timeline correctly and uses helpers", () => {
    const volunteer: any = {
      id: 22,
      person: {
        id: 5,
        email: "a@b",
        firstName: "F",
        lastName: "L",
        middleName: "M",
        phone: "P",
        avatarUrl: null,
        address: {
          id: 50,
          street: "St",
          postcode: { id: 60, value: "12345", latitude: 52.5, longitude: 13.4 },
        },
      },
      preferredCommunicationType: "email",
      statusCGC: true,
      infoAbout: "about",
      infoExperience: "exp",
      statusVaccination: false,
      createdAt: new Date("2020-01-01"),
      updatedAt: new Date("2020-01-02"),
      deal: {
        profile: {
          profileActivity: [{ activity: { id: 1 } }],
          profileSkill: [{ skill: { id: 2 } }],
          profileLanguage: [{ language: { id: 1, title: "en" }, proficiency: LangProficiency.ADVANCED }],
        },
        time: { timeTimeslot: [{ timeslot: {} }] },
        location: { locationDistrict: [{ district: { id: 9 } }] },
      },
      statusEngagement: "E",
      statusCommunication: "C",
      statusAppreciation: "A",
      statusType: "T",
      statusMatch: "M",
      statusCgcProcess: "P",
      dateReturn: null,
    };

    const comments = [
      { id: 101, updatedAt: new Date("2021-01-01"), text: "hello", user: { person: { name: "Bob" } } },
    ];
    const timeline = [{ id: 201, timestamp: new Date("2021-02-01"), content: "log" }];

    const result: ApiVolunteerGet = volunteerSerializer(volunteer, comments as any, timeline as any);

    // address/postcode mapping
    expect(result.person.address).toBeDefined();
    expect(result.person.address?.postcode.code).toBe("12345");
    expect(result.person.address?.postcode.latitude).toBe(52.5);
    expect(result.person.address?.postcode.longitude).toBe(13.4);

    // comments mapping
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].authorName).toBe("Bob");
    expect(result.comments[0].content).toBe("hello");

    // timeline logs authorName is blank
    expect(result.timelineLogs).toHaveLength(1);
    expect(result.timelineLogs[0].authorName).toBe("");
    expect(result.timelineLogs[0].content).toBe("log");

    // helpers used for options, languages, availability
    expect(dtoUtils.getOptionItems).toHaveBeenCalled();
    expect(dtoUtils.getLanguages).toHaveBeenCalled();
    expect(dtoUtils.getAvailability).toHaveBeenCalled();
  });

  it("logs and returns undefined on error from helper", () => {
    (dtoUtils.getLanguages as any).mockImplementationOnce(() => { throw new Error("boom"); });

    const incompleteVolunteer: any = {
      id: 99,
      person: { name: "X" },
      deal: { profile: { profileLanguage: [] }, time: {}, location: {} },
      statusEngagement: "E",
      statusType: "T",
    };

    const res = volunteerListSerializer(incompleteVolunteer);
    expect(res).toBeUndefined();
    expect(fastify.log.error).toHaveBeenCalled();
  });
});