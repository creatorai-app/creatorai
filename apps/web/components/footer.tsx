"use client"

import React from 'react';
import Image from "next/image";
import Link from 'next/link';
import dynamic from "next/dynamic";
import * as motion from "motion/react-m";
import logo from "@/public/dark-logo.png";
import { IconBrandDiscordFilled as Discord, IconBrandLinkedin as Linkedin, IconBrandX as Twitter, IconBrandGithub as Github, IconBrandFacebook as Facebook } from '@tabler/icons-react';
import { footerItems } from '@repo/ui';
import { FloatingDock } from "@repo/ui/floating-dock";
// One footer link that opens a form, but it reaches the API client and the
// shared validation package — axios + zod, ~90kB — which landed in the
// first-load JS of every marketing page. Split it out; it loads after hydration.
const ReportIssue = dynamic(() => import('./issue/report-an-issue'), {
  ssr: false,
  loading: () => <span className="block h-5" aria-hidden />,
});

// The globe is mounted through FooterGlobe, which defers three.js until the
// footer actually scrolls into view — see that file for why.
import FooterGlobe from "@/components/FooterGlobe";

const globeConfig = {
  pointSize: 4,
  globeColor: "#062056",
  showAtmosphere: true,
  atmosphereColor: "#FFFFFF",
  atmosphereAltitude: 0.1,
  emissive: "#062056",
  emissiveIntensity: 0.1,
  shininess: 0.9,
  polygonColor: "rgba(255,255,255,0.7)",
  ambientLight: "#38bdf8",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#ffffff",
  pointLight: "#ffffff",
  arcTime: 1000,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 22.3193, lng: 114.1694 },
  autoRotate: true,
  autoRotateSpeed: 0.5,
};

const sampleArcs = [
  { order: 1, startLat: -19.885592, startLng: -43.951191, endLat: -22.9068, endLng: -43.1729, arcAlt: 0.1, color: "#06b6d4" },
  { order: 1, startLat: 28.6139, startLng: 77.209, endLat: 3.139, endLng: 101.6869, arcAlt: 0.2, color: "#3b82f6" },
  { order: 2, startLat: 1.3521, startLng: 103.8198, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.2, color: "#6366f1" },
  { order: 2, startLat: 51.5072, startLng: -0.1276, endLat: 3.139, endLng: 101.6869, arcAlt: 0.3, color: "#06b6d4" },
  { order: 3, startLat: -33.8688, startLng: 151.2093, endLat: 22.3193, endLng: 114.1694, arcAlt: 0.3, color: "#3b82f6" },
  { order: 3, startLat: 21.3099, startLng: -157.8581, endLat: 40.7128, endLng: -74.006, arcAlt: 0.3, color: "#6366f1" },
  { order: 4, startLat: 11.986597, startLng: 8.571831, endLat: -15.595412, endLng: -56.05918, arcAlt: 0.5, color: "#06b6d4" },
  { order: 5, startLat: 14.5995, startLng: 120.9842, endLat: 51.5072, endLng: -0.1276, arcAlt: 0.3, color: "#3b82f6" },
  { order: 5, startLat: 34.0522, startLng: -118.2437, endLat: 48.8566, endLng: -2.3522, arcAlt: 0.2, color: "#6366f1" },
  { order: 6, startLat: 37.5665, startLng: 126.978, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.1, color: "#06b6d4" },
  { order: 7, startLat: 52.52, startLng: 13.405, endLat: 34.0522, endLng: -118.2437, arcAlt: 0.2, color: "#3b82f6" },
  { order: 8, startLat: 49.2827, startLng: -123.1207, endLat: 52.3676, endLng: 4.9041, arcAlt: 0.2, color: "#6366f1" },
  { order: 9, startLat: 22.3193, startLng: 114.1694, endLat: -22.9068, endLng: -43.1729, arcAlt: 0.7, color: "#06b6d4" },
  { order: 10, startLat: -22.9068, startLng: -43.1729, endLat: 28.6139, endLng: 77.209, arcAlt: 0.7, color: "#3b82f6" },
];

const socialLinks = [
  { name: 'Twitter', href: 'https://x.com/joincreatorai', icon: Twitter },
  { name: 'Discord', href: 'https://discord.gg/k9sZcq2gNG', icon: Discord },
  { name: 'GitHub', href: 'https://github.com/scriptaiapp/scriptai', icon: Github },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/company/creatoraiapp', icon: Linkedin },
  { name: 'Facebook', href: 'https://www.facebook.com/share/18S6iQ2RLG', icon: Facebook },
];

type FooterLink = { name: string; href: string };

const Footer = () => {
  return (
    <footer className="relative bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 overflow-hidden">
      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-12"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left side - Footer content */}
          <div className="space-y-8">
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="flex items-center gap-3">
                <Image src={logo} alt="Creator AI Logo" width={40} height={40} />
                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">Creator AI</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs">
                Personalized AI assistant for content creators. Empowering creators worldwide.
              </p>
              <a
                href="mailto:support@tryscriptai.com"
                className="block text-sm text-slate-600 dark:text-slate-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
              >
                support@tryscriptai.com
              </a>
              <FloatingDock
                desktopClassName="bg-transparent"
                items={socialLinks.map((item) => ({
                  title: item.name,
                  icon: <item.icon className="h-5 w-5 text-slate-500 dark:text-slate-400 hover:text-purple-500" />,
                  href: item.href,
                }))}
              />
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {Object.entries(footerItems).map(([section, items], i) => (
                <motion.div
                  key={section}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.05 * (i + 2) }}
                >
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4">
                    {section}
                  </h3>
                  <ul className="space-y-3">
                    {(items as FooterLink[]).map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className="text-sm text-slate-600 dark:text-slate-400 hover:text-purple-500 dark:hover:text-slate-100 transition-colors"
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

          {/* Right side - Globe */}
          <motion.div
            className="relative h-[320px] lg:h-[400px] w-full"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-100 dark:to-slate-900 z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-slate-100 dark:to-slate-900 z-10 pointer-events-none lg:block hidden" />
            <FooterGlobe data={sampleArcs} globeConfig={globeConfig} />
          </motion.div>
        </div>

        <motion.div
          className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <p className="text-sm text-slate-600 dark:text-slate-400">
            &copy; {new Date().getFullYear()} Creator AI. All rights reserved.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
            Formerly known as Script AI
          </p>
        </motion.div>
      </motion.div>
    </footer>
  );
};

export default Footer;
