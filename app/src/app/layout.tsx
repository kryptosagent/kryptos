import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/lib/wallet-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KRYPTOS - Private DeFi Agent",
  description: "Privacy-first DeFi agent on Solana. Stealth DCA, MEV-protected swaps, and private transactions.",
  keywords: ["DeFi", "Solana", "Privacy", "DCA", "Crypto", "Trading", "MEV Protection"],
  authors: [{ name: "KRYPTOS" }],
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
  openGraph: {
    title: "KRYPTOS - Private DeFi Agent",
    description: "Privacy-first DeFi agent on Solana. Stealth DCA, MEV-protected swaps, and private transactions.",
    siteName: "KRYPTOS",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "KRYPTOS Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "KRYPTOS - Private DeFi Agent",
    description: "Privacy-first DeFi agent on Solana. Stealth DCA, MEV-protected swaps, and private transactions.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-zinc-950 text-white antialiased`}>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </body>
    </html>
  );
}