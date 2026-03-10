import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-[#E0E0E0] bg-white ${className}`.trim()}
      {...props}
    />
  );
}

type SectionProps = {
  children: ReactNode;
  className?: string;
};

export function CardHeader({ children, className = "" }: SectionProps) {
  return <div className={className}>{children}</div>;
}

export function CardTitle({ children, className = "" }: SectionProps) {
  return <h2 className={`text-base font-semibold ${className}`.trim()}>{children}</h2>;
}

export function CardDescription({ children, className = "" }: SectionProps) {
  return <p className={`text-xs text-[#6A7C8E] ${className}`.trim()}>{children}</p>;
}
