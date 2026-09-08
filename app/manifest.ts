import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "小火車工坊",
    short_name: "小火車",
    description: "組裝你的專屬小火車,然後到軌道上開動!",
    start_url: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#dff1fb",
    theme_color: "#8ecdf5",
    icons: [
      { src: "/icon", sizes: "256x256", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
