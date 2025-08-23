import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./global.css";
import { Toaster } from "sonner";

const prompt = Prompt({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KCW V3",
  description: "",
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${prompt.className} antialiased h-full`}>
        {children}
        <Toaster richColors /> {/* keep this at the bottom of body */}
      </body>
    </html>
  );
}
