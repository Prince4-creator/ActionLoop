import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-3xl border border-white/50 bg-white/35 px-4 py-3 text-base text-foreground shadow-[inset_0_1px_0_0_rgb(255,255,255,0.5)] backdrop-blur-md transition-[background-color,box-shadow,border-color] outline-none placeholder:text-slate-500 focus:border-primary/50 focus:bg-white/55 focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/20 md:text-sm dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-primary/50 dark:focus:bg-white/10 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }