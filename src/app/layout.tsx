import type { Metadata } from "next";
import { Share_Tech } from "next/font/google";
import "./globals.css";

const shareTech = Share_Tech({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-share-tech",
});

export const metadata: Metadata = {
  title: "home",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${shareTech.className} antialiased`}>{children}</body>
    </html>
  );
}
