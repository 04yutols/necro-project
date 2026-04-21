import type { Metadata } from "next";
import { Cinzel, Noto_Sans_JP, Space_Grotesk } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "ネクロマンス・ブレイブ | Necromance Brave",
  description: "魔王育成・ターン制RPG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${cinzel.variable} ${notoSansJP.variable} ${spaceGrotesk.variable}`}>
      <body className="antialiased bg-dark text-foreground font-noto">
        {children}
      </body>
    </html>
  );
}
