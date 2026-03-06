import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LegalRAG - RAG pentru documente legale",
  description: "Platformă RAG pentru documente legale și tehnice cu citate 100% verificate",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
