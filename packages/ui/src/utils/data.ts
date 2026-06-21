export type NavDropdownItem = {
  name: string
  href: string
  description?: string
}

export type NavItemType = {
  name: string
  href: string
  children?: NavDropdownItem[]
}

export const navItem: NavItemType[] = [
  {
    name: "Features",
    href: "/features",
    children: [
      { name: "AI Studio", href: "/features#ai-studio", description: "Train AI on your YouTube videos" },
      { name: "Script Writing", href: "/features#scripts", description: "Generate scripts in your voice" },
      { name: "Video Ideas", href: "/features#ideation", description: "AI-powered idea generation" },
      { name: "Story Builder", href: "/features#story-builder", description: "Structured story blueprints" },
      { name: "Thumbnails", href: "/features#thumbnails", description: "Eye-catching thumbnail designs" },
      { name: "Subtitles", href: "/features#subtitles", description: "Auto-generate video subtitles" },
    ],
  },
  { name: "Pricing", href: "/pricing" },
  { name: "Blog", href: "/blog" },
  { name: "Contact Us", href: "/contact-us" },
]

type FooterSection = Record<string, { name: string; href: string }[]>

export const footerItems: FooterSection = {
  "Product": [
    { name: "Features", href: "/features" },
    { name: "Pricing", href: "/pricing" },
    { name: "Blog", href: "/blog" },
    { name: "Changelog", href: "/changelog" },
    { name: "FAQ", href: "/#faq" },
    { name: "Contact Us", href: "/contact-us" },
  ],
  "Company": [
    { name: "About Us", href: "/about-us" },
    { name: "Affiliate Program", href: "/affiliate-program" },
    { name: "Referral Program", href: "/referral-program" },
    { name: "Careers", href: "/careers" },
  ],
  "Account": [
    { name: "Login", href: "/login" },
    { name: "Sign Up", href: "/signup" },
  ],
  "Legal": [
    { name: "Terms & Conditions", href: "/terms" },
    { name: "Privacy Policy", href: "/privacy" },
  ],
}

export const issueTypes = [
  { value: "Bug Report", label: "Bug Report" },
  { value: "Feature Request", label: "Feature Request" },
  { value: "Other", label: "Other" },
]
