import { ImageResponse } from "next/og";
import { IconMark } from "@/components/shared/icon-mark";

// Prerendered at build time so the manifest points at a plain static PNG.
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(<IconMark size={512} />, {
    width: 512,
    height: 512,
  });
}
