import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSailingResults,
  buildCurrentRowsFromSnapshots,
  fetchAllRows,
  fetchRowsForIdChunks,
  filterLowestEverResults,
  paginateResults,
  sortResults,
} from '../src/routes/sailingResults';

const sailings = [
  { id: 'a', ship_code: 'EG', ship_name: 'Edge', departure_date: '2026-06-01', return_date: '2026-06-08', nights: 7, destination: 'Caribbean', embarkation_port: 'Miami', itinerary_ports: [] },
  { id: 'b', ship_code: 'SM', ship_name: 'Summit', departure_date: '2026-07-01', return_date: '2026-07-08', nights: 7, destination: 'Bermuda', embarkation_port: 'Cape Liberty', itinerary_ports: [] },
  { id: 'c', ship_code: 'AX', ship_name: 'Apex', departure_date: '2026-08-01', return_date: '2026-08-08', nights: 7, destination: 'Europe', embarkation_port: 'Rome', itinerary_ports: [] },
];

describe('sailing result helpers', () => {
  it('filters totals after cabin prices are applied', () => {
    const results = buildSailingResults({
      sailingRows: sailings,
      priceRows: [
        { sailing_id: 'a', cabin_category: 'interior', cabin_subcategory: null, cabin_subcategory_name: null, current_price: 900 },
        { sailing_id: 'b', cabin_category: 'suite', cabin_subcategory: 'S1', cabin_subcategory_name: 'Sky Suite', current_price: 3200 },
      ],
      selectedCats: ['suite'],
      suiteSubcategories: [],
    });

    assert.deepEqual(results.map((r) => r.id), ['b']);
  });

  it('sorts by price across the full filtered result set before paginating', () => {
    const results = buildSailingResults({
      sailingRows: sailings,
      priceRows: [
        { sailing_id: 'a', cabin_category: 'interior', cabin_subcategory: null, cabin_subcategory_name: null, current_price: 900 },
        { sailing_id: 'b', cabin_category: 'interior', cabin_subcategory: null, cabin_subcategory_name: null, current_price: 700 },
        { sailing_id: 'c', cabin_category: 'interior', cabin_subcategory: null, cabin_subcategory_name: null, current_price: 500 },
      ],
      selectedCats: ['interior'],
      suiteSubcategories: [],
    });

    assert.deepEqual(paginateResults(sortResults(results, 'price', ['interior']), 0, 2).map((r) => r.id), ['c', 'b']);
  });

  it('honors suite subcategory filters and exposes matching suite options', () => {
    const results = buildSailingResults({
      sailingRows: sailings,
      priceRows: [
        { sailing_id: 'a', cabin_category: 'suite', cabin_subcategory: 'S1', cabin_subcategory_name: 'Sky Suite', current_price: 3000 },
        { sailing_id: 'b', cabin_category: 'suite', cabin_subcategory: 'RS', cabin_subcategory_name: 'Royal Suite', current_price: 8000 },
      ],
      selectedCats: ['suite'],
      suiteSubcategories: ['RS'],
    });

    assert.deepEqual(results.map((r) => r.id), ['b']);
    assert.deepEqual(results[0].prices.suite.subcategories, [{ code: 'RS', name: 'Royal Suite', price: 8000 }]);
  });

  it('filters lowest-ever results before total and pagination are calculated', () => {
    const results = buildSailingResults({
      sailingRows: sailings,
      priceRows: [
        { sailing_id: 'a', cabin_category: 'interior', cabin_subcategory: null, cabin_subcategory_name: null, current_price: 900 },
        { sailing_id: 'b', cabin_category: 'interior', cabin_subcategory: null, cabin_subcategory_name: null, current_price: 700 },
        { sailing_id: 'c', cabin_category: 'interior', cabin_subcategory: null, cabin_subcategory_name: null, current_price: 500 },
      ],
      selectedCats: ['interior'],
      suiteSubcategories: [],
      lowestRows: [
        { sailing_id: 'a', cabin_category: 'interior', cabin_subcategory: null, lowest_ever_price: 800, first_tracked_at: '2026-01-01T00:00:00Z' },
        { sailing_id: 'b', cabin_category: 'interior', cabin_subcategory: null, lowest_ever_price: 700, first_tracked_at: '2026-01-01T00:00:00Z' },
        { sailing_id: 'c', cabin_category: 'interior', cabin_subcategory: null, lowest_ever_price: 500, first_tracked_at: '2026-01-01T00:00:00Z' },
      ],
    });

    const lowest = filterLowestEverResults(results, ['interior']);
    assert.equal(lowest.length, 2);
    assert.deepEqual(paginateResults(lowest, 1, 1).map((r) => r.id), ['c']);
  });

  it('compares suite subcategory current prices against matching subcategory lows', () => {
    const results = buildSailingResults({
      sailingRows: [sailings[0]],
      priceRows: [
        { sailing_id: 'a', cabin_category: 'suite', cabin_subcategory: 'RS', cabin_subcategory_name: 'Royal Suite', current_price: 8000 },
      ],
      selectedCats: ['suite'],
      suiteSubcategories: ['RS'],
      lowestRows: [
        { sailing_id: 'a', cabin_category: 'suite', cabin_subcategory: 'S1', lowest_ever_price: 3000, first_tracked_at: '2026-01-01T00:00:00Z' },
        { sailing_id: 'a', cabin_category: 'suite', cabin_subcategory: 'RS', lowest_ever_price: 8000, first_tracked_at: '2026-01-02T00:00:00Z' },
      ],
    });

    assert.equal(results[0].prices.suite.lowestEver, 8000);
    assert.equal(results[0].prices.suite.trackedSince, '2026-01-02T00:00:00Z');
    assert.equal(results[0].prices.suite.isAtLowestEver, true);
  });

  it('fetches every page instead of stopping at a fixed row cap', async () => {
    const rows = Array.from({ length: 2501 }, (_, index) => ({ id: index }));
    const fetched = await fetchAllRows(
      () => ({
        range(from: number, to: number) {
          return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
        },
      }),
      1000
    );

    assert.equal(fetched.length, 2501);
    assert.equal(fetched[2500].id, 2500);
  });

  it('chunks follow-up queries that depend on large sailing id lists', async () => {
    const seenChunks: string[][] = [];
    const rows = await fetchRowsForIdChunks(
      ['a', 'b', 'c', 'd', 'e'],
      (ids) => {
        seenChunks.push(ids);
        return {
          range(from: number, to: number) {
            const data = ids.map((id) => ({ id })).slice(from, to + 1);
            return Promise.resolve({ data, error: null });
          },
        };
      },
      2,
      100
    );

    assert.deepEqual(seenChunks, [['a', 'b'], ['c', 'd'], ['e']]);
    assert.deepEqual(rows.map((row) => row.id), ['a', 'b', 'c', 'd', 'e']);
  });

  it('builds subtype-aware current rows from the latest snapshots', () => {
    const rows = buildCurrentRowsFromSnapshots([
      { sailing_id: 'a', cabin_category: 'suite', cabin_subcategory: 'RS', cabin_subcategory_name: 'Royal Suite', price_per_person: 9000, captured_at: '2026-01-01T00:00:00Z' },
      { sailing_id: 'a', cabin_category: 'suite', cabin_subcategory: 'RS', cabin_subcategory_name: 'Royal Suite', price_per_person: 8000, captured_at: '2026-01-02T00:00:00Z' },
      { sailing_id: 'a', cabin_category: 'suite', cabin_subcategory: 'S1', cabin_subcategory_name: 'Sky Suite', price_per_person: 3000, captured_at: '2026-01-02T00:00:00Z' },
    ]);

    assert.deepEqual(rows, [
      { sailing_id: 'a', cabin_category: 'suite', cabin_subcategory: 'RS', cabin_subcategory_name: 'Royal Suite', current_price: 8000 },
      { sailing_id: 'a', cabin_category: 'suite', cabin_subcategory: 'S1', cabin_subcategory_name: 'Sky Suite', current_price: 3000 },
    ]);
  });
});
