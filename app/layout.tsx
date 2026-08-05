import type { Metadata } from "next";
import { Big_Shoulders, Inter, IBM_Plex_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "OwnYourMusic",
  description: "Own your catalog. Switch distributors in hours, not weeks.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Real session only — DEV_USER_ID is a silent local-dev fallback baked
  // into data access (lib/auth/currentUser.ts), not something the nav
  // should pretend is a logged-in user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${bigShoulders.variable} ${inter.variable} ${plexMono.variable}`}
    >
      <body className="font-sans" style={{ fontFamily: "var(--font-body)" }}>
        <NavBar userEmail={user?.email ?? null} />
        {children}
      </body>
    </html>
  );
}
