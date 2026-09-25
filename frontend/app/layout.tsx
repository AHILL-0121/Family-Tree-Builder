import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Newsreader, Noto_Serif_Tamil } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const serif = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-serif", adjustFontFallback: false });
const tamil = Noto_Serif_Tamil({ subsets: ["tamil"], weight: ["400", "600"], variable: "--font-tamil" });

export const metadata: Metadata = {
  title: "Family Tree Builder",
  description: "Build your family tree, see how everyone is related in English and Tamil, and print it as a poster. Private: it stays in your browser.",
  applicationName: "Family Tree Builder",
  openGraph: {
    title: "Family Tree Builder",
    description: "Build your family tree and see how everyone is related, in English and தமிழ்.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F0E8" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

// Apply the saved or system theme before first paint (no flash). The landing page ("/") is always light.
const themeScript = `(function(){try{if(location.pathname==="/")return;var t=localStorage.getItem("ftb-theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${serif.variable} ${tamil.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
