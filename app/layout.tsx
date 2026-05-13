import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume ATS Optimizer",
  description: "Tailor resume sections to job descriptions with controlled ATS improvements."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
