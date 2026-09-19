import { IconBase, type IconProps } from "./icon-base";

// Пицца — ломтик с корочкой и кружочками пепперони
export function IconPizza(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.2 5.6c5.3-2.6 10.8-2.5 15.9.2L12.3 20.4 4.2 5.6z" />
      <path d="M5.4 8c4.5-2 9-2 13.4.1" />
      <path d="M10.1 10.6c.6-.1 1 .3 1 .9s-.5 1-1 .9c-.6 0-1-.4-1-.9s.4-.9 1-.9zM13.9 11.9c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9zM11.6 15.2c.5 0 .8.4.8.8s-.3.8-.8.8-.8-.4-.8-.8.3-.8.8-.8z" />
    </IconBase>
  );
}
