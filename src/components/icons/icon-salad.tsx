import { IconBase, type IconProps } from "./icon-base";

// Салат — миска с листьями
export function IconSalad(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.4 12.3h17.3c-.3 4.2-3.4 7.2-8.5 7.3-5.2.1-8.5-3-8.8-7.3z" />
      <path d="M7.4 12.1c-.6-2.2.2-4.4 2.1-5.3 1.4 1.1 2 2.7 1.8 4.9" />
      <path d="M11.6 11.9c.4-3 2.4-5 5-5.6.7 2.4-.1 4.6-2.1 5.8" />
      <path d="M13.8 12c1.7-1.5 3.8-1.9 5.6-1" />
      <path d="M8.9 19.6h6.2" />
    </IconBase>
  );
}
