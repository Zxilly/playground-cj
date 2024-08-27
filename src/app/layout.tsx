import type {Metadata} from "next";
import {Noto_Sans_SC} from "next/font/google";
import {ReactNode} from "react";
import {Analytics} from "@vercel/analytics/react"
import "./globals.css";

const font = Noto_Sans_SC({preload: false});

export const metadata: Metadata = {
  title: "仓颉 Playground",
  description: "一个在线的仓颉编程语言 Playground",
};

export default function RootLayout({children}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
    <body className={font.className}>{children}</body>
    <Analytics/>
    </html>
  );
}
