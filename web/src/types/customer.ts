/**
 * Customer / organisation references used on a quote.
 * `Party` is an M1 Organization (customer or ship-to org); `Location` is an
 * OrganizationLocation (ship-to location).
 */

export interface Party {
  id: string;
  name: string;
}

export interface Location {
  id: string;
  name: string;
}
