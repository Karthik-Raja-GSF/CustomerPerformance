// TODO: SIQ Import temporarily disabled - will be reformed with new architecture
// This page handled Excel file upload for SIQ Forecast Analysis data
// Features: Drag-and-drop upload, column validation, real-time progress via SSE, import history
// Original implementation: 676 lines - preserved in git history

export default function SiqImport() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <h1 className="text-lg font-semibold">SIQ Import</h1>
      <p className="text-muted-foreground">
        This feature is temporarily disabled and will be available in a future
        release.
      </p>
    </div>
  );
}
