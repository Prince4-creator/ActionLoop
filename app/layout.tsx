import type { Metadata } from "next";
import { Google_Sans } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import BackgroundMesh from "@/components/ui/background-mesh";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

// 2. Define a single metadata object
export const metadata: Metadata = {
  title: "ActionLoop",
  description: "Close the loop between meetings and results",
  applicationName: "ActionLoop",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport = 'width=device-width, initial-scale=1';

// 3. Define a single RootLayout component
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${googleSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="relative min-h-full overflow-x-hidden font-sans text-slate-900 antialiased dark:text-slate-100">
        <BackgroundMesh />
        <ThemeProvider>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}