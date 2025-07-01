import { defineNode } from '@ash.ts/ash';
import { ActionsComponent, PropertiesComponent } from '@sinkapoy/home-core';
import { MiDeviceInfoComponent, MiotDeviceActions, MiotDeviceProperties } from './components';

export class MiotDeviceNode extends defineNode({
    properties: PropertiesComponent,
    actions: ActionsComponent,
    miot: MiDeviceInfoComponent,
    miotProps: MiotDeviceProperties,
    miotActions: MiotDeviceActions,
}) {}
