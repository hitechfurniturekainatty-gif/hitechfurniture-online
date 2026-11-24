// Which photo goes where on a quotation item (display only — nothing is saved).
//
//  * Staff photo (item_image_url) always wins the Image column.
//  * Ready-stock item with no staff photo and no sketch: the Output Books / catalog
//    photo IS the product, so it goes in the Image column.
//  * Otherwise the catalog photo is only a reference: shown small, labelled
//    "Reference only – not final model".
//  * Custom items (made to order): the catalog photo is never the product. It is
//    shown only on the quotation as a reference, and hidden on delivery notes,
//    worker jobs, warehouse and supplier orders (use `workPhotoCatalog`).
import { firstUrl } from "@/lib/firstUrl";
import { isCustomItem, type PhotoGateItem } from "@/lib/orderPhotoGate";

export const REFERENCE_LABEL = "Reference only – not final model";

export type ItemPhotoRoles = {
  /** Photo for the Image column (null = show the empty box). */
  main: string | null;
  /** Catalog photo to show small with REFERENCE_LABEL (null = none). */
  reference: string | null;
};

export function itemPhotoRoles(it: PhotoGateItem): ItemPhotoRoles {
  const staff = firstUrl(it.item_image_url);
  const catalog = firstUrl(it.catalog_image_url);
  const sketch = firstUrl(it.sketch_url);
  if (staff) return { main: staff, reference: catalog };
  if (catalog && !sketch && !isCustomItem(it)) return { main: catalog, reference: null };
  return { main: null, reference: catalog };
}

/** Catalog photo for shop-floor documents: hidden for custom items. */
export function workPhotoCatalog(it: PhotoGateItem): string | null {
  return isCustomItem(it) ? null : firstUrl(it.catalog_image_url);
}
