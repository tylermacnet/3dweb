export interface LocalArea {
  name: string;
  fsas: readonly string[];
}

export interface RegionDefinition {
  id: string;
  localAreas: readonly LocalArea[];
}

export type RegionMap = Readonly<Record<string, RegionDefinition>>;

export const NEW_BRUNSWICK_REGIONS = {
  'Greater Saint John': {
    id: 'GSJ',
    localAreas: [
      { name: 'Uptown / South End / Central', fsas: ['E2L'] },
      { name: 'North End / Millidgeville', fsas: ['E2K'] },
      { name: 'West Side / Lancaster', fsas: ['E2M'] },
      { name: 'East Side / Loch Lomond', fsas: ['E2J', 'E2N', 'E2R', 'E2S'] },
      { name: 'Rothesay', fsas: ['E2E'] },
      { name: 'Quispamsis', fsas: ['E2G'] },
      { name: 'Grand Bay-Westfield', fsas: ['E5K'] },
      { name: 'Hampton', fsas: ['E5N'] },
      { name: 'St. Martins & Rural Southeast', fsas: ['E5R'] },
    ],
  },
  'Greater Moncton': {
    id: 'GMA',
    localAreas: [
      { name: 'Moncton Central / Downtown', fsas: ['E1C'] },
      { name: 'Moncton North / West / Sunny Brae', fsas: ['E1E', 'E1G'] },
      { name: 'Moncton East', fsas: ['E1A'] },
      { name: 'Dieppe', fsas: ['E1A'] },
      { name: 'Riverview', fsas: ['E1B'] },
      { name: 'Shediac & Coast', fsas: ['E4P', 'E4R'] },
      { name: 'Sackville / Port Elgin / Memramcook', fsas: ['E4L', 'E4M', 'E4N'] },
      {
        name: 'Bouctouche / Richibucto / Kent Region',
        fsas: ['E4S', 'E4T', 'E4V', 'E4W', 'E4X'],
      },
    ],
  },
  'Greater Fredericton': {
    id: 'GFA',
    localAreas: [
      { name: 'Downtown / South Side', fsas: ['E3B', 'E3E'] },
      { name: 'North Side / Marysville', fsas: ['E3A', 'E3G'] },
      { name: 'New Maryland / Kingsclear / Rural South', fsas: ['E3C'] },
      { name: 'Oromocto / Burton / Geary', fsas: ['E2V'] },
      { name: 'Minto / Chipman / Grand Lake', fsas: ['E4A', 'E4B'] },
      { name: 'McAdam / Harvey / Southwest Rural', fsas: ['E6H', 'E6K'] },
    ],
  },
  'Greater Charlotte County': {
    id: 'GCC',
    localAreas: [
      { name: 'St. Stephen', fsas: ['E5A'] },
      { name: 'St. Andrews', fsas: ['E5B'] },
      { name: 'St. George', fsas: ['E5C'] },
      { name: 'Blacks Harbour', fsas: ['E5C'] },
      { name: 'Pennfield & Beaver Harbour', fsas: ['E5C'] },
      { name: 'Grand Manan Island', fsas: ['E5G'] },
      { name: 'Deer Island & Campobello Island', fsas: ['E5V'] },
    ],
  },
  'Greater Miramichi & River Valley': {
    id: 'GMR',
    localAreas: [
      { name: 'Miramichi City (Newcastle/Chatham)', fsas: ['E1N', 'E1V'] },
      { name: 'Neguac & North Shore', fsas: ['E9G'] },
      { name: 'Sunny Corner / Blackville / Southwest Miramichi', fsas: ['E9E', 'E9H'] },
      { name: 'Rogersville / Rural South Miramichi', fsas: ['E4Y'] },
    ],
  },
  'Greater Bathurst & Acadian Peninsula': {
    id: 'GBP',
    localAreas: [
      { name: 'Bathurst City', fsas: ['E2A'] },
      { name: 'Beresford / Petit-Rocher / Chaleur Rural', fsas: ['E8J', 'E8K'] },
      { name: 'Caraquet', fsas: ['E8P'] },
      { name: 'Shippagan', fsas: ['E8S'] },
      { name: 'Tracadie-Sheila', fsas: ['E8R', 'E8T'] },
      { name: 'Lamèque & Miscou Islands', fsas: ['E8M'] },
    ],
  },
  'Greater Campbellton & Restigouche': {
    id: 'GCR',
    localAreas: [
      { name: 'Campbellton', fsas: ['E3N'] },
      { name: 'Dalhousie / Balmoral', fsas: ['E8E', 'E8G'] },
      { name: 'Kedgwick / Saint-Quentin', fsas: ['E8B', 'E8C'] },
    ],
  },
  'Greater Edmundston & Madawaska': {
    id: 'GEM',
    localAreas: [
      { name: 'Edmundston Downtown', fsas: ['E3V'] },
      { name: 'Saint-Jacques / Verret', fsas: ['E3V'] },
      { name: 'Saint-Basile', fsas: ['E3V'] },
      { name: 'Grand Falls / Grand-Sault', fsas: ['E7G'] },
      { name: 'Saint-Léonard', fsas: ['E7E'] },
    ],
  },
  'Greater Woodstock & Central Upper Valley': {
    id: 'GWU',
    localAreas: [
      { name: 'Woodstock', fsas: ['E7M'] },
      { name: 'Hartland', fsas: ['E7P'] },
      { name: 'Florenceville-Bristol', fsas: ['E7L'] },
      { name: 'Perth-Andover', fsas: ['E7H'] },
      { name: 'Plaster Rock / Tobique Valley', fsas: ['E7G'] },
      { name: 'Nackawic / Canterbury', fsas: ['E6G'] },
    ],
  },
  'Greater Sussex & Rural South Central': {
    id: 'GSR',
    localAreas: [
      { name: 'Sussex / Sussex Corner', fsas: ['E4E'] },
      { name: 'Norton / Springfield / Apohaqui', fsas: ['E4G'] },
      { name: 'Petitcodiac / Havelock / Salisbury', fsas: ['E4J', 'E4H', 'E4G'] },
      { name: 'Albert County / Riverside-Albert / Alma', fsas: ['E4H'] },
    ],
  },
} as const satisfies RegionMap;
