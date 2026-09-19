import type { SVGProps } from "react";

// Общая основа рисованных иконок категорий (DESIGN.md → Hand-drawn Icons):
// 24×24, одна линия 1.6px, Ink через currentColor, скруглённые концы.
// Декоративные: aria-hidden, подпись даёт текст чипа.
export type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

export function IconBase({
  className,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}
