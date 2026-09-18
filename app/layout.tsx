import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yappr: call like a local",
  description:
    "Tell Yappr what you need. It calls local businesses in their language, shows a live transcript, and summarizes the conversation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this is the root layout, so it loads for every route, not "a single page" */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="shell">
          <header className="nav">
            <Link className="brand" href="/">
              <span className="mark">Y</span>
              Yappr
            </Link>
            <span className="tag">call like a local</span>
          </header>
          {children}
          <footer className="footer">Yappr places the call so you do not have to perform the language.</footer>
        </div>
      </body>
    </html>
  );
}
