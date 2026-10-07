import { ResourceList } from "@/components/admin/resources";
export const metadata = { title: "Manage companies" };
export default function Page() {
  return <ResourceList resource="companies" />;
}
