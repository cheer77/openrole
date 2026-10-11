import { ResourceList } from "@/components/admin/resources";
export const metadata = { title: "Manage sources" };
export default async function Page({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  return <ResourceList resource="sources" initialEntity={(await searchParams).entity} />;
}
