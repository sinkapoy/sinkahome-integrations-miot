import { defineNode } from "@ash.ts/ash";
import { PropertiesComponent } from "@sinkapoy/home-core";
import { MiDeviceInfoComponent, MiotDeviceProperties } from "./components";

export class MiotDeviceNode extends defineNode({
    properties: PropertiesComponent,
    miot: MiDeviceInfoComponent,
    miotProps: MiotDeviceProperties,
}){}