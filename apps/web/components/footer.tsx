"use client"

import React from 'react';
import BrandLogo from "@/components/BrandLogo";
import Link from 'next/link';
import dynamic from "next/dynamic";
import * as motion from "motion/react-m";
import { IconBrandDiscordFilled as Discord, IconBrandLinkedin as Linkedin, IconBrandX as Twitter, IconBrandGithub as Github, IconBrandFacebook as Facebook, IconBrandYoutube as Youtube } from '@tabler/icons-react';
import { footerItems } from '@repo/ui';
import { FloatingDock } from "@repo/ui/floating-dock";
// One footer link that opens a form, but it reaches the API client and the
// shared validation package — axios + zod, ~90kB — which landed in the
// first-load JS of every marketing page. Split it out; it loads after hydration.
const ReportIssue = dynamic(() => import('./issue/report-an-issue'), {
  ssr: false,
  loading: () => <span className="block h-5" aria-hidden />,
});

const socialLinks = [
  { name: 'Twitter', href: 'https://x.com/joincreatorai', icon: Twitter },
  { name: 'YouTube', href: 'https://www.youtube.com/@joincreatorai', icon: Youtube },
  { name: 'Discord', href: 'https://discord.gg/k9sZcq2gNG', icon: Discord },
  { name: 'GitHub', href: 'https://github.com/scriptaiapp/scriptai', icon: Github },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/company/creatoraiapp', icon: Linkedin },
  { name: 'Facebook', href: 'https://www.facebook.com/share/18S6iQ2RLG', icon: Facebook },
];

type FooterLink = { name: string; href: string };

// `dark` on the footer, not just dark colours: Tailwind runs class-based dark
// mode, so this also resolves the dark: variants inside FloatingDock and Report
// an Issue. Their colours are not reachable from here, and on a slate-900
// surface their light ones are unreadable.
const Footer = () => {
  return (
    <footer className="dark bg-slate-900 border-t border-slate-800">
      <motion.div
        className="max-w-7xl mx-auto px-6 lg:px-8 py-12 sm:py-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="space-y-12">
          {/* Brand */}
          <motion.div
            className="mx-auto max-w-md space-y-5 text-center"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center justify-center gap-3">
              <BrandLogo size={36} />
              <span className="text-xl sm:text-2xl font-bold text-slate-100">Creator AI</span>
            </div>
            <p className="mx-auto max-w-xs text-sm text-slate-400">
              Personalized AI assistant for content creators. Empowering creators worldwide.
            </p>
            {/* Desktop keeps the animated dock. It is a full-width flex row, so
                mx-auto cannot centre it; justify-center centres the icons. */}
            <FloatingDock
              desktopClassName="justify-center bg-transparent dark:bg-transparent"
              mobileClassName="hidden"
              items={socialLinks.map((item) => ({
                title: item.name,
                icon: <item.icon className="h-5 w-5 text-slate-400 hover:text-purple-400" />,
                href: item.href,
              }))}
            />
            {/* Below md the dock collapses to a toggle that stacks all six icons
                in one column over the content above, so show a 3x2 grid instead. */}
            <ul className="mx-auto grid w-fit grid-cols-3 gap-3 md:hidden">
              {socialLinks.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.name}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800 text-slate-400 transition-colors hover:text-purple-400"
                  >
                    <item.icon className="h-5 w-5" />
                  </a>
                </li>
              ))}
            </ul>

            <a href="https://peerpush.com/p/creator-ai" target="_blank" rel="noopener" className="inline-block">
              <img
                src="https://peerpush.com/p/creator-ai/badge.png"
                alt="Creator AI on PeerPush"
                width={230}
                height={65}
                className="w-[230px] max-w-full h-auto"
              />
            </a>
          </motion.div>

          {/* Link columns */}
          {/* Full width rather than a side column: the social dock has a fixed
              desktop width and overlapped the first link column beside it. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(footerItems).map(([section, items], i) => (
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.05 * (i + 2) }}
              >
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">
                  {section}
                </h3>
                <ul className="space-y-3">
                  {(items as FooterLink[]).map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-sm text-slate-400 hover:text-purple-400 transition-colors"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                  {section === "Legal" && (
                    <li>
                      <ReportIssue useIcon={false} />
                    </li>
                  )}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-center sm:text-left"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Creator AI. All rights reserved.
          </p>
          <p className="text-xs text-slate-400">
            Formerly known as Script AI
          </p>
        </motion.div>
      </motion.div>
    </footer>
  );
};

export default Footer;
