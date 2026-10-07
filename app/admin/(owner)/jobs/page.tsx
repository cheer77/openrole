import { ResourceList } from "@/components/admin/resources";
export const metadata = { title: "Manage jobs" };
export default function Page() {
  return <ResourceList resource="jobs" />;
}
