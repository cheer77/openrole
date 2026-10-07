import { ResourceList } from "@/components/admin/resources";
export const metadata = { title: "Manage sources" };
export default function Page() {
  return <ResourceList resource="sources" />;
}
