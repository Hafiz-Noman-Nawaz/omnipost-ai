import { Metadata } from "next";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Honest Metrics & Analytics | OmniPost Agent",
  description: "Authentic multi-channel social analytics, grounded AI performance intelligence, and platform capability transparency.",
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
