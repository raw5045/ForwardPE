import { AppNav } from "@/components/app-nav";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forward P/E",
  description: "Internal forward P/E dashboard"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
