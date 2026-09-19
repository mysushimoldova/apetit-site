import { IconBase, type IconProps } from "./icon-base";

// Комбо — поднос: картошка в стаканчике и коробка
export function IconMenu(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.3 19.4h17.5" />
      <path d="M4.6 12.1h5.1l-.6 7.2H5.3l-.7-7.2z" />
      <path d="M5.6 12l.3-3.3M7.1 12V7.5M8.7 12l-.2-3.1" />
      <path d="M12.8 9.4h6.4l-.9 9.9h-4.6l-.9-9.9z" />
      <path d="M13.3 13.1h5.5" />
    </IconBase>
  );
}
