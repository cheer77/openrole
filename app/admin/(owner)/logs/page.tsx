import { ResourceList } from "@/components/admin/resources";
export const metadata = { title: "Manage logs" };
export default function Page() {
  return <ResourceList resource="logs" />;
}
