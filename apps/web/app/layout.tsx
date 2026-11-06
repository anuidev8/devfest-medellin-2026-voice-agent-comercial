import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Type: Helvetica Neue for everything (system stack, see globals.css). IBM Plex Mono only for tool names and data.
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Concierge Comercial de Voz — ADK + AG-UI + LiveKit",
  description: "Agente comercial con Google ADK (TypeScript), CopilotKit/AG-UI Generative UI y LiveKit voice.",
};

// Applies the saved theme before paint so the stage never flashes light.
const themeScript = `try{var t=localStorage.getItem("cva-theme");if(t==="light"){document.documentElement.classList.remove("dark");document.documentElement.classList.add("light")}}catch(e){}`;
// Marks <html data-intro> before paint when the cinematic intro hasn't played this session (no flash either way).
const introScript = `try{if(sessionStorage.getItem("cva-intro-seen")!=="1")document.documentElement.setAttribute("data-intro","1")}catch(e){document.documentElement.setAttribute("data-intro","1")}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`dark h-full antialiased ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
