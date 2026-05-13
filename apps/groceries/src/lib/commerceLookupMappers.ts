import type { CommerceLookupTypeDto } from "./commerceApi.js";
import type { LookupTypeDef } from "./lookupDomainModel.js";

/** Map Commerce.Api lookup type row to the shape expected by {@link buildLookupEntryFormDefinition}. */
export function commerceLookupTypeToTypeDef(dto: CommerceLookupTypeDto): LookupTypeDef {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description ?? undefined,
    parentLookupId: dto.parentLookupTypeId,
    parentFieldLabel: dto.parentFieldLabel ?? undefined,
    entryIdPrefix: dto.entryIdPrefix,
  };
}
