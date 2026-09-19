import { IconBase, type IconProps } from "./icon-base";

// Хот-дог — булка, сосиска, зигзаг горчицы
export function IconHotDog(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.3 13.4c-.2-1.8 1.2-3.1 3.1-3.1h11.3c1.9 0 3.2 1.3 3 3.1" />
      <path d="M3.3 13.6c.2 1.9 1.6 3.2 3.4 3.2h10.9c1.8 0 3.2-1.3 3.3-3.2" />
      <path d="M5.1 10.2c.3-1.7 1.6-2.7 3.2-2.7h7.6c1.6 0 2.9 1 3.1 2.6" />
      <path d="M6.8 12.9l1.7 1.6 1.7-1.7 1.8 1.7 1.7-1.7 1.8 1.7 1.7-1.6" />
    </IconBase>
  );
}
