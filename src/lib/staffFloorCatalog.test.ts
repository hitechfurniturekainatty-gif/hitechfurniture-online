import { describe, expect, it } from "vitest";
import { floorEntries, sortFloorEntries, partLabel, type FloorProduct } from "./staffFloorCatalog";
const product = (patch:Partial<FloorProduct>={}):FloorProduct => ({
  id:"p",product_name:"Sofa",product_code:"S1",mrp:25000,stock_quantity:5,stock_status:"in_stock",
  location_id:"a",floor_display_order:0,primary_image_url:"main.jpg",product_images:[],product_variants:[],...patch,
});
describe("physical floor catalogue",()=>{
  it("keeps colour stock on its actual floors, including zero stock in master view",()=>{
    const rows=floorEntries([product({product_variants:[{id:"v",color_name:"Brown",image_url:"brown.jpg",stock_quantity:5,location_id:"a",floor_display_order:0,product_variant_stock:[{id:"sa",location_id:"a",quantity:2,floor_display_order:20},{id:"sb",location_id:"b",quantity:3,floor_display_order:10},{id:"sc",location_id:"c",quantity:0,floor_display_order:0}]}]})]);
    expect(rows.map(r=>[r.location_id,r.stock,r.cover])).toEqual([["a",2,"brown.jpg"],["b",3,"brown.jpg"],["c",0,"brown.jpg"]]);
    expect(rows.every(r=>r.kind==="variant_stock")).toBe(true);
  });
  it("uses a colour's own location when legacy stock has no split rows",()=>{
    const rows=floorEntries([product({product_variants:[{id:"v",color_name:"Cream",image_url:null,stock_quantity:2,location_id:"b",floor_display_order:30,product_variant_stock:[]}]})]);
    expect(rows[0]).toMatchObject({kind:"variant",refId:"v",location_id:"b",floor_display_order:30,stock:2,cover:"main.jpg"});
  });
  it("honours manual order across categories and places new items last within the section",()=>{
    const rows=floorEntries([product({id:"a",product_name:"A chair",floor_display_order:0}),product({id:"b",product_name:"Z sofa",floor_display_order:10}),product({id:"c",product_name:"B cot",floor_display_order:20}),product({id:"d",location_id:"b",floor_display_order:1})]);
    expect(sortFloorEntries(rows,[{id:"a",building:"Shop",floor:"1",section:"A"},{id:"b",building:"Shop",floor:"1",section:"B"}]).map(r=>r.refId)).toEqual(["b","c","a","d"]);
  });
  it("keeps bundles distinguishable so they never mutate the products table",()=>{
    expect(floorEntries([product({is_bundle:true})])[0].kind).toBe("bundle");
  });
  it("supports general floors and deduplicates section / part labels",()=>{
    expect(partLabel({id:"a",building:"Shop",floor:"1",section:null})).toBe("General");
    expect(partLabel({id:"a",building:"Shop",floor:"1",section:"Part A",part:"Part A"})).toBe("Part A");
  });
});
