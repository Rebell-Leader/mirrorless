/**
 * Mirrorless entry point. World options come from iwsdk.config.json via the
 * virtual project module; application systems are registered here.
 * HandTrackingSystem must be registered before systems that read handState.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { HandTrackingSystem } from './hand-tracking.js';
import { PanelSystem } from './panel.js';
import { ProbeSystem } from './probe.js';
import { RecorderSystem } from './recorder.js';
import { mountRecorderOverlay } from './recorder-overlay.js';
import { mountSetupOverlay } from './setup-overlay.js';
import { TrainerSystem } from './trainer.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(HandTrackingSystem);
  world.registerSystem(PanelSystem);
  world.registerSystem(ProbeSystem);
  world.registerSystem(TrainerSystem);
  world.registerSystem(RecorderSystem);
  mountSetupOverlay(world);
  mountRecorderOverlay(world);
});
