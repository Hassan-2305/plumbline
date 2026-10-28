"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Workspace } from "@/components/review/Workspace";
import { Skeleton } from "@/components/ui";

function NewReview() {
  const example = useSearchParams().get("example") ?? undefined;
  return <Workspace key={example ?? "blank"} itemId={null} prefill={example} />;
}

export default function NewReviewPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <NewReview />
    </Suspense>
  );
}
