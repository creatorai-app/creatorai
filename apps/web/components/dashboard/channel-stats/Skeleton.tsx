import { Skeleton } from "@repo/ui/skeleton";

export default function ChannelStatsSkeleton() {
    return (
        <div className="container py-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-52" />
                    <Skeleton className="h-5 w-72" />
                </div>
                <Skeleton className="h-10 w-36 rounded-xl" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Left sidebar skeletons */}
                <div className="space-y-6">
                    <Skeleton className="h-60 rounded-2xl" />
                    <Skeleton className="h-52 rounded-2xl" />
                </div>

                {/* Right content skeletons */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                    </div>
                    <Skeleton className="h-80 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
            </div>
        </div>
    );
}