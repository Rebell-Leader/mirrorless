/**
 * Development probe: shows live hand-shape features (from `handState`) and a
 * summary of detected room planes/meshes on the probe panel, and exposes both
 * on `window.__mirrorless` for inspection.
 */

import {
  createSystem,
  RayInteractable,
  UIKitMLAsset,
  VisibilityState,
  XRMesh,
  XRPlane,
} from '@iwsdk/core';
import { describePalm, F, FINGER_NAMES, type Handedness } from './hand-features.js';
import { handState } from './hand-state.js';

export type TextElement = { setProperties(props: Record<string, unknown>): void };

export interface ProbeDebug {
  hands: typeof handState;
  room: { planes: Record<string, number>; meshes: Record<string, number> };
}

declare global {
  interface Window {
    __mirrorless?: ProbeDebug;
  }
}

const PANEL_REFRESH_S = 0.2;
const ROOM_REFRESH_S = 1;

/** Room labels found by scene understanding, refreshed every second. */
export const roomLabels = { planes: {} as Record<string, number>, meshes: {} as Record<string, number> };

export class ProbeSystem extends createSystem({
  planes: { required: [XRPlane] },
  meshes: { required: [XRMesh] },
}) {
  private text: Record<string, TextElement | undefined> = {};
  private panelTimer = 0;
  private roomTimer = 0;

  init(): void {
    window.__mirrorless = { hands: handState, room: roomLabels };

    // The probe panel also hosts the browser-view "Enter XR" button. Inside XR
    // it is a dev tool: hidden and not interactable unless ?probe=1, so it never
    // sits between the learner's hand and the main panel.
    const keepInXR = new URLSearchParams(window.location.search).has('probe');
    const entity = this.world.getSceneEntity('probe-panel');
    if (entity && !keepInXR) {
      this.cleanupFuncs.push(
        this.world.visibilityState.subscribe((state) => {
          const show = state === VisibilityState.NonImmersive;
          if (entity.object3D) entity.object3D.visible = show;
          if (show && !entity.hasComponent(RayInteractable)) entity.addComponent(RayInteractable);
          if (!show && entity.hasComponent(RayInteractable)) entity.removeComponent(RayInteractable);
        }),
      );
    }

    const panel = this.world.getSceneObject<UIKitMLAsset>('probe-panel');
    for (const id of [
      'session-status',
      'left-status',
      'left-detail',
      'right-status',
      'right-detail',
      'room-status',
    ]) {
      this.text[id] = panel?.getElementById(id) as TextElement | undefined;
    }

    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        this.setText(
          'session-status',
          state === VisibilityState.NonImmersive
            ? 'Not in XR yet'
            : state === VisibilityState.Visible
              ? 'Immersive session running'
              : 'Session paused (blurred)',
        );
      }),
    );
  }

  update(delta: number): void {
    this.panelTimer += delta;
    if (this.panelTimer >= PANEL_REFRESH_S) {
      this.panelTimer = 0;
      this.renderHand('left');
      this.renderHand('right');
    }
    this.roomTimer += delta;
    if (this.roomTimer >= ROOM_REFRESH_S) {
      this.roomTimer = 0;
      this.renderRoom();
    }
  }

  private renderHand(handedness: Handedness): void {
    const state = handState[handedness];
    if (!state.tracked) {
      this.setText(`${handedness}-status`, 'not tracked');
      this.setText(`${handedness}-detail`, '-');
      return;
    }
    if (!state.valid) {
      this.setText(`${handedness}-status`, 'tracked, pose not usable');
      this.setText(`${handedness}-detail`, '-');
      return;
    }
    const f = state.features;
    const curls = FINGER_NAMES.map(
      (name, i) => `${name[0].toUpperCase()}${Math.round(f[F.curl + i] * 100)}`,
    ).join(' ');
    this.setText(`${handedness}-status`, `curl ${curls} | ${describePalm(f)}`);
    const spread = (f[F.spread] * 180) / Math.PI;
    this.setText(
      `${handedness}-detail`,
      `pinch ${f[F.thumbTo].toFixed(2)} | spread I-M ${spread.toFixed(0)} deg | cross ${f[F.cross].toFixed(2)} | hand ${(f[F.handScale] * 100).toFixed(1)} cm | ${handState.fps} fps`,
    );
  }

  private renderRoom(): void {
    const planes: Record<string, number> = {};
    const meshes: Record<string, number> = {};
    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane') as
        | { semanticLabel?: string; orientation?: string }
        | undefined;
      const label = plane?.semanticLabel || plane?.orientation || 'plane';
      planes[label] = (planes[label] ?? 0) + 1;
    }
    for (const entity of this.queries.meshes.entities) {
      const label = (entity.getValue(XRMesh, 'semanticLabel') as string) || 'mesh';
      meshes[label] = (meshes[label] ?? 0) + 1;
    }
    roomLabels.planes = planes;
    roomLabels.meshes = meshes;
    const fmt = (counts: Record<string, number>) =>
      Object.entries(counts)
        .map(([k, n]) => (n > 1 ? `${k} x${n}` : k))
        .join(', ');
    const p = fmt(planes);
    const m = fmt(meshes);
    this.setText(
      'room-status',
      p || m ? `planes: ${p || '-'} | objects: ${m || '-'}` : 'no planes or meshes yet',
    );
  }

  private setText(id: string, text: string): void {
    this.text[id]?.setProperties({ text });
  }
}
