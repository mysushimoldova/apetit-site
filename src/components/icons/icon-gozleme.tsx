import { IconBase, type IconProps } from "./icon-base";

// Гёзлеме — сложенная пополам лепёшка, волнистый край начинки
export function IconGozleme(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.4 15.9c.4-5.4 4.4-9.6 9.1-9.5 4.4.1 8 3.9 8.2 9.2" />
      <path d="M3.3 16.1c1.4-.7 2.3.9 3.7.3 1.4-.7 2.3.8 3.7.2s2.3.9 3.7.3c1.4-.7 2.3.8 3.7.2 1.1-.5 1.9.2 2.6.5" />
      <path d="M7.2 12.4c1.6-2.1 4.2-2.9 6.6-2.2" />
    </IconBase>
  );
}
