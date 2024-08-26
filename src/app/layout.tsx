import type {Metadata} from "next";
import Head from "next/head";
import {Noto_Sans_SC} from "next/font/google";
import {ReactNode} from "react";
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
    <Head>
      <script defer src="https://trail.learningman.top/script.js"
              data-website-id="2cd9ea13-296b-4d90-998a-bbbc5613fc20"></script>
    </Head>
    <body className={font.className}>{children}</body>
    </html>
  );
}
