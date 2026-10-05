/**
 * Certificate Themes & Design Presets for Train AI & Sara Foundation
 * 4 Creative, High-End Templates:
 *  1. CYBER_NEON: Modern futuristic dark theme with cyan & neon gold circuitry
 *  2. CLASSIC_ACADEMIC: Regal ivory parchment with ornate guilloché border & gold foil seal
 *  3. MINIMAL_LUXE: Swiss corporate elegance with deep sapphire accents & QR verification
 *  4. FUTURE_INNOVATOR: Dynamic mesh aurora gradient with holographic laurel & skill badges
 */

export const CERTIFICATE_THEMES = {
  cyber_neon: {
    id: "cyber_neon",
    name: "Cyber Neon / Modern Tech",
    subtitle: "Dark obsidian canvas with glowing cyan & metallic gold accents",
    bg: "#080C16",
    cardBg: "linear-gradient(135deg, #090E1A 0%, #0F172A 50%, #070B14 100%)",
    textColor: "#F8FAFC",
    accentColor: "#38BDF8",
    goldColor: "#F59E0B",
    borderColor: "#1E293B",
    sealType: "neon_hologram",
    signatureFont: "'Caveat', 'Dancing Script', cursive, sans-serif",
    borderPattern: "circuit",
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
    tagline: "VERIFIED AI & TECHNOLOGY MASTERY"
  },
  classic_academic: {
    id: "classic_academic",
    name: "Classic Academic & Executive",
    subtitle: "Parchment ivory with ornate guilloché borders & engraved gold seal",
    bg: "#FCFAF7",
    cardBg: "radial-gradient(ellipse at center, #FFFFFF 0%, #FAF6EE 70%, #F5EFE0 100%)",
    textColor: "#1C1917",
    accentColor: "#854D0E",
    goldColor: "#D97706",
    borderColor: "#D6D3D1",
    sealType: "gold_embossed",
    signatureFont: "'Great Vibes', 'Allura', cursive, serif",
    borderPattern: "ornate",
    fontFamily: "'Playfair Display', Georgia, serif",
    tagline: "DIPLOMA OF COMPREHENSIVE CURRICULUM MASTERY"
  },
  minimal_luxe: {
    id: "minimal_luxe",
    name: "Corporate Prestige / Minimal Luxe",
    subtitle: "High-contrast alpine white with royal sapphire ribbon & verified QR tile",
    bg: "#FFFFFF",
    cardBg: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
    textColor: "#0F172A",
    accentColor: "#2563EB",
    goldColor: "#F59E0B",
    borderColor: "#E2E8F0",
    sealType: "emerald_shield",
    signatureFont: "'Sacramento', 'Dancing Script', cursive",
    borderPattern: "geometric",
    fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
    tagline: "PROFESSIONAL CREDENTIAL OF EXCELLENCE"
  },
  future_innovator: {
    id: "future_innovator",
    name: "Creative Aurora / Future Innovator",
    subtitle: "Vibrant aurora gradient glow with glassmorphism & holographic laurel",
    bg: "#0B0F19",
    cardBg: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #311042 100%)",
    textColor: "#FFFFFF",
    accentColor: "#A855F7",
    goldColor: "#EC4899",
    borderColor: "rgba(255,255,255,0.15)",
    sealType: "aurora_laurel",
    signatureFont: "'Satisfy', 'Caveat', cursive",
    borderPattern: "modern_aurora",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    tagline: "INNOVATION & SKILL ATTAINMENT CITATION"
  }
};

export const COLOR_PALETTES = [
  { name: "Sara Foundation Royal Blue", primary: "#2563EB", accent: "#38BDF8", gold: "#F59E0B" },
  { name: "Executive Emerald", primary: "#059669", accent: "#34D399", gold: "#FBBF24" },
  { name: "Cyberpunk Violet", primary: "#7C3AED", accent: "#C084FC", gold: "#F472B6" },
  { name: "Imperial Gold & Ruby", primary: "#991B1B", accent: "#F87171", gold: "#D97706" },
  { name: "Obsidian Titanium", primary: "#0F172A", accent: "#64748B", gold: "#E2E8F0" }
];

export const SIGNATURE_PRESETS = [
  { id: "sig_1", name: "Executive Script (Dr. E. Sara)", style: "'Great Vibes', cursive", sample: "Inem Emmanuel" },
  { id: "sig_2", name: "Calligraphy Flourish", style: "'Dancing Script', cursive", sample: "Academic Director" },
  { id: "sig_3", name: "Modern Brush Signature", style: "'Caveat', cursive", sample: "Sara Foundation" },
  { id: "sig_4", name: "Formal Engraved", style: "'Satisfy', cursive", sample: "Chief Learning Officer" }
];

/**
 * Safely parse or construct template customization parameters
 */
export function parseCertificateTemplate(templateObj) {
  const defaultValues = {
    themeId: "cyber_neon",
    title: "Certificate of Completion",
    orgName: "Sara Foundation",
    orgSubtitle: "Global AI Learning & Workforce Development Initiative",
    presentationText: "This officially certifies that",
    completionStatement: "has demonstrated verified proficiency and successfully completed the comprehensive curriculum and rigorous practical assessments for",
    courseTitle: "",
    honorsText: "",
    badgeLabel: "VERIFIED CREDENTIAL",
    sealText: "OFFICIAL",
    footerNote: "Accredited by Train AI & Global Industry Standards",
    signatoryName: "Inem Emmanuel",
    signatoryTitle: "Director of Academic Excellence",
    secondarySignatoryName: "Sara Foundation Authority",
    secondarySignatoryTitle: "Registrar & Certification Officer",
    signatureStyle: "sig_1",
    primaryColor: "#2563EB",
    accentColor: "#38BDF8",
    goldColor: "#F59E0B",
    sealType: "gold_embossed",
    passingScorePct: 70,
    requiresApproval: false,
    watermarkEnabled: true,
    showQrVerification: true,
  };

  if (!templateObj) return defaultValues;

  let parsedCustom = {};
  if (templateObj.template_text) {
    try {
      parsedCustom = typeof templateObj.template_text === "string" 
        ? JSON.parse(templateObj.template_text) 
        : templateObj.template_text;
    } catch {
      parsedCustom = {};
    }
  }

  return {
    ...defaultValues,
    ...parsedCustom,
    title: templateObj.title || parsedCustom.title || defaultValues.title,
    presentationText: parsedCustom.presentationText || defaultValues.presentationText,
    completionStatement: parsedCustom.completionStatement || defaultValues.completionStatement,
    honorsText: parsedCustom.honorsText || defaultValues.honorsText,
    badgeLabel: parsedCustom.badgeLabel || defaultValues.badgeLabel,
    sealText: parsedCustom.sealText || defaultValues.sealText,
    footerNote: parsedCustom.footerNote || defaultValues.footerNote,
    passingScorePct: templateObj.passing_score_pct ?? parsedCustom.passingScorePct ?? 70,
    requiresApproval: templateObj.requires_admin_approval ?? parsedCustom.requiresApproval ?? false,
  };
}
