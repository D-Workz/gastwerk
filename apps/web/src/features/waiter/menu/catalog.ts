/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import type { Product } from "../../../../../../packages/contracts/src/index";

/* --- Public API --- */


type Filter = {
  search: string;
  category: string;
  favoritesOnly: boolean;
  favorites: string[];
  categoryOrder: string[];
};

/**
 * visibleProducts - exported function
 */
export function visibleProducts(
  products: Product[],
  filter: Filter,
): Product[] {
  const search = filter.search.toLocaleLowerCase();
  return products
    .filter(
      (p) =>
        p.active &&
        p.available &&
        (!filter.category || p.category === filter.category) &&
        (!filter.favoritesOnly || filter.favorites.includes(p.id)) &&
        `${p.name.de} ${p.name.en}`.toLocaleLowerCase().includes(search),
    )
    .sort(
      (a, b) =>
        filter.categoryOrder.indexOf(a.category) -
        filter.categoryOrder.indexOf(b.category),
    );
}
