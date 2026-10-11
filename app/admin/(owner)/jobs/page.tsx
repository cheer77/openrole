import { ResourceList } from "@/components/admin/resources";
export const metadata = { title: "Manage jobs" };
export default async function Page({ searchParams }: { searchParams: Promise<{ entity?: string; status?: string }> }) {
  const query = await searchParams;
  return <ResourceList resource="jobs" initialEntity={query.entity} initialStatus={query.status} />;
}
