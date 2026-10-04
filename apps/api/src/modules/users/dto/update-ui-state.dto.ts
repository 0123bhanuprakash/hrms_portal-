import { IsObject } from 'class-validator';

/** PATCH /users/me/ui-state — keys and values are checked in mergeUiState(). */
export class UpdateUiStateDto {
  @IsObject()
  changes!: Record<string, unknown>;
}
