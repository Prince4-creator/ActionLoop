import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// iOS 26 "liquid glass" button: capsule shape, translucent blurred fill,
// bright top-edge highlight, gentle squish on press instead of a flat
// color-swap hover state.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border bg-clip-padding text-base font-medium whitespace-nowrap outline-none select-none transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-white/40 bg-primary/90 text-primary-foreground shadow-[0_8px_20px_-10px_rgb(37,99,235,0.55),inset_0_1px_0_0_rgb(255,255,255,0.35)] backdrop-blur-md hover:bg-primary hover:shadow-[0_10px_26px_-10px_rgb(37,99,235,0.6),inset_0_1px_0_0_rgb(255,255,255,0.35)] dark:border-white/10",
        outline:
          "glass-button border-white/50 text-foreground dark:border-white/10",
        secondary:
          "glass-button border-white/40 bg-secondary/70 text-secondary-foreground dark:border-white/10",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-white/40 hover:backdrop-blur-md dark:hover:bg-white/10",
        destructive:
          "border-destructive/30 bg-destructive/15 text-destructive backdrop-blur-md hover:bg-destructive/25",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef<
  HTMLButtonElement | React.ElementRef<typeof Slot.Root>,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>(
  (
    { className, variant = "default", size = "default", asChild = false, type, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot.Root : "button"
    const finalProps = { type: type ?? "button", ...props } as React.ComponentProps<"button">

    return (
      <Comp
        ref={ref as React.ForwardedRef<any>}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...finalProps}
      />
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }