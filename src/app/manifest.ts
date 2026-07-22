import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pacy — Prescription Trust Network",
    short_name: "Pacy",
    description:
      "One prescription. One token. One time. Prescription tokenization on Cardano.",
    // The public landing page is also the installed app's entry point. From
    // there, the CTA opens the existing sign-in and role-routing flow.
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#107d7c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // The supplied square mark has enough white safe area to survive Android
      // masks without needing a separately padded asset.
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
