import { describe, expect, it } from 'vitest';
import * as adapter from './flowAdapter';
import { CATALOG_DRAG_TYPE } from '../contracts';

describe('catalog drag validation', () => {
  it('accepts only an exact known kind in the dedicated MIME type', () => {
    const transfer = (value: string, types = [CATALOG_DRAG_TYPE]) => ({ types, getData: () => value });
    expect(adapter.readCatalogKind(transfer('esx-host'))).toBe('esx-host');
    expect(adapter.readCatalogKind(transfer('not-a-kind'))).toBeUndefined();
    expect(adapter.readCatalogKind(transfer(' esx-host '))).toBeUndefined();
    expect(adapter.readCatalogKind(transfer('esx-host', ['text/plain']))).toBeUndefined();
    expect(adapter.readCatalogKind({ types: [CATALOG_DRAG_TYPE], getData: () => { throw new Error('blocked'); } })).toBeUndefined();
  });
});
