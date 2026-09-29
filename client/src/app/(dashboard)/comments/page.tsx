import { Metadata } from "next";
import CommentsInbox from "@/components/CommentsInbox";

export const metadata: Metadata = {
  title: "Comments & Moderation | OmniPost Agent",
  description: "Community moderation, AI intent classification, safe response suggestions, and human escalation workflows.",
};

export default function CommentsPage() {
  return <CommentsInbox />;
}
