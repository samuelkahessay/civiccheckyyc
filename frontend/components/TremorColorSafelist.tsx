'use client'

// Ensures Tailwind emits the color utilities Tremor uses for charts.
// Tremor generates class names at runtime (e.g. fill-blue-500 for slices
// and bg-blue-500 for our custom legend). In Tailwind v4 these dynamic
// classes can be purged unless referenced somewhere statically, so we
// include them on a hidden element to force generation.
export function TremorColorSafelist() {
  return (
    <div
      className="hidden
        fill-blue-500 fill-cyan-500 fill-sky-500 fill-indigo-500 fill-violet-500 fill-purple-500 fill-fuchsia-500 fill-pink-500 fill-rose-500 fill-red-500 fill-orange-500 fill-amber-500 fill-yellow-500 fill-lime-500 fill-green-500 fill-emerald-500 fill-teal-500
        dark:fill-blue-500 dark:fill-cyan-500 dark:fill-sky-500 dark:fill-indigo-500 dark:fill-violet-500 dark:fill-purple-500 dark:fill-fuchsia-500 dark:fill-pink-500 dark:fill-rose-500 dark:fill-red-500 dark:fill-orange-500 dark:fill-amber-500 dark:fill-yellow-500 dark:fill-lime-500 dark:fill-green-500 dark:fill-emerald-500 dark:fill-teal-500
        bg-blue-500 bg-cyan-500 bg-sky-500 bg-indigo-500 bg-violet-500 bg-purple-500 bg-fuchsia-500 bg-pink-500 bg-rose-500 bg-red-500 bg-orange-500 bg-amber-500 bg-yellow-500 bg-lime-500 bg-green-500 bg-emerald-500 bg-teal-500
        dark:bg-blue-500 dark:bg-cyan-500 dark:bg-sky-500 dark:bg-indigo-500 dark:bg-violet-500 dark:bg-purple-500 dark:bg-fuchsia-500 dark:bg-pink-500 dark:bg-rose-500 dark:bg-red-500 dark:bg-orange-500 dark:bg-amber-500 dark:bg-yellow-500 dark:bg-lime-500 dark:bg-green-500 dark:bg-emerald-500 dark:bg-teal-500
      "
    />
  )
}
