import { Skeleton } from '@/components/ui/skeleton'

/** Stable first-paint geometry shared by repository-backed workspace views. */
export function WorkspaceViewSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-7 w-2/5 rounded-lg" />
        <Skeleton className="h-4 w-3/4 rounded-md" />
      </div>
      <div className="grid gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </div>
  )
}
