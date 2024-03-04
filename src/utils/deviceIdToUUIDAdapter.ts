import { uuidT } from "@sinkapoy/home-core";

export function getUUIDByMiotDeviceId(did: string) {
    return 'miot:' + did;
}

export function getMiotDeviceIdByUUID(uuid: uuidT) {
    if (/miot:/.test(uuid)) {
        return uuid.replace('miot:', '');
    }
    return undefined;
}