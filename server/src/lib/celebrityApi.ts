import type { CabinCategory, CabinPrice, CelebPrices, CelebShip, CelebVoyage } from '../types';

const RCCL_BASE = 'https://aws-prd.api.rccl.com';
const CELEBRITY_GRAPH = 'https://www.celebritycruises.com/graph';
const BRAND = 'C';
const APPKEY = 'hyNNqIPHHzaLzVpcICPdAdbFV8yvTsAm';

const RCCL_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  AppKey: APPKEY,
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

const GRAPH_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

// Maps GraphQL stateroomClass names to our cabin category enum
// Verified against live API 2026-05-12: Inside, Ocean View, Veranda, Aquaclass, Concierge Class, The Retreat
const CLASS_NAME_MAP: Record<string, CabinCategory> = {
  'Inside':           'interior',
  'Interior':         'interior',
  'Ocean View':       'oceanview',
  'Outside':          'oceanview',
  'Balcony':          'balcony',
  'Veranda':          'balcony',
  'Aquaclass':        'balcony',
  'Concierge Class':  'balcony',
  'Suite':            'suite',
  'The Retreat':      'suite',
};

const CRUISE_SEARCH_QUERY = `
  query CruiseSearch($count: Int!, $skip: Int!) {
    cruiseSearch(pagination: { count: $count, skip: $skip }) {
      results {
        total
        cruises {
          id
          sailings {
            id
            startDate
            endDate
            itinerary {
              sailingNights
              ship { name code }
              departurePort { name code }
              destination { name }
              days {
                type
                ports { port { name code } }
              }
            }
            stateroomClassPricing {
              stateroomClass { name }
              price { netAmount }
            }
          }
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// fetchShips — Celebrity ships from RCCL API
// ---------------------------------------------------------------------------
export async function fetchShips(): Promise<CelebShip[]> {
  const url = `${RCCL_BASE}/en/royal/web/v2/ships?brand=${BRAND}`;
  const res = await fetch(url, { headers: RCCL_HEADERS });
  if (!res.ok) throw new Error(`fetchShips: ${res.status}`);

  const data = await res.json() as { payload?: { ships?: unknown[] } };
  const ships = (data.payload?.ships ?? []) as Record<string, unknown>[];
  const celebrity = ships.filter((s) => s.brand === BRAND);
  console.log(`[api] ${celebrity.length} Celebrity ships found`);
  return celebrity.map((s) => ({
    code: String(s.shipCode ?? ''),
    name: String(s.name ?? ''),
  }));
}

// ---------------------------------------------------------------------------
// fetchAllSailingsWithPrices — single GraphQL call returns everything
// ---------------------------------------------------------------------------
export async function fetchAllSailingsWithPrices(): Promise<
  { voyage: CelebVoyage; prices: CelebPrices }[]
> {
  const PAGE_SIZE = 600; // 564 total as of 2026-05, set high to get all in one call
  let skip = 0;
  let total = Infinity;
  const all: { voyage: CelebVoyage; prices: CelebPrices }[] = [];

  while (skip < total) {
    const res = await fetch(CELEBRITY_GRAPH, {
      method: 'POST',
      headers: GRAPH_HEADERS,
      body: JSON.stringify({
        query: CRUISE_SEARCH_QUERY,
        variables: { count: PAGE_SIZE, skip },
      }),
    });

    if (!res.ok) throw new Error(`cruiseSearch: ${res.status}`);

    const json = await res.json() as {
      data?: {
        cruiseSearch?: {
          results?: {
            total: number;
            cruises: GqlCruise[];
          };
        };
      };
    };

    const results = json.data?.cruiseSearch?.results;
    if (!results) throw new Error('Unexpected GraphQL response shape');

    total = results.total;
    console.log(`[api] Fetched ${skip + results.cruises.length} / ${total} cruise itineraries`);

    for (const cruise of results.cruises) {
      for (const sailing of cruise.sailings) {
        const mapped = mapSailing(sailing);
        if (mapped) all.push(mapped);
      }
    }

    skip += PAGE_SIZE;
    if (results.cruises.length < PAGE_SIZE) break; // last page
  }

  console.log(`[api] Total sailings parsed: ${all.length}`);
  return all;
}

// ---------------------------------------------------------------------------
// Internal types for the GraphQL response
// ---------------------------------------------------------------------------
interface GqlCruise {
  id: string;
  sailings: GqlSailing[];
}

interface GqlSailing {
  id: string;
  startDate: string;
  endDate: string;
  itinerary: {
    sailingNights: number;
    ship: { name: string; code: string };
    departurePort: { name: string; code: string };
    destination: { name: string };
    days: { type: string; ports: { port: { name: string; code: string } }[] }[] | null;
  };
  stateroomClassPricing: {
    stateroomClass: { name: string };
    price: { netAmount: number };
  }[];
}

function mapSailing(s: GqlSailing): { voyage: CelebVoyage; prices: CelebPrices } | null {
  const it = s.itinerary;
  if (!it?.ship?.code || !s.startDate) return null;

  const voyage: CelebVoyage = {
    voyageCode:      s.id,
    shipCode:        it.ship.code,
    shipName:        it.ship.name,
    departureDate:   s.startDate,
    returnDate:      s.endDate,
    nights:          it.sailingNights,
    destination:     it.destination?.name ?? '',
    embarkationPort: it.departurePort?.name ?? '',
    ports:           (it.days ?? [])
                       .filter((d) => d.type === 'PORT')
                       .flatMap((d) => d.ports ?? [])
                       .map((pv) => pv.port?.name)
                       .filter((n): n is string => !!n)
                       .filter((name, i, arr) => arr.indexOf(name) === i),
  };

  const cabins: CabinPrice[] = [];
  for (const cp of s.stateroomClassPricing ?? []) {
    const className = cp.stateroomClass?.name ?? '';
    const category = CLASS_NAME_MAP[className];
    if (!category) continue;
    const price = cp.price?.netAmount;
    if (!price || price <= 0) continue;
    cabins.push({
      category,
      subcategoryCode: null,
      subcategoryName: null,
      pricePerPerson:  price,
    });
  }

  return { voyage, prices: { voyageCode: s.id, cabins } };
}
