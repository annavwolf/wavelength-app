import type { Metadata } from "next";
import "./globals.css";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "Wavelength",
  description: "An AI organisational psychologist for virtual teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="px-8 py-6">
            <img
              src="/logo-wordmark.png"
              alt="Wavelength"
              className="h-8 w-auto"
            />
          </header>
          <AuthGate>{children}</AuthGate>
        </div>
      </body>
    </html>
  );
}
