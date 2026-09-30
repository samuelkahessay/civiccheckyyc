/**
 * Archive banner shown when the snapshot is opened directly.
 *
 * skahessay.dev shows this app inside its own archive frame, which already
 * carries the archive notice, so the inline script hides the banner there.
 * It runs before first paint, so the framed view never flashes the banner.
 */
const HIDE_WHEN_FRAMED =
  "if(window.self!==window.top){document.getElementById('archive-banner').hidden=true}"

export function ArchiveBanner() {
  return (
    <>
      <div
        id="archive-banner"
        role="note"
        suppressHydrationWarning
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gray-900 px-4 py-2 text-center text-sm text-gray-100"
      >
        <span>
          <strong className="font-semibold">Archived 2025 election snapshot.</strong> Not
          current voter guidance.
        </span>
        <a
          href="https://skahessay.dev/archive#civiccheckyyc"
          className="underline underline-offset-2 hover:text-white"
        >
          About this archive
        </a>
      </div>
      <script dangerouslySetInnerHTML={{ __html: HIDE_WHEN_FRAMED }} />
    </>
  )
}
