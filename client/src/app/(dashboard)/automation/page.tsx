import { Metadata } from "next";
import AutomationManager from "@/components/AutomationManager";

export const metadata: Metadata = {
  title: "Automation Rules & Kill-Switch | OmniPost Agent",
  description: "Prioritized automation rules, community auto-replies, and master kill-switch controls.",
};

export default function AutomationPage() {
  return <AutomationManager />;
}
