import { ImageResponse } from "next/og";
import { IconMark } from "@/components/shared/icon-mark";

// iOS home-screen icon. iOS ignores the manifest for this and reads the
// apple-touch-icon link, which Next injects from this route.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<IconMark size={180} />, size);
}
