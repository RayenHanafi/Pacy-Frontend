import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pacy — prescription tokenization",
    short_name: "Pacy",
    description:
      "One prescription. One token. One time. Prescription tokenization on Cardano.",
    // The patient holds a phone up to a scanner; the doctor and pharmacy views
    // are desktop. `start_url` is the role router, which sends each of them on.
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#3f7a50",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Same file entered twice rather than one "any maskable" entry, which
      // Next's manifest type doesn't accept. The mark sits well inside the
      // safe zone, so it survives Android's mask without a padded variant.
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
