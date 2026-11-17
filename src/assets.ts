/**
 * Asset catalog shared by the runtime and the editor (evaluated in both realms,
 * so it must stay deterministic and side-effect free).
 */

import { AssetType, defineAssets } from '@iwsdk/core';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'probe-panel': uikitml('probe.uikitml', 'Probe Panel'),
  'recorder-panel': uikitml('recorder.uikitml', 'Recorder Panel'),
  'trainer-panel': uikitml('trainer.uikitml', 'Trainer Panel'),
});
