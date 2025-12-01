// app/layout.tsx
import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"
import { DM_Sans, DM_Mono } from "next/font/google"
import { Providers } from "./providers"

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
})

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
})

const appUrl = "https://clankton-nft-edition.vercel.app"

export const metadata: Metadata = {
  title: "thepapercrane × $CLANKTON NFT mint",
  description: "Mint thepapercrane × $CLANKTON NFT with social discounts",
  openGraph: {
    title: "thepapercrane × $CLANKTON NFT mint",
    description: "Mint thepapercrane × $CLANKTON NFT with social discounts",
    url: "https://clankton-nft-edition.vercel.app",
    siteName: "thepapercrane × $CLANKTON NFT mint",
    images: [
      {
        url: "https://clankton-nft-edition.vercel.app/clankton-banner.jpg",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "thepapercrane × $CLANKTON NFT mint",
    description: "Mint thepapercrane × $CLANKTON NFT with social discounts.",
    images: ["https://clankton-nft-edition.vercel.app/clankton-banner.jpg"],
  },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      name: "Clankton Town Mint",
      iconUrl: `${appUrl}/icon.png`,
      homeUrl: appUrl,
      imageUrl: `${appUrl}/image.png`,
      buttonTitle: "Open mini app",
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#8F80AA",
    }),
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}