"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import { toast } from "sonner"

import { Button } from "@repo/ui/button"
import { Input } from "@repo/ui/input"
import { Label } from "@repo/ui/label"
import { Textarea } from "@repo/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card"
import { AuroraBackground } from "@repo/ui/aurora-background"
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar"
import Footer from "@/components/footer"
import logo from "@/public/dark-logo.png"

const formFields = [
  { name: "name", label: "Name", type: "text", placeholder: "Your name" },
  { name: "email", label: "Email", type: "email", placeholder: "you@example.com" },
] as const

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "", phone: "" })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)

    try {
      const response = await fetch("/api/contact-us", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error("Failed to send mail")

      await response.json()
      toast.success("Mail sent successfully!", {
        description: "Thank you for reaching out! We'll get back to you soon.",
      })
      setFormData({ name: "", email: "", message: "", phone: "" })
    } catch (error: any) {
      toast.error("Failed to send mail", {
        description: error?.message || "Something went wrong. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <LandingPageNavbar />
      <AuroraBackground>
        <div className="relative mx-3 my-24 box-border grid w-full max-w-[min(100%,calc(100vw-1.5rem))] flex-1 grid-cols-1 items-start justify-center gap-8 px-3 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:mx-5 sm:px-4 sm:py-8 md:mx-auto md:max-w-7xl md:grid-cols-2 md:items-center md:px-8 md:py-10 lg:px-12">

          {/* Left Column: Brand Messaging */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: "easeInOut" }}
            className="hidden flex-col justify-center gap-4 md:flex"
          >
            <Link href="/">
              <Image src={logo} alt="Script AI" width={80} height={80} className="mb-4" />
            </Link>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900">
              We'd Love to Hear From You.
            </h1>
            <p className="max-w-md text-lg text-slate-600">
              Got questions, feedback, or ideas? Our team is always ready to collaborate and support your AI-powered creative journey.
            </p>
          </motion.div>

          {/* Right Column: Contact Form */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
            className="flex w-full justify-center md:justify-end"
          >
            <Card className="w-full max-w-md bg-white/20 dark:bg-black/20 backdrop-blur-lg border border-white/30 shadow-2xl rounded-2xl">
              <CardHeader className="space-y-1 pt-6">
                <div className="flex justify-center md:hidden">
                  <Image src={logo} alt="Script AI" width={60} height={60} />
                </div>
                <CardTitle className="text-2xl text-center text-slate-900 dark:text-white">
                  Send Us a Message
                </CardTitle>
                <p className="text-sm text-center text-slate-600 dark:text-slate-300">
                  Or email us directly at{" "}
                  <a href="mailto:support@tryscriptai.com" className="text-purple-600 dark:text-purple-400 hover:underline">
                    support@tryscriptai.com
                  </a>
                </p>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formFields.map((field) => (
                    <div key={field.name} className="space-y-2">
                      <Label htmlFor={field.name} className="dark:text-slate-200">{field.label}</Label>
                      <Input
                        id={field.name}
                        type={field.type}
                        name={field.name}
                        placeholder={field.placeholder}
                        value={formData[field.name as keyof typeof formData]}
                        onChange={handleChange}
                        required
                        className="bg-white/30 dark:bg-black/30 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:ring-pink-500"
                      />
                    </div>
                  ))}

                  <div className="space-y-2">
                    <Label htmlFor="message" className="dark:text-slate-200">Message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={4}
                      placeholder="Write your message here..."
                      className="bg-white/30 dark:bg-black/30 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:ring-pink-500"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 shadow-md"
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Send Message"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </AuroraBackground>
      <Footer />
    </div>
  )
}
