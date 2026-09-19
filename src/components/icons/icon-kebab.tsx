import { IconBase, type IconProps } from "./icon-base";

// Кебаб — завёрнутый лаваш по диагонали, штрихи гриля, начинка с одного конца
export function IconKebab(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.2 17.4c-1.1-1.2-.9-2.6.4-3.8L14.1 4.3c1.2-1.1 2.7-1.1 3.8 0l1.7 1.6c1.1 1.1 1 2.6-.2 3.8l-9.3 9.4c-1.2 1.2-2.6 1.3-3.7.3z" />
      <path d="M4.5 13.7c1 .1 2.1.8 2.9 1.7.8.9 1.3 2 1.3 3" />
      <path d="M9.6 9.1l3.5 3.4M12.4 6.6l3.6 3.4" />
      <path d="M5.3 18.5c-.4-.6-.2-1.3.4-1.4.6-.2 1.2.3 1.1 1" />
    </IconBase>
  );
}
