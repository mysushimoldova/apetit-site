import { IconBase, type IconProps } from "./icon-base";

// Десерт — пышный сырник с зигзагом сиропа
export function IconDesert(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.8 12.6c-.3-3.3 2.9-5.7 7.3-5.7 4.3 0 7.4 2.3 7.2 5.6" />
      <path d="M4.7 12.8c.1 3.4 3.1 5.6 7.4 5.5 4.2 0 7.1-2.3 7.2-5.5" />
      <path d="M3.9 12.7h16.3" />
      <path d="M8.1 9.6l1.6 1.7 1.7-1.8 1.7 1.8 1.7-1.8 1.4 1.5" />
      <path d="M11.9 5.1v1.4" />
    </IconBase>
  );
}
