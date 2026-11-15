import { RecordView } from "@/components/RecordView";

export default async function PaperPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = await params;
  return <RecordView paperId={decodeURIComponent(paperId)} />;
}
