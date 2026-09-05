import { describe, it, expect } from "vitest";
import { isMissingColumnError, isDriftError, isMissingTableError } from "../src/lib/db-drift";

describe("isMissingColumnError — production-drift codes", () => {
	it("detects the Prisma 'column does not exist in the current database' message", () => {
		const err = new Error("The column `Reminder.stageId` does not exist in the current database.");
		expect(isMissingColumnError(err)).toBe(true);
	});

	it("detects PostgreSQL 42703 (undefined_column)", () => {
		const err = new Error("error: column \"stage_id\" does not exist (42703)");
		expect(isMissingColumnError(err)).toBe(true);
	});

	it("detects PostgreSQL 42704 (undefined_object) — missing enum type", () => {
		// This is the production error: the MilestoneStatus enum was missing.
		const err = new Error(`type "public.MilestoneStatus" does not exist (42704)`);
		expect(isMissingColumnError(err)).toBe(true);
	});

	it("detects PostgreSQL 42P01 (undefined_table)", () => {
		const err = new Error(`relation "InvoiceReminderSuppression" does not exist (42P01)`);
		expect(isMissingColumnError(err)).toBe(true);
	});

	it("ignores unrelated errors", () => {
		expect(isMissingColumnError(new Error("Network timeout"))).toBe(false);
		expect(isMissingColumnError("string error")).toBe(false);
		expect(isMissingColumnError(null)).toBe(false);
		expect(isMissingColumnError(undefined)).toBe(false);
	});
});

describe("isDriftError — superset of drift predicates", () => {
	it("returns true for any drift class", () => {
		expect(isDriftError(new Error("The column Foo.bar does not exist in the current database."))).toBe(true);
		expect(isDriftError(new Error("type \"public.Bar\" does not exist (42704)"))).toBe(true);
		expect(isDriftError(new Error("invalid input value for enum: BOGUS (22P02)"))).toBe(true);
	});

	it("returns false for unrelated errors", () => {
		expect(isDriftError(new Error("Foreign key constraint violated"))).toBe(false);
		expect(isDriftError(null)).toBe(false);
	});
});

describe("isMissingTableError — table-level drift", () => {
	it("detects Prisma 'does not exist in the current database'", () => {
		const err = new Error("The table `public.InvoiceReminderSuppression` does not exist in the current database.");
		expect(isMissingTableError(err)).toBe(true);
	});

	it("detects 42P01", () => {
		const err = new Error(`relation "X" does not exist (42P01)`);
		expect(isMissingTableError(err)).toBe(true);
	});
});
