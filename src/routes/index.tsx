import { createFileRoute } from "@tanstack/react-router";
import { Browser } from "@/components/browser/Browser";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Browser />;
}
