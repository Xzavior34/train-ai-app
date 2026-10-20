export const CREDIT_PACKAGES = [
  {
    id: "starter",
    credits: 50,
    label: "Starter",
    tagline: "Essential AI simulations & code reviews",
    features: ["50 AI Tutor Queries", "Automated Code Analysis", "Instant credit allocation", "Never expires"],
    priceUSD: 5,
    priceNGN: 7500,
    priceGBP: 4,
    priceEUR: 4.5
  },
  {
    id: "pro",
    credits: 200,
    label: "Pro",
    highlight: true,
    tagline: "Most popular for active career learners",
    features: ["200 AI Tutor Queries", "Full Mock Technical Interviews", "Live Project Feedback", "Priority AI model response", "Never expires"],
    priceUSD: 15,
    priceNGN: 22000,
    priceGBP: 12,
    priceEUR: 14
  },
  {
    id: "team",
    credits: 600,
    label: "Power Learner",
    badge: "BEST VALUE",
    tagline: "Comprehensive career track mastery",
    features: ["600 AI Tutor Queries", "Unlimited Interview Simulations", "Deep Architectural Reviews", "Portfolio & Resume AI Polish", "Never expires"],
    priceUSD: 35,
    priceNGN: 50000,
    priceGBP: 28,
    priceEUR: 32
  },
];

export function creditPurchase(metadata, amount, currency) {
 const pkg = CREDIT_PACKAGES.find(item => item.id === metadata?.package || (!metadata?.package && item.credits === Number(metadata?.credits_to_add)));
 const price = pkg?.["price" + String(currency).toUpperCase()];
 if (!pkg || !Number.isFinite(Number(amount)) || !price || Math.round(Number(amount)*100) !== Math.round(price*100)) throw new Error("Payment does not match a configured credit package.");
 return { package: pkg.id, credits_to_add: pkg.credits };
}
