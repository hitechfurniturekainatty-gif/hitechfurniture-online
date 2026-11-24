import { describe, expect, it } from "vitest";
import { itemPhotoRoles, workPhotoCatalog } from "./itemPhotos";

const OB = "https://books.hitechfurniture.online/x.jpg";
const STAFF = "https://cdn/staff.jpg";

describe("itemPhotoRoles", () => {
  it("ready stock with only the OB photo puts it in the Image column", () => {
    expect(itemPhotoRoles({ catalog_image_url: OB })).toEqual({ main: OB, reference: null });
  });
  it("staff photo wins and OB photo becomes a reference", () => {
    expect(itemPhotoRoles({ item_image_url: `${STAFF}\nhttps://cdn/2.jpg`, catalog_image_url: OB })).toEqual({ main: STAFF, reference: OB });
  });
  it("sketch present keeps OB photo as reference only", () => {
    expect(itemPhotoRoles({ sketch_url: "s.png", catalog_image_url: OB })).toEqual({ main: null, reference: OB });
  });
  it("custom item never uses the OB photo as the product", () => {
    expect(itemPhotoRoles({ stock_decision: "custom", catalog_image_url: OB })).toEqual({ main: null, reference: OB });
    expect(itemPhotoRoles({ fulfillment_route: "custom", catalog_image_url: OB })).toEqual({ main: null, reference: OB });
  });
});

describe("workPhotoCatalog", () => {
  it("hides the catalog photo for custom items only", () => {
    expect(workPhotoCatalog({ fulfillment_route: "custom", catalog_image_url: OB })).toBeNull();
    expect(workPhotoCatalog({ catalog_image_url: OB })).toBe(OB);
  });
});
