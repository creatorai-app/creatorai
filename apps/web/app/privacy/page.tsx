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
  { id: "youtube-data", title: "4. YouTube Channel Connection" },
  { id: "ai-training", title: "5. AI Training & Third-Party Models" },
  { id: "no-misuse", title: "6. How We Will Not Use Your Data" },
  { id: "storage-security", title: "7. Data Storage & Security" },
  { id: "third-party", title: "8. Third-Party Processors" },
  { id: "data-retention", title: "9. Data Retention" },
  { id: "your-rights", title: "10. Your Rights" },
  { id: "cookies", title: "11. Cookies" },
  { id: "open-source", title: "12. Open Source" },
  { id: "children", title: "13. Children's Privacy" },
  { id: "policy-changes", title: "14. Changes to This Policy" },
  { id: "contact", title: "15. Contact" },
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

          <h1 className="text-4xl md:text-5xl font-bold text-center mb-2 text-slate-900 w-full">
            Privacy Policy
          </h1>
        </div>

        <p className="text-center text-sm text-slate-500 mb-16">Last updated: September 3, 2026</p>

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
                <li>Build a style profile from your videos that personalizes what we generate for you (see section 5)</li>
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

            <PolicySection id="youtube-data" title="4. YouTube Channel Connection">
              <p>
                Creator AI uses YouTube API Services. Connecting your channel is optional, and
                everything in this section applies only once you choose to connect it.
              </p>
              <p>
                We request read-only access (the{" "}
                <span className="font-mono text-sm">youtube.readonly</span> scope). We never
                request permission to upload, edit, or delete anything on your channel. With
                that access we read:
              </p>
              <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                <li>Your channel profile and public statistics</li>
                <li>Your video list, with each video's title, description, and thumbnail</li>
                <li>Public statistics for those videos, such as view and like counts, and their duration</li>
              </ul>
              <p>
                We store this data so your dashboard and generated content stay in sync with
                your channel. We do not download, re-host, or redistribute your videos.
              </p>
              <p>
                By connecting your channel you are also agreeing to the{" "}
                <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors">
                  YouTube Terms of Service
                </a>
                . Google's handling of your data is governed by the{" "}
                <a href="http://www.google.com/policies/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors">
                  Google Privacy Policy
                </a>
                .
              </p>
              <p>
                <strong>You can revoke our access at any time</strong> from your{" "}
                <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer" className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors">
                  Google security settings
                </a>
                , or by disconnecting your channel in your Creator AI settings. When you revoke
                access, we delete the YouTube data we obtained through the API, and anything we
                derived from it, within 7 days.
              </p>
            </PolicySection>

            <PolicySection id="ai-training" title="5. AI Training & Third-Party Models">
              <p>
                We do not build or host our own AI models. Creator AI runs on third-party
                models, which means your content is sent to another company's servers to be
                processed. We would rather say that plainly than bury it.
              </p>
              <p>
                <strong>Which models.</strong> We use Google's Gemini models through Google
                Cloud Vertex AI. Google processes this content as our service provider under
                the{" "}
                <a href="https://cloud.google.com/terms/service-terms" target="_blank" rel="noopener noreferrer" className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors">
                  Google Cloud Service Specific Terms
                </a>
                , whose Training Restriction section commits that Google will not use customer
                data to train or fine-tune its models without the customer's permission. We have
                not given that permission and will not.
              </p>
              <p>
                <strong>What we send.</strong> When you train your AI, we send the model the
                YouTube URLs of the videos you selected, and the model watches them — the
                actual audio and video, not just the title and description. We also send the
                prompts, context, and files you provide when using our generation tools.
              </p>
              <p>
                <strong>What we keep.</strong> From that analysis we store a style profile on
                your account: transcript excerpts, a description of your pacing, tone, humor,
                and hooks, and numeric embeddings of that description. This profile is what
                makes your scripts, ideas, thumbnails, and story blueprints sound like you. It
                is attached to your account and used only for your generations.
              </p>
              <p>
                <strong>Training, precisely.</strong> "Training your AI" in our product means
                building this profile for you. It does not mean we fine-tune a model, and your
                content is never pooled with other users' content to train a shared model.
              </p>
            </PolicySection>

            <PolicySection id="no-misuse" title="6. How We Will Not Use Your Data">
              <p>
                Connecting your channel means handing us your life's work. These are
                commitments, not aspirations:
              </p>
              <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                <li>
                  <strong>We do not sell your personal data or your content</strong> to anyone,
                  for any purpose
                </li>
                <li>
                  <strong>We do not share your style profile with other users.</strong> Nobody
                  else can generate content in your voice through our platform
                </li>
                <li>
                  <strong>We do not use your content to train shared or foundation models</strong>,
                  ours or anyone else's
                </li>
                <li>
                  <strong>We do not use your content for advertising or profiling</strong>, and
                  we do not build audience segments out of it
                </li>
                <li>
                  <strong>We do not republish, redistribute, or license your videos</strong> or
                  anything derived from them
                </li>
              </ul>
              <p>
                Internal access is limited to what is needed to run and support the service, and
                we act on misuse of the platform or of the data shared with us — including
                suspending or terminating accounts and, where appropriate, reporting it. If you
                believe your data has been misused, tell us at{" "}
                <Link href="mailto:support@trycreatorai.com" className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors">
                  support@trycreatorai.com
                </Link>{" "}
                and we will investigate.
              </p>
            </PolicySection>

            <PolicySection id="storage-security" title="7. Data Storage & Security">
              <p>
                Your data is encrypted both in transit (using TLS) and at rest. We use
                industry-standard security measures to protect your information.
              </p>
              <p>
                Our infrastructure is hosted on secure cloud providers with strict access
                controls and regular security audits.
              </p>
            </PolicySection>

            <PolicySection id="third-party" title="8. Third-Party Processors">
              <p>
                These are the companies that process your data on our behalf, and what each one
                handles:
              </p>
              <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                <li><strong>Google Cloud (Vertex AI):</strong> runs the AI models that analyze your videos and generate your content</li>
                <li><strong>Google Cloud Storage:</strong> stores media files you upload or that we generate for you</li>
                <li><strong>Google (YouTube Data API):</strong> the source of your channel and video data, once you connect your channel</li>
                <li><strong>Supabase:</strong> our database, authentication, and file storage</li>
                <li><strong>Lemon Squeezy:</strong> processes payments and subscriptions &mdash; they handle your card details, we never see or store them</li>
                <li><strong>Resend:</strong> sends transactional email such as sign-up confirmations and account notices</li>
                <li><strong>Google Analytics:</strong> aggregate usage statistics for the website</li>
              </ul>
              <p>
                All of them are bound by data protection agreements. If we add or replace a
                processor, we will update this list.
              </p>
            </PolicySection>

            <PolicySection id="data-retention" title="9. Data Retention">
              <p>
                We keep your data only as long as needed to provide our services and comply
                with legal obligations. When you delete your account, we remove your personal
                data within 30 days, except where we're legally required to retain it.
              </p>
              <p>
                YouTube data is on a shorter clock: if you disconnect your channel or revoke our
                access through your Google security settings, we delete the data we obtained
                through the YouTube API, and the style profile derived from it, within 7 days
                &mdash; without waiting for you to delete your account.
              </p>
            </PolicySection>

            <PolicySection id="your-rights" title="10. Your Rights">
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Opt out of marketing communications</li>
                <li>
                  Disconnect your YouTube channel at any time, in your Creator AI settings or
                  from your{" "}
                  <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer" className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors">
                    Google security settings
                  </a>
                </li>
                <li>Delete your style profile without deleting your account, by disconnecting your channel</li>
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

            <PolicySection id="cookies" title="11. Cookies">
              <p>
                We use essential cookies to keep you logged in and remember your preferences.
                We also use Google Analytics cookies to understand how people use our platform
                so we can make it better.
              </p>
              <p>
                You can control cookies through your browser settings.
              </p>
            </PolicySection>

            <PolicySection id="open-source" title="12. Open Source">
              <p>
                Creator AI is open source. The code that handles your data &mdash; what we
                request from YouTube, what we send to the AI models, what we store, and what we
                delete &mdash; is public at{" "}
                <a href="https://github.com/creatorai-app/creatorai" target="_blank" rel="noopener noreferrer" className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors">
                  github.com/creatorai-app/creatorai
                </a>
                .
              </p>
              <p>
                You do not have to take this policy on trust. Every claim on this page can be
                checked against the source. If you find something in the code that contradicts
                what we have written here, tell us and we will fix whichever one is wrong.
              </p>
            </PolicySection>

            <PolicySection id="children" title="13. Children's Privacy">
              <p>
                Creator AI is not intended for children under 13. We do not knowingly collect
                personal information from children. If we learn that we have collected data
                from a child under 13, we will delete it promptly.
              </p>
            </PolicySection>

            <PolicySection id="policy-changes" title="14. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. We'll notify you of
                significant changes by email or through a notice on our platform. Continued
                use after changes means you accept the updated policy.
              </p>
            </PolicySection>

            <PolicySection id="contact" title="15. Contact">
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
                  href="mailto:support@trycreatorai.com"
                  className="font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors"
                >
                  support@trycreatorai.com
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
