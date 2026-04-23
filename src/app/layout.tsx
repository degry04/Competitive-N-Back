import type { Metadata } from "next";
import { TRPCProvider } from "@/trpc/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Competitive N-back",
  description: "Соревновательный N-back с влиянием ошибок"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
