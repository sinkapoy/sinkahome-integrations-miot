import { type uuidT } from '@sinkapoy/home-core';

export function getUUIDByMiotDeviceId (did: string) {
    return 'miot:' + did;
}

export function getMiotDeviceIdByUUID (uuid: uuidT) {
    if (uuid.includes('miot:')) {
        return uuid.replace('miot:', '');
    }
    return undefined;
}
