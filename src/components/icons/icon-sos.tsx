import { IconBase, type IconProps } from "./icon-base";

// Соус — соусник с каплей
export function IconSos(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.6 11.4h14.9c-.2 4.5-2.4 7.9-7.4 8.1-5 .1-7.4-3.5-7.5-8.1z" />
      <path d="M6.3 11.3c1.2-1.4 2.9-1.9 5.5-1.9 2.7 0 4.5.5 5.7 1.8" />
      <path d="M12.1 4.2c-.9 1.3-1.6 2.3-1.6 3.2 0 .9.7 1.5 1.6 1.5s1.6-.6 1.6-1.5c0-.9-.7-1.9-1.6-3.2z" />
      <path d="M5.2 15.4h13.7" />
    </IconBase>
  );
}
