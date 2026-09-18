import type { Listing } from '../domain/listing.js';

export interface DetailsModal {
  /**
   * Presents listing details in the Popover API modal (product term; the
   * platform mechanism is a non-modal `popover="auto"` element with
   * `role="dialog"`). Returns true when the modal handled the request
   * (so the caller should cancel its default navigation); false when details
   * cannot be shown here and the caller should fall back to the canonical link.
   * The optional invoker is used for native focus restoration on close.
   */
  open(listing: Listing, invoker?: HTMLElement): boolean;
  close(): void;
  /**
   * Optional off-critical-path preparation (mount, styles, connection hints).
   * Called at idle time when available; `open()` must work without it.
   */
  warm?(): void;
}
