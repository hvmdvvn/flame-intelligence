import type { Metadata } from "next";
import localFont from "next/font/local";
import { Shell } from "@/components/Chrome";
import "./globals.css";

const display = localFont({src:"../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",variable:"--font-display-loaded",weight:"200 800",display:"swap"});
const body = localFont({src:"../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",variable:"--font-body-loaded",weight:"100 900",display:"swap"});


export const metadata: Metadata = {
  title: {
    default: "Fire in Free-Fall · Flame Intelligence",
    template: "%s · Flame Intelligence",
  },
  description:
    "Search NASA combustion experiments, compare reported measurements, and read the original publications on fire in microgravity.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} data-theme="daylight" suppressHydrationWarning>
      <body className="font-sans text-brass antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('flame-theme-v2');if(t==='daylight'||t==='ember')document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
