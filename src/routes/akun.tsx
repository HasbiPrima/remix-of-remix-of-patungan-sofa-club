import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/akun")({
  component: AkunLayout,
});

function AkunLayout() {
  return <Outlet />;
}
