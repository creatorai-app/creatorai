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
  { id: "overview", title: "1. Overview" },
  { id: "data-collection", title: "2. Data We Collect" },
  { id: "data-usage", title: "3. How We Use Your Data" },
  { id: "storage-security", title: "4. Data Storage & Security" },
  { id: "third-party", title: "5. Third-Party Processors" },
  { id: "data-retention", title: "6. Data Retention" },
  { id: "your-rights", title: "7. Your Rights" },
  { id: "cookies", title: "8. Cookies" },
  { id: "children", title: "9. Children's Privacy" },
  { id: "policy-changes", title: "10. Changes to This Policy" },
  { id: "contact", title: "11. Contact" },
]

const PrivacyPage = () => {
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
            Privacy Policy
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
            <PolicySection id="overview" title="1. Overview">
              <p>
                Creator AI ("we", "our", "us") is committed to protecting your privacy. This
                Privacy Policy explains what data we collect, how we use it, and your rights
                regarding your personal information.
              </p>
              <p>
                By using Creator AI, you agree to the collection and use of information as
                described in this policy.
              </p>
            </PolicySection>

            <PolicySection id="data-collection" title="2. Data We Collect">
              <p>We collect the following types of information:</p>
              <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                <li>
                  <strong>Account information:</strong> Email address, name, and profile
                  details you provide when signing up
                </li>
                <li>
                  <strong>YouTube channel data:</strong> Channel information and video content
                  you choose to connect for AI training
                </li>
                <li>
                  <strong>Content inputs:</strong> Prompts, context, and files you provide
                  when using our generation tools
                </li>
                <li>
                  <strong>Usage data:</strong> How you interact with our platform, including
                  features used and session information
                </li>
                <li>
                  <strong>Billing metadata:</strong> Payment information processed by our
                  third-party payment provider (we don't store your card details)
                </li>
              </ul>
            </PolicySection>

            <PolicySection id="data-usage" title="3. How We Use Your Data">
              <p>We use your data to:</p>
              <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                <li>Operate and improve the Creator AI platform</li>
                <li>Train personalized AI models based on your content</li>
                <li>Generate scripts, thumbnails, ideas, and other content for you</li>
                <li>Process payments and manage your subscription</li>
                <li>Send important account notifications</li>
                <li>Prevent abuse and maintain platform security</li>
                <li>Provide customer support</li>
              </ul>
              <p>
                <strong>We do not sell your personal data to third parties.</strong>
              </p>
            </PolicySection>

            <PolicySection id="storage-security" title="4. Data Storage & Security">
              <p>
                Your data is encrypted both in transit (using TLS) and at rest. We use
                industry-standard security measures to protect your information.
              </p>
              <p>
                Our infrastructure is hosted on secure cloud providers with strict access
                controls and regular security audits.
              </p>
            </PolicySection>

            <PolicySection id="third-party" title="5. Third-Party Processors">
              <p>
                We work with trusted third-party services to operate our platform. These
                include:
              </p>
              <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                <li>Cloud hosting providers for data storage and processing</li>
                <li>AI APIs for content generation</li>
                <li>Payment processors for billing</li>
                <li>Analytics services for platform improvement</li>
              </ul>
              <p>
                All third-party processors are bound by data protection agreements.
              </p>
            </PolicySection>

            <PolicySection id="data-retention" title="6. Data Retention">
              <p>
                We keep your data only as long as needed to provide our services and comply
                with legal obligations. When you delete your account, we remove your personal
                data within 30 days, except where we're legally required to retain it.
              </p>
            </PolicySection>

            <PolicySection id="your-rights" title="7. Your Rights">
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Opt out of marketing communications</li>
              </ul>
              <p>
                To exercise any of these rights, contact us through our{" "}
                <Link
                  href="/contact-us"
                  className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors"
                >
                  Contact Us
                </Link>{" "}
                page.
              </p>
            </PolicySection>

            <PolicySection id="cookies" title="8. Cookies">
              <p>
                We use essential cookies to keep you logged in and remember your preferences.
                We also use analytics cookies to understand how people use our platform so we
                can make it better.
              </p>
              <p>
                You can control cookies through your browser settings.
              </p>
            </PolicySection>

            <PolicySection id="children" title="9. Children's Privacy">
              <p>
                Creator AI is not intended for children under 13. We do not knowingly collect
                personal information from children. If we learn that we have collected data
                from a child under 13, we will delete it promptly.
              </p>
            </PolicySection>

            <PolicySection id="policy-changes" title="10. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. We'll notify you of
                significant changes by email or through a notice on our platform. Continued
                use after changes means you accept the updated policy.
              </p>
            </PolicySection>

            <PolicySection id="contact" title="11. Contact">
              <p>
                Questions about your privacy? Visit our{" "}
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

export default PrivacyPage
