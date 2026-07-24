"use client"

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Footer from "@/components/footer";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar";
import { useSmoothScroll } from "@/hooks/useSmoothScroll"

const sections = [
  { id: "overview", title: "1. Overview & Acceptance" },
  { id: "eligibility", title: "2. Eligibility" },
  { id: "prohibited-uses", title: "3. Prohibited Uses" },
  { id: "user-responsibilities", title: "4. User Responsibilities" },
  { id: "subscriptions-refunds", title: "5. Subscriptions & Billing" },
  { id: "disputes-chargebacks", title: "6. Disputes & Chargebacks" },
  { id: "intellectual-property", title: "7. Intellectual Property" },
  { id: "ai-disclaimer", title: "8. AI Output Disclaimer" },
  { id: "limitation-liability", title: "9. Limitation of Liability" },
  { id: "indemnification", title: "10. Indemnification" },
  { id: "governing-law", title: "11. Governing Law" },
  { id: "policy-changes", title: "12. Changes to Terms" },
  { id: "contact", title: "13. Contact" },
]

const TermsPage = () => {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<string>("overview")
  const rafIdRef = useRef<number>(0)

  useSmoothScroll();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3
      let currentSection = ""
      sections.forEach((section) => {
        const element = document.getElementById(section.id)
        if (element && element.offsetTop <= scrollPosition) {
          currentSection = section.id
        }
      })
      setActiveSection(currentSection)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="bg-gradient-to-b from-purple-50 to-white text-slate-800 min-h-screen">
      <LandingPageNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-purple-600 transition-colors font-medium mb-16 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back
          </button>

          <h1 className="text-4xl md:text-5xl font-bold text-center mb-16 text-slate-900 w-full">
            Terms & Conditions
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-12">
          <aside className="hidden lg:block">
            <nav className="sticky top-20 mb-8">
              <ul className="space-y-3">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={cn(
                        "block text-sm transition-colors duration-300",
                        activeSection === section.id
                          ? "text-purple-600 font-semibold"
                          : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <main className="lg:col-span-3 space-y-12">
            <PolicySection id="overview" title="1. Overview & Acceptance">
              <p>
                Creator AI is a subscription-based AI SaaS platform that provides automated
                content generation tools for creators. By accessing or using our service,
                you agree to be bound by these Terms.
              </p>
              <p>
                If you do not agree, you must stop using the service immediately.
              </p>
            </PolicySection>

            <PolicySection id="eligibility" title="2. Eligibility">
              <p>
                You must be at least 13 years old (or the minimum age required in your
                country) to use Creator AI. By using the service, you confirm that you meet
                this requirement.
              </p>
            </PolicySection>

            <PolicySection id="prohibited-uses" title="3. Prohibited Uses">
              <p>You may NOT use Creator AI to create or share content that:</p>
              <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                <li>Is sexually explicit, pornographic, or NSFW</li>
                <li>Promotes violence, hate speech, or harassment</li>
                <li>Is illegal or encourages illegal activity</li>
                <li>Infringes on someone else's intellectual property</li>
                <li>Impersonates individuals or organizations</li>
                <li>Spreads misinformation or fraud</li>
              </ul>
              <p>
                Breaking these rules may result in immediate suspension or permanent ban.
              </p>
            </PolicySection>

            <PolicySection id="user-responsibilities" title="4. User Responsibilities">
              <p>
                You are responsible for reviewing and editing any AI-generated content before
                publishing it.
              </p>
              <p>
                You agree not to misuse the platform or try to bypass rate limits,
                subscription tiers, or security measures.
              </p>
            </PolicySection>

            <PolicySection id="subscriptions-refunds" title="5. Subscriptions & Billing">
              <p>
                Creator AI runs on a recurring subscription model. Payments are processed
                through third-party providers.
              </p>
              <p>
                Subscription fees are non-refundable except where required by law. Canceling
                your plan stops future charges but does not trigger a refund for the current
                billing period.
              </p>
            </PolicySection>

            <PolicySection id="disputes-chargebacks" title="6. Disputes & Chargebacks">
              <p>
                If you have a billing issue, please contact us before initiating a
                chargeback with your bank.
              </p>
              <p>
                Fraudulent chargebacks may result in account suspension and collection
                actions.
              </p>
            </PolicySection>

            <PolicySection id="intellectual-property" title="7. Intellectual Property">
              <p>
                You keep ownership of everything you input and everything the AI generates
                for you, as long as you follow these Terms.
              </p>
              <p>
                Creator AI owns all platform technology, algorithms, branding, and
                infrastructure.
              </p>
            </PolicySection>

            <PolicySection id="ai-disclaimer" title="8. AI Output Disclaimer">
              <p>
                AI-generated content may contain inaccuracies. We don't guarantee
                originality, factual correctness, or suitability for any specific purpose.
              </p>
              <p>
                You are fully responsible for how you use the generated content.
              </p>
            </PolicySection>

            <PolicySection id="limitation-liability" title="9. Limitation of Liability">
              <p>
                To the maximum extent allowed by law, Creator AI is not liable for indirect,
                incidental, consequential, or special damages.
              </p>
              <p>
                Our total liability is limited to the amount you paid us in the previous 3
                months.
              </p>
            </PolicySection>

            <PolicySection id="indemnification" title="10. Indemnification">
              <p>
                You agree to protect and hold harmless Creator AI from any claims that come
                from your use of the service, violation of these Terms, or infringement of
                third-party rights.
              </p>
            </PolicySection>

            <PolicySection id="governing-law" title="11. Governing Law">
              <p>
                These Terms are governed by applicable international laws. Any disputes will
                be resolved in the appropriate jurisdiction.
              </p>
            </PolicySection>

            <PolicySection id="policy-changes" title="12. Changes to Terms">
              <p>
                We may update these Terms from time to time. If you keep using Creator AI
                after changes are made, that means you accept the updated Terms.
              </p>
            </PolicySection>

            <PolicySection id="contact" title="13. Contact">
              <p>
                Have questions about these Terms? Visit our{" "}
                <Link
                  href="/contact-us"
                  className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors"
                >
                  Contact Us
                </Link>{" "}
                page or email us at{" "}
                <Link
                  href="mailto:support@tryscriptai.com"
                  className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors"
                >
                  support@tryscriptai.com
                </Link>
              </p>
            </PolicySection>
          </main>
        </div>
      </div>
      <Footer />
    </div>
  )
}

const PolicySection = ({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) => (
  <section id={id} className="scroll-mt-20">
    <h2 className="text-2xl font-bold text-slate-900 mb-4">{title}</h2>
    <div className="text-slate-600 leading-relaxed space-y-4">{children}</div>
  </section>
)

export default TermsPage
