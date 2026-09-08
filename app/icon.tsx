import { ImageResponse } from "next/og";

export const size = { width: 256, height: 256 };
export const contentType = "image/png";

/** A smokebox door with a face — generated at build time, no binary asset needed. */
export default function Icon() {
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
            width: 196,
            height: 196,
            borderRadius: 98,
            background: "#33333a",
            border: "10px solid #D6432E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 52,
                height: 60,
                borderRadius: 30,
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
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
