import { Metadata } from "next";
import ResponseLibrary from "@/components/ResponseLibrary";

export const metadata: Metadata = {
  title: "Response Library | OmniPost Agent",
  description: "Standardized response templates with variable syntax for community engagement.",
};

export default function ResponsesPage() {
  return <ResponseLibrary />;
}
