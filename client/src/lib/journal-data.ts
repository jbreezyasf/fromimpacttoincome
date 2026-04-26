export interface JournalPost {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  readTime: string;
  category: string;
  excerpt: string;
  featured?: boolean;
  body: string;
}

export const journalPosts: JournalPost[] = [
  {
    slug: "impact-and-income-are-not-opposites",
    title: "Impact and Income Are Not Opposites",
    subtitle: "The false choice that keeps founders stuck — and how to stop making it",
    date: "April 22, 2025",
    readTime: "6 min read",
    category: "Mindset",
    featured: true,
    excerpt:
      "Somewhere along the way, we were handed a story: that doing good and doing well are in tension. That if you really care, you can't charge too much. That profit is a concession, not a signal. I stopped believing that story.",
    body: `Somewhere along the way, we were handed a story: that doing good and doing well are in tension. That if you really care, you can't charge too much. That profit is a concession, not a signal. I stopped believing that story.

The founders I admire most — the ones building businesses that last — figured out something early: **impact is not a marketing strategy, and income is not a moral compromise.** They are two sides of the same coin. One funds the other. One proves the other.

## The Scarcity Mindset Trap

When we treat impact and income as competing priorities, we make decisions from scarcity. We undercharge because we feel guilty. We over-deliver because we feel like we have to earn our place. We attract clients who want the mission but resist the price.

This is not sustainable. And it is not noble.

## What I've Learned

The businesses that create the most impact are the ones that are financially healthy enough to keep showing up. A broke founder helps no one. A thriving founder can hire, invest, expand, and give.

Income is the engine. Impact is the direction. You need both.

## The Reframe

Stop asking: "How do I balance impact and income?"

Start asking: "How does my income *amplify* my impact?"

When you answer that question honestly, everything changes. Your pricing becomes a statement of value. Your growth becomes a tool for reach. Your profit becomes a resource for good.

That's the work this journal is about.`,
  },
  {
    slug: "the-founder-who-builds-in-public",
    title: "The Founder Who Builds in Public",
    subtitle: "On transparency, trust, and the courage to show your process",
    date: "April 15, 2025",
    readTime: "5 min read",
    category: "Strategy",
    excerpt:
      "Building in public is not a content strategy. It's a commitment to transparency that, done right, compounds into trust faster than any ad campaign ever could.",
    body: `Building in public is not a content strategy. It's a commitment to transparency that, done right, compounds into trust faster than any ad campaign ever could.

I've been watching founders who share their process — the wins, the pivots, the quiet failures — and something interesting happens. Their audience doesn't just grow. It *deepens*. The people who follow along aren't just consumers; they become invested.

## What "Building in Public" Actually Means

It doesn't mean sharing every number or airing every frustration. It means letting people see the *thinking* behind your decisions. The reasoning. The values that guide your choices.

When you do that, you're not just building a business. You're building a community of people who understand what you're trying to do and why.

## The Trust Compound

Trust compounds slowly, then all at once. Every honest post, every transparent update, every "here's what I got wrong" moment adds a layer. Over time, that trust becomes your most durable competitive advantage.

No one can copy your story. No one can replicate your honesty. That's the moat.

## Start Small

You don't have to share everything. Start with one decision per week: why you made it, what you were weighing, what you'd do differently. That's enough to start building something real.`,
  },
  {
    slug: "pricing-your-purpose",
    title: "Pricing Your Purpose",
    subtitle: "Why undercharging is the most expensive mistake impact-driven founders make",
    date: "April 8, 2025",
    readTime: "7 min read",
    category: "Business",
    excerpt:
      "Every time you undercharge, you're not being humble — you're being unsustainable. And an unsustainable business can't sustain its impact.",
    body: `Every time you undercharge, you're not being humble — you're being unsustainable. And an unsustainable business can't sustain its impact.

I've had this conversation with dozens of founders. They're doing meaningful work. They're good at it. And they're charging half of what they should be. When I ask why, the answers are always some version of the same thing: *"I don't want to seem greedy."* *"My clients are doing good work too."* *"I'm not sure it's worth that much."*

## The Hidden Cost of Undercharging

When you undercharge, you attract clients who are price-sensitive. Price-sensitive clients are often the most demanding, the least trusting, and the quickest to leave. They're not your people.

When you charge what your work is worth, something shifts. You attract clients who value outcomes over cost. Those clients trust you more, refer you more, and stay longer.

## Value Is Not About You

Here's the reframe that changed everything for me: your price is not about what you need. It's about what the outcome is worth to your client.

If your work helps a founder build a business that generates $500K in revenue, what is that worth? If your coaching helps someone make a decision that saves their company, what is that worth?

Price to the value you create. Not to your comfort level.

## The Permission Slip

You are allowed to charge well for work that matters. In fact, you have an obligation to. Because a well-funded mission goes further than a struggling one.`,
  },
  {
    slug: "ai-and-the-founder-edge",
    title: "AI and the Founder Edge",
    subtitle: "How impact-driven founders can use AI without losing their voice",
    date: "April 1, 2025",
    readTime: "8 min read",
    category: "AI & Tools",
    excerpt:
      "AI doesn't replace your perspective. It amplifies it — if you know how to use it. Here's how I think about integrating AI tools without becoming generic.",
    body: `AI doesn't replace your perspective. It amplifies it — if you know how to use it. Here's how I think about integrating AI tools without becoming generic.

The founders who are going to win with AI are not the ones who use it to produce more content faster. They're the ones who use it to think more clearly, move more efficiently, and stay focused on the work only they can do.

## The Amplification Frame

Think of AI as a lever, not a replacement. A lever multiplies force. But you still have to apply the force. Your judgment, your experience, your relationships — those are the force. AI is the lever.

When you use AI to draft, research, or organize, you're freeing up cognitive bandwidth for the decisions that actually require you. That's the edge.

## Where Founders Get It Wrong

The mistake is using AI to generate your voice instead of amplify it. When you let AI write your thoughts, you end up sounding like everyone else who let AI write their thoughts. The signal gets lost in the noise.

Use AI for the scaffolding. Bring yourself to the substance.

## A Practical Framework

1. **Research & synthesis** — let AI gather and organize. You interpret.
2. **First drafts** — let AI start. You finish and make it yours.
3. **Decision support** — let AI model scenarios. You decide.
4. **Execution** — let AI handle the repeatable. You focus on the irreplaceable.

That's the founder edge.`,
  },
];

export function getPostBySlug(slug: string): JournalPost | undefined {
  return journalPosts.find((p) => p.slug === slug);
}
