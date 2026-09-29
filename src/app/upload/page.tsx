import Image from "next/image";
import { UploadForm } from "@/components/UploadForm";
import { PageHeader } from "@/components/ui";

const WAREHOUSE_PHOTO = "https://images.unsplash.com/photo-1553413077-190dd305871c";

const STEPS = [
  ["Read", "Text is pulled from the file. Nothing else about the file is used."],
  ["Score", "Each of the four behaviours gets 0–3, with the exact CV line as evidence. Quotes that aren't in the CV are marked unclear."],
  ["Rank", "Bands, overrides and ranking are calculated the same way every time."],
  ["Brief", "Who they are, why they ranked there, and what to ask in the interview."],
];

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Every CV is scored on both the PM and SPM rubrics" title="Add CVs" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <UploadForm />
        <aside className="card overflow-hidden p-0">
          <Image src={WAREHOUSE_PHOTO} alt="Warehouse aisle with stacked pallets" width={800} height={500} sizes="(min-width: 1280px) 33vw, 100vw" className="h-40 w-full object-cover" />
          <div className="p-5 sm:p-6">
            <h2 className="font-display text-lg font-medium">What happens to each CV</h2>
            <ol className="mt-4 space-y-4">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent">
                    {i + 1}
                  </span>
                  <div className="text-sm">
                    <p className="font-medium">{title}</p>
                    <p className="text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-line pt-4 text-xs text-faint">
              Titles, years of experience, degrees, company names and tool lists are never scored.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
