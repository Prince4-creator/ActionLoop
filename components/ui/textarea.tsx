import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base text-foreground transition-colors outline-none placeholder:text-slate-400 focus:border-white/40 focus:bg-white/20 focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 md:text-sm dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-slate-200/20 dark:focus:bg-slate-900/70 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
