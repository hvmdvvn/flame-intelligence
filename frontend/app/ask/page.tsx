import { Docket } from "@/components/Docket";

export default async function AskPage({ searchParams }: { searchParams: Promise<{ paper?: string; q?: string }> }) {
  const query = await searchParams;
  return <Docket initialPaper={query.paper ? decodeURIComponent(query.paper) : ""} initialQuestion={query.q ?? ""} />;
}
