import { prisma } from "../client";
import { mustBelongToOrg } from "@omnipost/shared";

/**
 * Organization settings (Phase 1 surface: timezone + master auto-reply switch,
 * spec §18). Web/API layer translates user timezones to IANA names; repository
 * accepts any non-empty string and the API validates before calling.
 */

export async function getSettings(organizationId: string) {
  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
  });
  if (settings) return mustBelongToOrg(settings, organizationId, "Settings");
  return prisma.organizationSettings.create({ data: { organizationId } });
}

export interface UpdateSettingsInput {
  timezone?: string;
  autoReplyMaster?: boolean;
}

export async function updateSettings(organizationId: string, input: UpdateSettingsInput) {
  await getSettings(organizationId); // ensure row exists
  const updated = await prisma.organizationSettings.update({
    where: { organizationId },
    data: {
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.autoReplyMaster !== undefined ? { autoReplyMaster: input.autoReplyMaster } : {}),
    },
  });
  return mustBelongToOrg(updated, organizationId, "Settings");
}
