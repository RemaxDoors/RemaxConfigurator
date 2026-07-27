/**
 * A sellable part — the base unit sold on a quote line.
 * A plain part is a catalogue item (no configurator). A configured part is a
 * `Door` (see door.ts), which extends this — every door IS a part.
 */
export interface Part {
  partId: string;
  partRevision: string;
  partDescription: string;
  partLongDescription: string;
  partQty: number;
}
