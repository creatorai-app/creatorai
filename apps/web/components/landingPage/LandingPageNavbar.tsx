"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { navItem } from "@repo/ui"
import type { NavItemType } from "@repo/ui"
import Image from "next/image"
import Link from "next/link"
import logo from "@/public/dark-logo.png"
import {
  Navbar,
  NavBody,
  MobileNav,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@repo/ui/resizable-navbar"
import { ShimmerButton } from "@/components/magicui/shimmer-button"
import { Gift, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@repo/ui/button"

const FEATURE_IMAGES: Record<string, string> = {
  "AI Studio": "/ai studio page.png",
  "Script Writing": "/scripts page.png",
  "Video Ideas": "/ideation page.png",
  "Story Builder": "/story page.png",
  Thumbnails: "/thumbnail page.png",
  Subtitles: "/subtitle page.png",
}

const Logo = () => (
  <Link
    href="/"
    className="flex items-center space-x-2 px-2 py-1 text-sm font-medium text-black dark:text-white"
  >
    <Image src={logo} alt="Logo" width={30} height={30} />
  </Link>
)

function DesktopNavItems({ items }: { items: NavItemType[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [hoveredChildIdx, setHoveredChildIdx] = useState<number | null>(null)

  return (
    <div
      onMouseLeave={() => {
        setHovered(null)
        setDropdownOpen(false)
        setHoveredChildIdx(null)
      }}
      className="absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-2 text-sm font-medium text-zinc-600 lg:flex"
    >
      {items.map((item, idx) => (
        <div
          key={`nav-${idx}`}
          className="relative"
          onMouseEnter={() => {
            setHovered(idx)
            if (item.children) setDropdownOpen(true)
          }}
        >
          <a
            href={item.href}
            className="relative flex items-center gap-1 px-4 py-2 text-neutral-600 dark:text-neutral-300 transition-colors hover:text-neutral-900"
          >
            {hovered === idx && (
              <motion.div
                layoutId="hovered"
                className="absolute inset-0 h-full w-full rounded-full bg-gray-100 dark:bg-neutral-800"
              />
            )}
            <span className="relative z-20">{item.name}</span>
            {item.children && (
              <ChevronDown className="relative z-20 h-3.5 w-3.5 transition-transform" />
            )}
          </a>

          {item.children && (
            <AnimatePresence>
              {dropdownOpen && hovered === idx && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-[-100%] top-full z-50 mt-1 flex w-full max-w-[800px] md:w-[800px] -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
                  onMouseEnter={() => setDropdownOpen(true)}
                  onMouseLeave={() => setDropdownOpen(false)}
                >
                  <div className="flex min-w-0 flex-1 flex-col p-2">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0">
                      {item.children.map((child, childIdx) => {
                        const imageSrc = FEATURE_IMAGES[child.name]
                        return (
                          <a
                            key={`child-${childIdx}`}
                            href={child.href}
                            className="flex flex-col rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                            onMouseEnter={() => setHoveredChildIdx(childIdx)}
                          >
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                              {child.name}
                            </span>
                            {child.description && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {child.description}
                              </span>
                            )}
                          </a>
                        )
                      })}
                    </div>
                    <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
                      <a
                        href="/features"
                        className="flex items-center rounded-lg px-3 py-2 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                      >
                        View all features →
                      </a>
                    </div>
                  </div>
                  <div className="relative min-h-[220px] w-[320px] shrink-0 border-l border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                    <AnimatePresence mode="wait">
                      {(() => {
                        const child =
                          hoveredChildIdx !== null ? item.children[hoveredChildIdx] : null
                        const imageSrc = child ? FEATURE_IMAGES[child.name] : null
                        if (!child || !imageSrc) return null
                        return (
                          <motion.div
                            key={hoveredChildIdx}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute inset-0 flex items-center justify-center p-2"
                          >
                            <div className="relative h-full w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900">
                              <Image
                                src={imageSrc}
                                alt={child.name}
                                fill
                                className="object-contain object-center"
                                sizes="320px"
                              />
                            </div>
                          </motion.div>
                        )
                      })()}
                    </AnimatePresence>
                    {hoveredChildIdx === null && (
                      <div className="flex h-full min-h-[200px] items-center justify-center p-4 text-sm text-slate-400 dark:text-slate-500">
                        Hover a feature to preview
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      ))}
    </div>
  )
}

const LandingPageNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mobileFeatureOpen, setMobileFeatureOpen] = useState(false)
  const router = useRouter()



  return (
    <motion.div
      className="relative w-full"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Navbar>
        <NavBody>
          <Link
            href="/"
            className="relative z-20 flex items-center px-2 py-1 text-sm font-normal text-black"
          >
            <Image src={logo} alt="Logo" width={30} height={30} />
            <span className="font-bold text-xl text-black dark:text-white">Creator AI</span>
          </Link>
          <DesktopNavItems items={navItem} />
          <div className="flex items-center gap-3">
            {/* <Button
              onClick={() => router.push("/signup?ref=navbar")}
              className="hidden xl:flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-200/50 dark:border-amber-600/40 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50 cursor-pointer shadow-xl transition duration-200 hover:shadow-xl hover:border-amber-400"
            >
              <Gift className="h-3.5 w-3.5" />
              Refer &amp; Earn 1,000 Credits
            </Button> */}
            {/* <ShimmerButton className="text-sm h-9" onClick={() => router.push("/signup")}>
              Sign Up
            </ShimmerButton> */}
            <ShimmerButton className="text-sm h-9" onClick={() => router.push("/login")}>
              Sign In
            </ShimmerButton>
          </div>
        </NavBody>

        <MobileNav>
          <MobileNavHeader>
            <Logo />
            <MobileNavToggle
              isOpen={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            />
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {navItem.map((item, idx) =>
              item.children ? (
                <div key={`mobile-${idx}`} className="w-full">
                  <button
                    onClick={() => setMobileFeatureOpen(!mobileFeatureOpen)}
                    className="flex w-full items-center justify-between text-neutral-600 dark:text-neutral-300"
                  >
                    {item.name}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${mobileFeatureOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence>
                    {mobileFeatureOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 flex flex-col gap-1 overflow-hidden pl-4"
                      >
                        {item.children.map((child, childIdx) => (
                          <Link
                            key={`mobile-child-${childIdx}`}
                            href={child.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-slate-50 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-slate-800"
                          >
                            {child.name}
                          </Link>
                        ))}
                        <Link
                          href="/features"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="rounded-md px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400"
                        >
                          View all features →
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={`mobile-link-${idx}`}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block text-neutral-600 dark:text-neutral-300"
                >
                  {item.name}
                </Link>
              )
            )}
            <div className="flex flex-col gap-3 mt-4">
              {/* <Link
                href="/signup?ref=navbar"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50/80 px-4 py-2.5 text-sm font-medium text-amber-700 dark:border-amber-600/40 dark:bg-amber-950/30 dark:text-amber-400"
              >
                <Gift className="h-4 w-4" />
                Refer &amp; Earn Credits
              </Link> */}
              <ShimmerButton className="text-sm h-9 w-full" onClick={() => { router.push("/signup"); setIsMobileMenuOpen(false) }}>
                Get Started
              </ShimmerButton>
              <ShimmerButton className="text-sm h-9" onClick={() => router.push("/login")}>
                Sign In
              </ShimmerButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>
    </motion.div>
  )
}

export default LandingPageNavbar
