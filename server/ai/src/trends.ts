export interface TrendingTopic {
  id: string;
  topic: string;
  category: "AI & Tech" | "Marketing & Growth" | "Productivity" | "Creator Economy";
  velocityScore: number; // 0 - 100
  suggestedPostHook: string;
  suggestedDraft: string;
  recommendedPlatforms: ("LINKEDIN" | "X" | "INSTAGRAM")[];
  suggestedHashtags: string[];
}

export function surfaceTrendingTopics(): TrendingTopic[] {
  return [
    {
      id: "trend-1",
      topic: "Autonomous AI Marketing Workflows",
      category: "AI & Tech",
      velocityScore: 96,
      suggestedPostHook: "AI agents aren't replacing marketers—they're eliminating repetitive distribution grunt work.",
      suggestedDraft: "AI agents aren't replacing marketers—they're eliminating repetitive distribution grunt work.\n\nHere is how autonomous scheduling, compliance guardrails, and real-time moderation can save 15+ hours every week.\n\nWhat parts of your social workflow are you automating first?",
      recommendedPlatforms: ["LINKEDIN", "X"],
      suggestedHashtags: ["#AIAgents", "#MarketingAutomation", "#TechTrends"],
    },
    {
      id: "trend-2",
      topic: "Zero-Click Social Content & Native Feeds",
      category: "Marketing & Growth",
      velocityScore: 89,
      suggestedPostHook: "The era of 'link in bio' and link drops is ending.",
      suggestedDraft: "The era of 'link in bio' and link drops is ending.\n\nAlgorithms now heavily favor posts that deliver 100% of the value directly inside the feed without requiring an external click.\n\nHere is the 3-step breakdown for high-retention text and carousels:",
      recommendedPlatforms: ["LINKEDIN", "INSTAGRAM", "X"],
      suggestedHashtags: ["#SocialMediaStrategy", "#ContentMarketing", "#GrowthHacking"],
    },
    {
      id: "trend-3",
      topic: "Multi-Format Repurposing Systems",
      category: "Creator Economy",
      velocityScore: 84,
      suggestedPostHook: "Creating 1 great idea is hard. Repurposing it into 6 formats is pure leverage.",
      suggestedDraft: "Creating 1 great idea is hard. Repurposing it into 6 formats is pure leverage.\n\n1 core insight can easily become:\n• 1 LinkedIn text breakdown\n• 1 X conversation thread\n• 1 visual quote card for Instagram\n• 1 short video hook for TikTok\n\nStop reinventing the wheel every morning.",
      recommendedPlatforms: ["X", "LINKEDIN", "INSTAGRAM"],
      suggestedHashtags: ["#CreatorEconomy", "#ContentOps", "#OmniPost"],
    },
  ];
}
