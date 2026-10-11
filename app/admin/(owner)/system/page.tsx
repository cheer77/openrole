import { SystemPage } from "@/components/admin/control-pages";
import platformPackage from "@/package.json";
export const metadata = { title: "System" };
export default function Page() { return <SystemPage version={platformPackage.version} />; }
