import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Усадьба «Юдилен»",
    short_name: "Юдилен",
    description: "Бронирование домиков в усадьбе «Юдилен»",
    start_url: "/",
    display: "standalone",
    background_color: "#f9faf2",
    theme_color: "#154212",
    lang: "ru"
  };
}

