// Иконка категории по имени из данных (categories.ts → icon).
import { IconBurger } from "./icon-burger";
import { IconCrispy } from "./icon-crispy";
import { IconDesert } from "./icon-desert";
import { IconDrinks } from "./icon-drinks";
import { IconGozleme } from "./icon-gozleme";
import { IconHotDog } from "./icon-hot-dog";
import { IconKebab } from "./icon-kebab";
import { IconMenu } from "./icon-menu";
import { IconPizza } from "./icon-pizza";
import { IconPlate } from "./icon-plate";
import { IconSalad } from "./icon-salad";
import { IconSandwich } from "./icon-sandwich";
import { IconSos } from "./icon-sos";
import type { IconProps } from "./icon-base";

export const CATEGORY_ICONS = {
  kebab: IconKebab,
  burger: IconBurger,
  gozleme: IconGozleme,
  crispy: IconCrispy,
  "hot-dog": IconHotDog,
  sandwich: IconSandwich,
  salad: IconSalad,
  pizza: IconPizza,
  sos: IconSos,
  drinks: IconDrinks,
  menu: IconMenu,
  desert: IconDesert,
  plate: IconPlate,
} as const;

export type IconName = keyof typeof CATEGORY_ICONS;

export function CategoryIcon({ name, ...props }: { name: string } & IconProps) {
  const Icon = CATEGORY_ICONS[name as IconName] ?? IconPlate;
  return <Icon {...props} />;
}
