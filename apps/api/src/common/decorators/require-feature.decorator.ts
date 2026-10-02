import { SetMetadata } from '@nestjs/common';

export const FEATURE_KEY = 'required_feature';

/**
 * Route / controller only works when the feature is enabled for the
 * caller's company (plan + overrides). Otherwise 403 FEATURE_NOT_ENABLED.
 * @RequirePermission() also implies its permission's feature.
 *
 *   @RequireFeature('time.leave')
 *   @Controller('leave')
 */
export const RequireFeature = (feature: string) => SetMetadata(FEATURE_KEY, feature);
