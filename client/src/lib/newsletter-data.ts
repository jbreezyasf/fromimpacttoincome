export interface NewsletterIssue {
  issue: string;
  slug: string;
  title: string;
  date: string;
  preview: string;
  body: string;
}

export const newsletterIssues: NewsletterIssue[] = [
  {
    issue: "001",
    slug: "001",
    title: "Welcome to the Inner Circle",
    date: "April 22, 2025",
    preview: "Why I started this, what you can expect, and the one question every impact-driven founder needs to answer.",
    body: `# Welcome to the AI Junkies Inner Circle

Hey — I'm glad you're here.

This newsletter is for the founders who are building something that matters and figuring out how to make it pay. Not because profit is the goal, but because sustainability is the prerequisite.

## Why This Exists

I started *From Impact to Income* because I kept having the same conversation. Smart, driven founders — people doing genuinely important work — who were struggling to translate that work into income. Not because their work wasn't valuable. Because they hadn't figured out how to communicate that value, price it right, or build the systems to sustain it.

This newsletter is the conversation I wish I'd had earlier.

## What to Expect

Every issue, I'll share:
- **One idea** worth sitting with
- **One tool or framework** you can use this week
- **One honest reflection** from the trenches

No fluff. No filler. Just signal.

## The Question

Here's the one question I want you to sit with this week:

*If your business disappeared tomorrow, who would miss it — and why?*

The answer to that question is your impact. The reason they'd pay to keep it around is your income. Everything else is details.

More soon.`,
  },
  {
    issue: "002",
    slug: "002",
    title: "The Leverage Points Nobody Talks About",
    date: "April 29, 2025",
    preview: "Three places where small changes in how you operate produce outsized results — and why most founders ignore them.",
    body: `# The Leverage Points Nobody Talks About

Most founders are working harder than they need to. Not because they're inefficient — because they're working on the wrong things.

This week, I want to talk about leverage. Specifically, the three leverage points that most impact-driven founders overlook.

## 1. Your Positioning Statement

Most founders describe what they do. The best founders describe what changes because of what they do.

"I help founders build businesses" is a description. "I help founders stop trading time for money" is a transformation. The second one attracts people who are ready to change. The first attracts everyone — which means it attracts no one in particular.

**This week:** Rewrite your one-liner as a transformation, not a description.

## 2. Your Client Selection Criteria

You can't serve everyone well. The founders who try end up serving no one exceptionally. Your criteria for who you work with is a leverage point — it determines the quality of your results, your referrals, and your reputation.

**This week:** Write down the three characteristics of your best clients. Then ask: are you actively selecting for those characteristics?

## 3. Your Follow-Up System

Most income is lost not in the pitch, but in the follow-up. Founders who have a consistent, warm follow-up system close significantly more than those who don't — not because they're more persuasive, but because they stay in the conversation.

**This week:** Build a simple 3-touch follow-up sequence for every warm lead.

Small changes. Outsized results. That's leverage.`,
  },
];

export function getIssueBySlug(slug: string): NewsletterIssue | undefined {
  return newsletterIssues.find((i) => i.slug === slug);
}
