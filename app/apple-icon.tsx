import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon on iOS. Opaque background — iOS doesn't do transparency here. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3E7BD6",
        }}
      >
        <div
          style={{
            width: 138,
            height: 138,
            borderRadius: 69,
            background: "#33333a",
            border: "8px solid #D6432E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 37,
                height: 43,
                borderRadius: 22,
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: "#1c1c1f",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
