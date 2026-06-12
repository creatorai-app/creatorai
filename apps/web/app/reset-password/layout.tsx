import type { Metadata } from "next";
import { createMetadata, noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Reset Password",
  description: "Set a new password for your Creator AI account.",
  alternates: { canonical: "/reset-password" },
  robots: noIndexRobots,
});

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
