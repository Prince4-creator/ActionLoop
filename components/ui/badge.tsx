import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap backdrop-blur-md transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-white/40 bg-primary/85 text-primary-foreground shadow-[inset_0_1px_0_0_rgb(255,255,255,0.35)] [a]:hover:bg-primary",
        secondary:
          "border-white/40 bg-white/40 text-secondary-foreground shadow-[inset_0_1px_0_0_rgb(255,255,255,0.4)] [a]:hover:bg-white/55 dark:border-white/10 dark:bg-white/10",
        destructive:
          "border-destructive/25 bg-destructive/15 text-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/25",
        outline:
          "border-white/50 bg-white/20 text-foreground [a]:hover:bg-white/35 dark:border-white/10 dark:bg-white/5",
        ghost:
          "border-transparent bg-transparent hover:bg-white/30 hover:text-muted-foreground dark:hover:bg-white/10",
        link: "border-transparent bg-transparent text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }