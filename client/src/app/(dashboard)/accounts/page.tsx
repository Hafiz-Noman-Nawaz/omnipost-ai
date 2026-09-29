import { Metadata } from "next";
import AccountsManager from "@/components/AccountsManager";

export const metadata: Metadata = {
  title: "Connected Accounts | OmniPost Agent",
  description: "Manage connected social platforms and OAuth credentials with AES-256-GCM token security.",
};

export default function AccountsPage() {
  return <AccountsManager />;
}
