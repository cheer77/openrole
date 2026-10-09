import { OwnerLogin } from "@/components/admin/login";
export const metadata = { title: "Owner sign in", robots: { index: false, follow: false } };
export default function LoginPage() {
  return (
    <main id="main-content" className="owner-login">
      <OwnerLogin />
    </main>
  );
}
