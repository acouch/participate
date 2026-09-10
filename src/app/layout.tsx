import type { Metadata } from "next";
import "./globals.css";
import Menu from "@/src/components/Menu";
import Footer from "@/src/components/Footer";
import FeedbackWidget from "@/src/components/FeedbackWidget";
import { getCurrentUser } from "@/src/lib/session";
import appleTouchIcon from "@/src/assets/favicon/apple-touch-icon.png";
import favicon16 from "@/src/assets/favicon/favicon-16x16.png";
import favicon32 from "@/src/assets/favicon/favicon-32x32.png";

export const metadata: Metadata = {
  title: "Make your own Philly Budget",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <head>
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href={appleTouchIcon.src}
        ></link>
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href={favicon16.src}
        ></link>
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href={favicon32.src}
        ></link>
      </head>
      <body>
        <Menu user={user && { name: user.name, email: user.email }} />
        {children}
        <Footer />
        <FeedbackWidget />
      </body>
    </html>
  );
}
