import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VW Golf 7.5 R szimuláció",
  description: "Volkswagen Golf 7.5 R (2019) élő fizikai szimulációja: EA888 turbómotor, 6 fokozatú kézi váltó, 4MOTION, belső nézet, röntgen nézet, maradandó károk",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
