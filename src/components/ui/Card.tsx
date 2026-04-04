import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm",
        "dark:border-zinc-800 dark:bg-zinc-900",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return <div className={cn("mb-4 flex items-start justify-between", className)}>{children}</div>;
}

export function CardTitle({ className, children }: CardProps) {
  return (
    <h3 className={cn("text-base font-semibold text-zinc-900 dark:text-zinc-100", className)}>
      {children}
    </h3>
  );
}

export function CardBody({ className, children }: CardProps) {
  return <div className={cn("text-sm text-zinc-600 dark:text-zinc-400", className)}>{children}</div>;
}
