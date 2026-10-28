"use client";

import { useParams } from "next/navigation";
import { Workspace } from "@/components/review/Workspace";

export default function ReviewItemPage() {
  const { id } = useParams<{ id: string }>();
  return <Workspace key={id} itemId={id} />;
}
