import { ResourceList } from "@/components/admin/resources";
export const metadata = { title: "Manage companies" };
export default async function Page({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  return <ResourceList resource="companies" initialEntity={(await searchParams).entity} />;
}
