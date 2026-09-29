import { getSocialAccount, disconnectSocialAccount } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const account = await getSocialAccount(ctx, id);

    return ok(account);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const { id } = await params;
    const disconnected = await disconnectSocialAccount(ctx, id);

    return ok(disconnected);
  } catch (err) {
    return fail(err);
  }
}
