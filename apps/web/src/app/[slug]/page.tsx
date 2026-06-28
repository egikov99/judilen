import type { Metadata } from "next";
import { contentPages, db } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal-page";

async function getPage(slug: string) {
  const [page] = await db.select().from(contentPages).where(and(
    eq(contentPages.slug, slug),
    eq(contentPages.isPublished, true)
  )).limit(1);
  return page;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await getPage((await params).slug);
  return page ? {
    title: page.seoTitle,
    description: page.seoDescription,
    alternates: { canonical: `/${page.slug}` }
  } : {};
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = await getPage((await params).slug);
  if (!page) notFound();
  const body = typeof page.content.body === "string" ? page.content.body : "";
  return <LegalPage title={page.title}>{body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</LegalPage>;
}
