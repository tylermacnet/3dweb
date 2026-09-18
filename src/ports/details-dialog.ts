import type { Listing } from '../domain/listing.js';

export interface DetailsDialog {
  /**
   * Presents listing details. Returns true when the dialog handled the request
   * (so the caller should cancel its default navigation); false when details
   * cannot be shown here and the caller should fall back to the canonical link.
   * The optional invoker is used for native focus restoration on close.
   */
  open(listing: Listing, invoker?: HTMLElement): boolean;
  close(): void;
}
