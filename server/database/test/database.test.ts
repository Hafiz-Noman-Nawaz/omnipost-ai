import { describe, it, expect } from "vitest";
import { prisma, createPrismaClient } from "../src";

describe("Database Client & Schema Types", () => {
  it("should export prisma instance and factory", () => {
    expect(prisma).toBeDefined();
    expect(createPrismaClient).toBeInstanceOf(Function);
  });
});
