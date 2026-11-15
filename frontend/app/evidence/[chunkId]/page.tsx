import { PassageLens } from "@/components/PassageLens";

export default async function EvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ chunkId: string }>;
  searchParams: Promise<{ quote?: string }>;
}) {
  const { chunkId } = await params;
  const query = await searchParams;
  return (
    <PassageLens
      chunkId={decodeURIComponent(chunkId)}
      quote={query.quote ? decodeURIComponent(query.quote) : ""}
    />
  );
}
