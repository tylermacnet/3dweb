import type { Listing } from '../domain/listing.js';
import type { ListingFeed } from '../ports/listing-feed.js';
import type { ListingParser } from '../ports/listing-parser.js';

export class ManageBuildingFeed implements ListingFeed {
  static readonly FEED_URL =
    'https://3dmanagement.managebuilding.com/resident/api/public/listingFeeds';

  private readonly parser: ListingParser;
  private readonly fetchFn: typeof fetch;

  constructor(parser: ListingParser, fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.parser = parser;
    this.fetchFn = fetchFn;
  }

  async getListings(signal?: AbortSignal): Promise<readonly Listing[]> {
    const xmlString = await this.fetchXml(signal);
    try {
      return this.parser.parse(xmlString);
    } catch (error) {
      throw new Error('Unable to parse listing feed.', { cause: error });
    }
  }

  /**
   * Fetches the raw feed XML over the fixed direct-then-proxy chain. Public
   * for focused testing; the `ListingFeed` port contract is `getListings()`.
   * Resilience policy: 5s timeout per attempt (`AbortSignal.timeout(5000)`),
   * so the worst case spans ~15s across all three attempts. Attempt failures
   * are collected in order and attached as the `cause` of the final error;
   * caller abort is always rethrown to preserve cancellation.
   */
  async fetchXml(signal?: AbortSignal): Promise<string> {
    const requestUrls = [
      ManageBuildingFeed.FEED_URL,
      `https://corsproxy.io/?${encodeURIComponent(ManageBuildingFeed.FEED_URL)}`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(ManageBuildingFeed.FEED_URL)}`,
    ];
    const attemptErrors: unknown[] = [];

    for (const requestUrl of requestUrls) {
      const requestSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
        : AbortSignal.timeout(5000);

      try {
        const response = await this.fetchFn(requestUrl, { signal: requestSignal });
        if (!response.ok) {
          attemptErrors.push(new Error(`Feed request failed with status ${response.status}.`));
          continue;
        }

        let payload = await response.text();
        if (payload.trim().startsWith('{')) {
          const parsedPayload: unknown = JSON.parse(payload);
          if (
            typeof parsedPayload === 'object' &&
            parsedPayload !== null &&
            'contents' in parsedPayload &&
            typeof parsedPayload.contents === 'string'
          ) {
            payload = parsedPayload.contents;
          }
        }

        if (/<Property[\s>]/.test(payload)) return payload;
        attemptErrors.push(new Error('Feed response did not contain property listings.'));
      } catch (error) {
        if (signal?.aborted) throw error;
        attemptErrors.push(error);
      }
    }

    throw new Error('Unable to retrieve XML feed.', { cause: attemptErrors });
  }
}
