import type { IAccountDeviceInfo } from "./IAccountDeviceInfo";

export interface IGetDevicesRequestResult {
    "code": number;
    "message": string;
    "result": {
        "list": IAccountDeviceInfo[]
    }
}