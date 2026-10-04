import { IsObject } from 'class-validator';

/** PUT /companies/:id/ui-defaults — checked in mergeUiState(). */
export class UpdateUiDefaultsDto {
  @IsObject()
  values!: Record<string, unknown>;
}
