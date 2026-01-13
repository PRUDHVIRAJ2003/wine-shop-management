import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wine Shop Management System",
  description: "Complete management system for wine shops with daily stock and cash tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
