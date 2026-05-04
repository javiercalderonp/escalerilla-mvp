import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function AdminSemanaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  const { id } = await params;
  redirect(`/admin/semanas/${id}/fixture`);
}
