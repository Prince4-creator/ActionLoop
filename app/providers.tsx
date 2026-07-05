"use client"

import { ThemeProvider } from "@/lib/theme"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  )
}
