import { IconBase, type IconProps } from "./icon-base";

// Напитки — стакан с трубочкой и льдом
export function IconDrinks(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.2 7.1h11.6l-1.2 12.1c-.1 1-.9 1.6-1.9 1.6H9.3c-1 0-1.8-.7-1.9-1.6L6.2 7.1z" />
      <path d="M6.6 11.5c3.7-1.1 7.2-1.1 10.8 0" />
      <path d="M12.5 7l2.8-3.9 1.7.6" />
      <path d="M9.4 14.2l1.9.1M13.1 15.6l1.5-.1" />
    </IconBase>
  );
}
