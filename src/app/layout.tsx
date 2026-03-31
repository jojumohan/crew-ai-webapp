import type { Metadata, Viewport } from "next";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0B0E14",
};

export const metadata: Metadata = {
  title: "Messaging Rebuild",
  description: "WhatsApp-style messaging app rebuild with chat, groups, media, and calls.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
