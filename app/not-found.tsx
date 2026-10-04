import Link from "next/link";
import { Icon } from "@/components/icon";
export default function NotFound() {
  return (
    <main id="main-content" className="container empty-state not-found">
      <span>
        <Icon name="search" size={30} />
      </span>
      <h1>This role isn’t here.</h1>
      <p>
        The link may be incomplete. There are more opportunities waiting for
        you.
      </p>
      <Link href="/jobs" className="primary-button">
        Explore all jobs <Icon name="arrow" />
      </Link>
    </main>
  );
}
