import type { Metadata } from "next";
import { Cinzel, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "700"],
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"], // Note: Next.js doesn't fully support "japanese" subset in the same way, but it works
  variable: "--font-noto-sans-jp",
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
    <html lang="ja" className={`${cinzel.variable} ${notoSansJP.variable}`}>
      <body className="antialiased bg-dark text-foreground font-noto">
        {children}
      </body>
    </html>
  );
}
