/**
 * Pure product selection for the waiter Menu. visibleProducts filters the
 * supplied catalog and orders matches using configured categories without
 * fetching data or modifying the original product array.
 */
import type { Product } from "../../../../../../packages/contracts/src/index";

type Filter = {
  search: string;
  category: string;
  favoritesOnly: boolean;
  favorites: string[];
  categoryOrder: string[];
};

/**
 * Search both translated names. Categories absent from categoryOrder have index
 * -1 and therefore sort before listed categories; equal ranks keep input order.
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
