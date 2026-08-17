import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAUT",
  description: "Production intelligence for seafood processors"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
