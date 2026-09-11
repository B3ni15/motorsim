import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BMW M52B28 szimuláció",
  description: "BMW M52B28 soros hathengeres motor és E36 328i jármű élő fizikai szimulációja",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
