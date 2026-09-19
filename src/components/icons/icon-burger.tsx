import { IconBase, type IconProps } from "./icon-base";

// Бургер — булочка с кунжутом, волнистая котлета, низ
export function IconBurger(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.1 10.2c.3-3.7 3.8-5.9 7.9-5.9s7.7 2.1 8 5.8" />
      <path d="M3.6 13.1c2 .9 3.1-1 5.2 0 2 1 3.2-.9 5.3 0 2 .9 3.2-1 5.2 0" />
      <path d="M4.3 15.8h15.4c.1 2.3-1.5 3.9-3.8 3.9H8.2c-2.3 0-3.9-1.6-3.9-3.9z" />
      <path d="M8.6 7.6h.1M12 6.8h.1M15.4 7.7h.1" />
    </IconBase>
  );
}
