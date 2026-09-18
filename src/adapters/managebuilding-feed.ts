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
    return this.parser.parse(xmlString);
  }

  async fetchXml(signal?: AbortSignal): Promise<string> {
    const requestUrls = [
      ManageBuildingFeed.FEED_URL,
      `https://corsproxy.io/?${encodeURIComponent(ManageBuildingFeed.FEED_URL)}`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(ManageBuildingFeed.FEED_URL)}`,
    ];
    let lastError: unknown;

    for (const requestUrl of requestUrls) {
      const requestSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
        : AbortSignal.timeout(5000);

      try {
        const response = await this.fetchFn(requestUrl, { signal: requestSignal });
        if (!response.ok) {
          lastError = new Error(`Feed request failed with status ${response.status}.`);
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

        if (payload.includes('<Property>')) return payload;
        lastError = new Error('Feed response did not contain property listings.');
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
      }
    }

    throw new Error('Unable to retrieve XML feed.', { cause: lastError });
  }
}
