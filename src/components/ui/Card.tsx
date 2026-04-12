import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-stone-200 bg-white p-6 shadow-sm",
        "dark:border-stone-800 dark:bg-stone-900",
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
    <h3 className={cn("text-base font-semibold text-stone-900 dark:text-stone-100", className)}>
      {children}
    </h3>
  );
}

export function CardBody({ className, children }: CardProps) {
  return <div className={cn("text-sm text-stone-600 dark:text-stone-400", className)}>{children}</div>;
}
