"use client"

import { useState } from "react"
import { Command } from "cmdk"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@repo/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover"
import { cn } from "@repo/ui/lib/utils"

export interface LanguageOption {
  value: string
  label: string
  disabled?: boolean
  /** Shown next to a disabled option, to say why. */
  note?: string
}

/** A language dropdown with a search box at the top. */
export function DubLanguagePicker({
  value,
  onChange,
  options,
  placeholder = "Select a language",
  ariaLabel,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: LanguageOption[]
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-purple-400",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-56 p-0">
        <Command>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Command.Input placeholder="Search languages" className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No language found</Command.Empty>
            {options.map((o) => (
              <Command.Item
                key={o.value}
                value={o.label}
                keywords={[o.value]}
                disabled={o.disabled}
                onSelect={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent"
              >
                <Check className={cn("h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{o.label}</span>
                {o.note && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{o.note}</span>}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
