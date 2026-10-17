import { describe, it, expect } from "vitest";
import {
  computeReadiness,
  readinessLine,
  readinessTone,
  mostMissingItems,
  median,
  readinessVsDuration,
} from "./readiness";

/* These tests exist for one reason: readiness arithmetic fails silently.
   A wrong denominator produces a plausible number, not an error, and nobody
   would notice until a decision was made on it. Every case below is a mistake
   this codebase has either made before or could plausibly make. */

const reqs = [
  { item_code: "photo_id",  item_label: "Photo ID",         required: true, sort_order: 0 },
  { item_code: "ssn_card",  item_label: "Social Security card", required: true, sort_order: 1 },
  { item_code: "w2",        item_label: "W-2 forms",        required: true, sort_order: 2 },
  { item_code: "notes",     item_label: "Anything else",    required: false, sort_order: 3 },
];

describe("computeReadiness", () => {
  it("counts only required items", () => {
    const r = computeReadiness(reqs, [{ item_code: "notes", staff_state: "confirmed" }]);
    expect(r.required).toBe(3);
    expect(r.present).toBe(0);
  });

  it("lets the staff verdict override the customer's claim", () => {
    const r = computeReadiness(reqs, [
      { item_code: "photo_id", customer_state: "has", staff_state: "rejected" },
    ]);
    expect(r.present).toBe(0);
    expect(r.missing).toBe(1);
  });

  it("trusts the customer when staff have not looked yet", () => {
    const r = computeReadiness(reqs, [{ item_code: "photo_id", customer_state: "has" }]);
    expect(r.present).toBe(1);
  });

  it("treats silence as unknown, not missing", () => {
    const r = computeReadiness(reqs, []);
    expect(r.missing).toBe(0);
    expect(r.unknown).toBe(3);
  });

  it("returns null ratio when a service has no checklist — never 1", () => {
    // A service with nothing required has NO readiness. Reporting it as 100%
    // would inflate "arrived fully prepared" with unmeasured visits.
    const r = computeReadiness([], []);
    expect(r.ratio).toBeNull();
    expect(r.complete).toBe(false);
  });

  it("is complete only when every required item is present", () => {
    const items = [
      { item_code: "photo_id", staff_state: "confirmed" },
      { item_code: "ssn_card", staff_state: "confirmed" },
      { item_code: "w2",       staff_state: "confirmed" },
    ];
    expect(computeReadiness(reqs, items).complete).toBe(true);
  });
});

describe("readinessLine", () => {
  it("names up to two missing documents, then counts the rest", () => {
    const items = [
      { item_code: "photo_id", staff_state: "confirmed" },
      { item_code: "ssn_card", staff_state: "missing" },
      { item_code: "w2",       staff_state: "rejected" },
    ];
    const line = readinessLine(computeReadiness(reqs, items), reqs, items);
    expect(line).toBe("1 of 3 confirmed · missing: Social Security card, W-2 forms");
  });

  it("says nothing when the service has no requirements", () => {
    expect(readinessLine(computeReadiness([], []), [], [])).toBeNull();
  });
});

describe("readinessTone", () => {
  it("never returns an alarm tone for an unprepared customer", () => {
    const items = [{ item_code: "photo_id", staff_state: "missing" }];
    expect(readinessTone(computeReadiness(reqs, items))).toBe("warn");
  });
});

describe("mostMissingItems", () => {
  it("returns null below the sample threshold rather than a ranking", () => {
    const rows = Array.from({ length: 10 }, () => ({
      item_code: "w2", item_label: "W-2 forms", staff_state: "missing",
    }));
    expect(mostMissingItems(rows, { minSample: 30 })).toBeNull();
  });

  it("ranks by how often an item was actually missing", () => {
    const rows = [
      ...Array.from({ length: 20 }, () => ({ item_code: "w2", item_label: "W-2 forms", staff_state: "missing" })),
      ...Array.from({ length: 15 }, () => ({ item_code: "photo_id", item_label: "Photo ID", staff_state: "confirmed" })),
    ];
    const out = mostMissingItems(rows, { minSample: 30 });
    expect(out[0].item_code).toBe("w2");
    expect(out[0].missing).toBe(20);
  });
});

describe("median", () => {
  it("is the middle value, not the mean — wait times are right-skewed", () => {
    // Mean is 62.1, which matches no individual day. This is the shape of the
    // real baseline problem in docs/baseline-2026-09.md.
    expect(median([18, 27, 41, 47, 209])).toBe(41);
  });

  it("averages the middle pair on even counts", () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it("returns null for no data rather than 0", () => {
    expect(median([])).toBeNull();
  });
});

describe("readinessVsDuration", () => {
  it("refuses to report unless both groups clear the threshold", () => {
    const visits = [
      ...Array.from({ length: 20 }, () => ({ ratio: 1,   serviceMinutes: 20 })),
      ...Array.from({ length: 3  }, () => ({ ratio: 0.5, serviceMinutes: 40 })),
    ];
    expect(readinessVsDuration(visits, { minPerGroup: 15 })).toBeNull();
  });

  it("reports both sample sizes so the claim can be judged", () => {
    const visits = [
      ...Array.from({ length: 16 }, () => ({ ratio: 1,   serviceMinutes: 20 })),
      ...Array.from({ length: 18 }, () => ({ ratio: 0.5, serviceMinutes: 38 })),
    ];
    const out = readinessVsDuration(visits, { minPerGroup: 15 });
    expect(out.differenceMinutes).toBe(18);
    expect(out.nPrepared).toBe(16);
    expect(out.nUnprepared).toBe(18);
  });

  it("ignores visits with no checklist at all", () => {
    const visits = [
      ...Array.from({ length: 16 }, () => ({ ratio: 1,    serviceMinutes: 20 })),
      ...Array.from({ length: 16 }, () => ({ ratio: 0.5,  serviceMinutes: 30 })),
      ...Array.from({ length: 50 }, () => ({ ratio: null, serviceMinutes: 5  })),
    ];
    const out = readinessVsDuration(visits, { minPerGroup: 15 });
    expect(out.nPrepared).toBe(16);
    expect(out.nUnprepared).toBe(16);
  });
});
