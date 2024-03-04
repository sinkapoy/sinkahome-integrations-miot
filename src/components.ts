import { PropertyDataType } from "@sinkapoy/home-core";
import { MiCloudService } from "./MiCloudService";
import { MiioDeviceConnection } from "./MiQuery";
import { ISaveDeviceInfo } from "./interfaces/saves/ISaveDeviceInfo";
import { IMiotDeviceProperty } from "./interfaces/IMiotDeviceProperty";

export enum DataFormat {
    string,
    number,
    boolean,
}

export class MiDeviceInfoComponent implements Partial<ISaveDeviceInfo> {
    /** device id */
    readonly did: string;
    deviceType: number
    readonly token: string;
    ip: string;
    readonly miioUserId: number;
    readonly model: string;

    cloudAcc?: MiCloudService;

    localConnection?: MiioDeviceConnection;

    constructor(devInfo: ISaveDeviceInfo) {
        Object.assign(this, devInfo);
    }
}

export class MiotDeviceProperties extends Map<string, IMiotDeviceProperty<PropertyDataType.any>> {}