export type CabinCategory = 'interior' | 'oceanview' | 'balcony' | 'suite';

export interface SuiteSubcategory {
  code: string;
  name: string;
  price: number;
}

export interface PriceCell {
  current: number | null;
  lowestEver?: number | null;
  isAtLowestEver?: boolean;
  trackedSince?: string | null;
  subcategories?: SuiteSubcategory[];
}

export interface SailingPrices {
  interior: PriceCell;
  oceanview: PriceCell;
  balcony: PriceCell;
  suite: PriceCell;
}

export interface Sailing {
  id: string;
  shipCode: string;
  shipName: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  destination: string;
  embarkationPort: string;
  itineraryPorts: string[];
  prices: SailingPrices;
}

export interface Ship {
  code: string;
  name: string;
}

export type NightsPreset = 'any' | '3-5' | '7' | '10-14' | '15+';
export type SortBy = 'date' | 'price';
export type ActiveTab = 'browse' | 'lowest-ever';

export interface PriceHistoryPoint {
  date: string;
  price: number;
}

export interface Filters {
  month: string;           // 'YYYY-MM' or '' for any
  cabinCategories: CabinCategory[];
  suiteSubcategories: string[];  // subcategory codes
  nightsPreset: NightsPreset;
  shipCode: string;        // '' for any
  sortBy: SortBy;
}
