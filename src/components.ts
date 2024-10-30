import { type PropertyDataType } from '@sinkapoy/home-core';
import { type MiCloudService } from './MiCloudService';
import { type MiioDeviceConnection } from './MiQuery';
import { type ISaveDeviceInfo } from './interfaces/saves/ISaveDeviceInfo';
import { type IMiotDeviceProperty } from './interfaces/IMiotDeviceProperty';
import { type IMiotDeviceAction } from './interfaces/IMiotDeviceAction';

export enum DataFormat {
    string,
    number,
    boolean,
}

export class MiDeviceInfoComponent implements Partial<ISaveDeviceInfo> {
    /** device id */
    readonly did: string;
    deviceType: number;
    readonly token: string;
    ip: string;
    readonly miioUserId: number;
    readonly model: string;

    cloudAcc?: MiCloudService;

    localConnection?: MiioDeviceConnection;

    fetchCountdown = 0;

    constructor (devInfo: ISaveDeviceInfo) {
        Object.assign(this, devInfo);
    }
}

export class MiotDeviceProperties extends Map<string, IMiotDeviceProperty<PropertyDataType.any>> {}
export class MiotDeviceActions extends Map<string, IMiotDeviceAction> {};
