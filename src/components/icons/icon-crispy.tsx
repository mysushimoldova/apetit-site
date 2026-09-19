import { IconBase, type IconProps } from "./icon-base";

// Криспи — куриная ножка с хрустящей корочкой (точки)
export function IconCrispy(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M15.6 4.2c2.7-.6 4.7 1.3 4.2 3.9-.4 2.2-2.6 3.6-4.5 5.2l-4.4 3.9c-1.7 1.4-3.9 1-4.7-.9-.8-1.9.4-3.7 2.2-5l4.9-3.4c1.1-.8 1.4-1.9 2.3-3.7z" />
      <path d="M6.9 16.4l-2.1 2.2M5.4 15.3c-1.1.3-1.9 1.4-1.7 2.5M6.1 18.8c.3 1.1-.5 2.2-1.6 2.3" />
      <path d="M12.6 9.1h.1M15.2 10.6h.1M13.9 12.3h.1" />
    </IconBase>
  );
}
