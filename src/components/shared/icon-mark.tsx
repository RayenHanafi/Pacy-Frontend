/**
 * The app mark, as plain elements so it can be rendered by `next/og` into PNGs
 * at build time.
 *
 * Deliberately text-free: `ImageResponse` needs font data to draw glyphs, and
 * shapes keep the icon dependency-free. A medical cross whose vertical bar is
 * broken into segments — one prescription, divided into countable fills.
 *
 * Placeholder until the real logo lands; swap this one file and every icon
 * size, the favicon and the apple-touch icon all follow.
 */
export function IconMark({ size }: { size: number }) {
  const unit = size / 16;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // The brand gradient: Dark Teal → Teal → Seagrass.
        backgroundImage:
          "linear-gradient(135deg, #014342 0%, #107d7c 55%, #5c9682 100%)",
        borderRadius: unit * 3.5,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          width: unit * 9,
          height: unit * 9,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Horizontal bar */}
        <div
          style={{
            position: "absolute",
            width: unit * 9,
            height: unit * 2.6,
            background: "#ffffff",
            borderRadius: unit * 1.3,
          }}
        />
        {/* Vertical bar, split into two fills with a gap between them */}
        <div
          style={{
            position: "absolute",
            top: 0,
            width: unit * 2.6,
            height: unit * 3.1,
            background: "#ffffff",
            borderRadius: unit * 1.3,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            width: unit * 2.6,
            height: unit * 3.1,
            background: "#ffffff",
            borderRadius: unit * 1.3,
          }}
        />
      </div>
    </div>
  );
}
