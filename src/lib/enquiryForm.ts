// Tiny pubsub so any button can open the global enquiry dialog.
type Opts = { productName?: string };
type Opener = (opts: Opts) => void;

let opener: Opener | null = null;

export const registerEnquiryOpener = (fn: Opener | null) => {
  opener = fn;
};

export const openEnquiryForm = (opts: Opts = {}) => {
  if (opener) {
    opener(opts);
  } else {
    // Component not mounted yet — retry shortly.
    setTimeout(() => opener?.(opts), 50);
  }
};

export const ENQUIRY_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwirf8pOX8A3Xnyhj6OJOoiHCjoD-HeLHubMgYG3MN_5hwtmrBQAlKKPBWOHW_aK3K78g/exec";