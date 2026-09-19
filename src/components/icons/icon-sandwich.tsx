import { IconBase, type IconProps } from "./icon-base";

// Сэндвич — чиабатта: два хлеба и начинка, надрезы сверху
export function IconSandwich(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.6 10.1c-.1-1.6 1.1-2.8 2.9-2.9l11.1-.4c1.8-.1 3 1.1 3 2.7" />
      <path d="M3.4 12.2h17.2c.4 0 .5.5.2.8-.4.4-.9.8-1.4.8H4.9c-.6 0-1.1-.5-1.5-.9-.3-.3-.3-.7 0-.7z" />
      <path d="M4.2 15.4c.1 1.4 1.3 2.5 2.9 2.5h10c1.6 0 2.8-1.1 2.9-2.5" />
      <path d="M7.5 7.1l2.3-2.5M11.6 7l2.2-2.4" />
    </IconBase>
  );
}
