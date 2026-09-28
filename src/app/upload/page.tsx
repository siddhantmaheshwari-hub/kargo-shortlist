import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add CVs</h1>
        <p className="mt-1 text-sm text-muted">
          Each CV is scored on both the PM and SPM rubrics. Candidates can move between lists by the cross-route rule.
        </p>
      </div>
      <UploadForm />
    </div>
  );
}
