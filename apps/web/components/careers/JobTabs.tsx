"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { FileText, Send } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs"

// Underlined tabs rather than a pill group: the bar sits flush with the article
// column and only the active label carries colour, so it reads as a quiet
// section marker instead of a second call to action competing with Apply.
const TRIGGER =
  "flex-1 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 text-sm font-medium text-slate-500 shadow-none transition-colors hover:text-slate-800 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent data-[state=active]:text-purple-700 data-[state=active]:shadow-none"

/**
 * Description / Apply switcher for a job page.
 *
 * Both panels arrive as props so the description stays a Server Component:
 * react-markdown renders it on the server and never reaches the browser.
 */
export default function JobTabs({
  description,
  apply,
}: {
  description: React.ReactNode
  apply: React.ReactNode
}) {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState("description")

  // Lets "Apply" links from the listing land straight on the form. A query
  // param rather than a #hash: the router drops the fragment during hydration,
  // so it is gone by the time this runs.
  useEffect(() => {
    if (searchParams.get("tab") === "apply") setTab("apply")
  }, [searchParams])

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="mb-10 flex h-auto w-full gap-8 rounded-none border-b border-slate-200 bg-transparent p-0">
        <TabsTrigger value="description" className={TRIGGER}>
          <FileText className="h-4 w-4" />
          Description
        </TabsTrigger>
        <TabsTrigger value="apply" className={TRIGGER}>
          <Send className="h-4 w-4" />
          Apply
        </TabsTrigger>
      </TabsList>

      <TabsContent value="description" className="mt-0 focus-visible:outline-none">
        {description}
      </TabsContent>
      <TabsContent value="apply" className="mt-0 focus-visible:outline-none">
        {apply}
      </TabsContent>
    </Tabs>
  )
}
