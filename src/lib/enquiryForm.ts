// Tiny pubsub so any button can open the global enquiry dialog.
export interface CatalogProduct {
  productName?: string;
  productId?: string;
  productCode?: string;
  productImageUrl?: string;
}

export interface EnquiryOpenOpts {
  /** Legacy single-product shape — auto-wrapped into a 1-element catalogProducts array. */
  productName?: string;
  productId?: string;
  /** Preferred shape: open the dialog pre-loaded with one or more catalog products. */
  catalogProducts?: CatalogProduct[];
}

type Opener = (opts: EnquiryOpenOpts) => void;

let opener: Opener | null = null;

export const registerEnquiryOpener = (fn: Opener | null) => {
  opener = fn;
};

export const openEnquiryForm = (opts: EnquiryOpenOpts = {}) => {
  if (opener) {
    opener(opts);
  } else {
    // Component not mounted yet — retry shortly.
    setTimeout(() => opener?.(opts), 50);
  }
};