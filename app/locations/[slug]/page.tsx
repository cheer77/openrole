import { SeoLanding, landingMetadata, landingPageNumber } from "@/lib/seo-landing";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
export async function generateMetadata({ params, searchParams }: Props) {
  return landingMetadata("location", (await params).slug, landingPageNumber((await searchParams).page));
}
export default async function Page({ params, searchParams }: Props) {
  return <SeoLanding kind="location" slug={(await params).slug} page={landingPageNumber((await searchParams).page)} />;
}
