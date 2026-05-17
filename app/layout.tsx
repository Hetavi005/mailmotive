import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MailMotive",
  description: "HiWi professor outreach and email scheduling portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}