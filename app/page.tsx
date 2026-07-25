import type { Metadata } from "next";
import { headers } from "next/headers";
import KingdomApp from "./KingdomApp";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const image = host ? `${protocol}://${host}/og.png` : undefined;
  const title = "한자별곡 — 안개 왕국의 비밀";
  const description = "한자의 힘으로 검은 안개를 걷고 왕국을 되찾는 초등 한자 8급 모험";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: image ? [{ url: image, width: 1536, height: 909, alt: "한자별곡 왕국 지도" }] : [] },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : [] },
  };
}

export default function Home() {
  return <KingdomApp />;
}
