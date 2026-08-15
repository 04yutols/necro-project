import type { Metadata } from "next";
import {
  Cinzel,
  Cinzel_Decorative,
  IM_Fell_English,
  Inter,
  Noto_Sans_JP,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { MotionAccessibilityProvider } from "../components/layout/MotionAccessibilityProvider";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "700"],
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  weight: ["400", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "700"],
});

const cinzelDecorative = Cinzel_Decorative({
  subsets: ["latin"],
  variable: "--font-cinzel-decorative",
  weight: ["700", "900"],
});

const imFellEnglish = IM_Fell_English({
  subsets: ["latin"],
  variable: "--font-im-fell-english",
  weight: ["400"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "ネクロマンス・ブレイブ | Necromance Brave",
  description: "魔王育成・ターン制RPG",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${cinzel.variable} ${cinzelDecorative.variable} ${imFellEnglish.variable} ${inter.variable} ${notoSansJP.variable} ${spaceGrotesk.variable}`}
    >
      <body className="antialiased bg-dark text-foreground font-noto">
        <MotionAccessibilityProvider>{children}</MotionAccessibilityProvider>
      </body>
    </html>
  );
}
