export type CabinCategory = 'interior' | 'oceanview' | 'balcony' | 'suite';

export interface CelebShip {
  code: string;
  name: string;
}

export interface CelebVoyage {
  voyageCode: string;
  shipCode: string;
  shipName: string;
  departureDate: string;   // ISO date string YYYY-MM-DD
  returnDate: string;
  nights: number;
  destination: string;
  embarkationPort: string;
  ports: string[];
}

export interface CabinPrice {
  category: CabinCategory;
  subcategoryCode: string | null;    // e.g. 'S1', 'CS', 'IS'
  subcategoryName: string | null;    // e.g. 'Sky Suite', 'Celebrity Suite'
  pricePerPerson: number;
}

export interface CelebPrices {
  voyageCode: string;
  cabins: CabinPrice[];
}

export interface SailingPrice {
  current: number | null;
  lowestEver?: number | null;
  isAtLowestEver?: boolean;
}

export interface SailingPrices {
  interior: SailingPrice;
  oceanview: SailingPrice;
  balcony: SailingPrice;
  suite: SailingPrice;
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

export interface SyncResult {
  ok: boolean;
  voyagesSynced: number;
  snapshotsInserted: number;
  errors: number;
  durationMs: number;
}
