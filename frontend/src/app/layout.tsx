import type { Metadata } from "next";
import "./generated.css";

export const metadata: Metadata = {
  title: "LAUT",
  description: "Production intelligence for seafood processors"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* Browser extensions inject attributes onto <body> before React hydrates,
          which React otherwise reports as a hydration mismatch. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
