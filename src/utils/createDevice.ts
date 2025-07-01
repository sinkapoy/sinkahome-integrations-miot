import { type Entity } from '@ash.ts/ash';
import { createGadget } from '@sinkapoy/home-core';
import { type ISaveDeviceInfo } from '../interfaces/saves/ISaveDeviceInfo';
import { getUUIDByMiotDeviceId } from './deviceIdToUUIDAdapter';
import { MiDeviceInfoComponent, MiotDeviceActions, MiotDeviceProperties } from '../server/ecs/components';

export function createMiotGadget (devInfo: ISaveDeviceInfo): Entity {
    const device = createGadget(getUUIDByMiotDeviceId(devInfo.did), true);
    device.add(new MiDeviceInfoComponent(devInfo));
    device.add(new MiotDeviceProperties());
    device.add(new MiotDeviceActions());
    return device;
}
