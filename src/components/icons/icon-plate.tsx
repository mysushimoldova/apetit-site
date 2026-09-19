import { IconBase, type IconProps } from "./icon-base";

// Тарелка — заглушка «нет фото» и категория без своей иконки
export function IconPlate(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.6c4.7-.1 8.5 3.6 8.5 8.3s-3.8 8.5-8.5 8.5-8.5-3.8-8.5-8.5S7.3 3.7 12 3.6z" />
      <path d="M12 7.9c2.3 0 4.1 1.8 4.1 4.1s-1.8 4.1-4.1 4.1-4.1-1.8-4.1-4.1S9.7 7.9 12 7.9z" />
      <path d="M6.3 15.9c1 1.5 2.6 2.5 4.6 2.7" />
    </IconBase>
  );
}
