import './components/property-listings.js';
import './components/listing-card.js';
import { BrowserDetailsDialog } from './adapters/browser-details-dialog.js';
import { ManageBuildingFeed } from './adapters/managebuilding-feed.js';
import { XmlListingParser } from './adapters/xml-listing-parser.js';
import { NEW_BRUNSWICK_REGIONS } from './config/regions.js';
import { LocationResolver } from './domain/location-resolver.js';
import { PropertyListings } from './components/property-listings.js';

const locationResolver = new LocationResolver(NEW_BRUNSWICK_REGIONS);
const feed = new ManageBuildingFeed(new XmlListingParser(locationResolver));
const detailsDialog = new BrowserDetailsDialog();
const listings = document.querySelector<PropertyListings>('property-listings');

if (listings) {
  listings.feed = feed;
  listings.detailsDialog = detailsDialog;
}
