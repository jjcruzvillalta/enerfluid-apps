
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter as a standard font, similar to current
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Enerfluid Apps",
    description: "Plataforma integral de Enerfluid",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es">
            <body className={inter.className}>{children}</body>
        </html>
    );
}
