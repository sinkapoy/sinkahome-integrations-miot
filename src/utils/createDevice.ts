import { type Entity } from "@ash.ts/ash";
import { createGadget } from "@sinkapoy/home-core";
import { ISaveDeviceInfo } from "../interfaces/saves/ISaveDeviceInfo";
import { getUUIDByMiotDeviceId } from "./deviceIdToUUIDAdapter";
import { MiDeviceInfoComponent, MiotDeviceProperties } from "../components";

export function createMiotGadget(devInfo: ISaveDeviceInfo): Entity {
    const device = createGadget(getUUIDByMiotDeviceId(devInfo.did), true);
    device.add(new MiDeviceInfoComponent(devInfo));
    device.add(new MiotDeviceProperties());
    return device;
}