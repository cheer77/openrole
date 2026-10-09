import { SeoLanding, landingMetadata, landingPageNumber } from "@/lib/seo-landing";
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ page?: string }> };
export async function generateMetadata({ searchParams }: Props) {
  return landingMetadata("remote", "remote", landingPageNumber((await searchParams).page));
}
export default async function Page({ searchParams }: Props) {
  return <SeoLanding kind="remote" slug="remote" page={landingPageNumber((await searchParams).page)} />;
}
