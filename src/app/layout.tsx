import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import { ServiceWorker } from "@/components/shared/service-worker";
import { TestnetFooter } from "@/components/shared/testnet-footer";
import { Providers } from "./providers";
import "./globals.css";

// Body/UI. Chosen for legibility at small sizes and real tabular numerals —
// dosages and fill counts have to line up in columns.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Headings only. Slightly warmer and more geometric than Inter, which keeps
// the app from reading as a spreadsheet without making it playful.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

// Tx hashes and token IDs — these get compared character by character.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pacy — One prescription. One token. One time.",
  description:
    "Prescription tokenization on Cardano. Can't be forged, over-filled, or dispensed after expiry.",
  applicationName: "Pacy",
  // iOS ignores the manifest's display mode; this is what makes an installed
  // patient view open without Safari's chrome over the QR code.
  appleWebApp: { capable: true, title: "Pacy", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#107d7c",
  colorScheme: "light",
  // Patient view is a QR code held up to a scanner; pinch-zoom would only
  // get in the way.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning covers this element's own attributes only,
          not its children. Extensions (Bitdefender, password managers) stamp
          attributes like `bis_register` onto <body> before hydration, which
          React reports as a mismatch we neither caused nor can fix. Real
          mismatches inside the app still surface normally. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Providers>
          <div className="flex-1">{children}</div>
          <TestnetFooter />
        </Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
