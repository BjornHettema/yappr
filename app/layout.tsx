import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Outfit } from "next/font/google";
import ThemeToggle from "@/app/components/ThemeToggle";
import "./globals.css";

/**
 * Fonts are self-hosted through next/font rather than linked from
 * fonts.googleapis.com, for two reasons:
 *
 * 1. Privacy. A <link> to Google's CDN sends every visitor's IP address to
 *    Google before the page renders. A German court (LG München I, 2022)
 *    ruled that doing this without consent breaches the GDPR, and it has
 *    been a steady source of warning letters in the EU since. next/font
 *    downloads the files at BUILD time and serves them from our own origin,
 *    so no visitor request ever reaches Google.
 * 2. Speed. It removes a render-blocking request to a third-party origin,
 *    which is the slowest part of a first visit on a weak connection, and
 *    next/font matches fallback metrics so there is no layout shift.
 *
 * Note for anyone editing this from a restricted sandbox: this needs network
 * access to fonts.googleapis.com at build time. If `npm run build` fails
 * fetching the fonts, that is the environment, not the code — CI can build it.
 */
const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const sans = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Yappr: call like a local",
  description:
    "Tell Yappr what you need. It calls local businesses in their language, shows a live transcript, and summarizes the conversation.",
};

/**
 * Resolves the theme before the first paint, so nobody sees a flash of the
 * wrong one. It has to be inline and blocking for that reason: a deferred
 * script or a useEffect both run after the browser has already painted.
 * No stored choice means follow the operating system.
 */
const themeScript = `(function(){try{var s=localStorage.getItem("yappr.theme");var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable}`}
      // data-theme is written by the script below before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="shell">
          <header className="nav">
            <Link className="brand" href="/">
              <span className="mark">Y</span>
              Yappr
            </Link>
            <div className="nav-end">
              <span className="tag">call like a local</span>
              <ThemeToggle />
            </div>
          </header>
          {children}
          <footer className="footer">Yappr places the call so you do not have to perform the language.</footer>
        </div>
      </body>
    </html>
  );
}
