import { Metadata } from "next";
import AgentCockpit from "@/components/AgentCockpit";

export const metadata: Metadata = {
  title: "Autonomous AI Agent Cockpit | OmniPost Agent",
  description: "Autonomous social media management agent with permission gating, tool transparency, and human-in-the-loop confirmation bounds.",
};

export default function AgentPage() {
  return <AgentCockpit />;
}
