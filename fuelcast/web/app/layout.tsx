import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fuelcast",
  description: "Meals that arrive before your energy crashes. Hands-free food ordering driven by wearable signals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="container nav-inner">
            <Link href="/" className="logo">
              <span className="logo-mark" aria-hidden>⚡</span> Fuelcast
            </Link>
            <div className="nav-links">
              <Link href="/">Product</Link>
              <Link href="/dashboard">Live demo</Link>
              <Link href="/ops">Ops</Link>
            </div>
          </div>
        </nav>
        {children}
        <footer className="footer">
          <div className="container row">
            <span>Fuelcast prototype. All health data is simulated; no real orders are placed.</span>
            <span className="spacer" />
            <span>General wellness and convenience, not medical advice.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
