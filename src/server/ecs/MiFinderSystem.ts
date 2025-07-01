import { type FileT, HomeSystem, homeEngine } from '@sinkapoy/home-core';
import { HandshakeConnection } from '../MiQuery';
import { type ISaveConfig } from '../../interfaces/saves/ISaveConfig';
import { MiCloudAccountProvider } from '../MiCloudAccountProvider';
import { readFile, writeFile } from 'fs/promises';
import { type IAccountDeviceInfo } from '../../interfaces/IAccountDeviceInfo';
import { type ISaveDeviceInfo } from '../../interfaces/saves/ISaveDeviceInfo';
import { existsSync } from 'fs';
import { getUUIDByMiotDeviceId } from '../../utils/deviceIdToUUIDAdapter';
import { createMiotGadget } from '../../utils/createDevice';
import { miotPluginStore } from '../store';

const FILE_PATH = 'server-data/miioConfig.json';
const MIIO_DEVICES_PATH = 'server-data/miio_devices.json';
class MiFinderSystem extends HomeSystem {
    private readonly searchTimer = { countdown: 5000, time: 5000 };

    private readonly handshakeMsg = new HandshakeConnection('255.255.255.255');

    private accounts: Record<number, MiCloudAccountProvider> = {};

    onInit (): void {
        homeEngine.emit('appendFile', {
            path: FILE_PATH,
            content: '',
        });
        this.engine.emit('appendFile', {
            path: FILE_PATH,
            content: '',
        });
        this.setupEvent('fileContent', this.parseConfig.bind(this));
        this.engine.emit('readFile', FILE_PATH);
        console.info('init mi finder');
    }

    onDestroy (): void {

    }

    onUpdate (dt: number): void {
        this.searchTimer.countdown -= dt;
        if (this.searchTimer.countdown <= 0) {
            this.findLocalDevices();
            this.searchTimer.countdown = this.searchTimer.time;
        }
    }

    protected findLocalDevices () {
        this.handshakeMsg.send();
    }

    private parseConfig (file: FileT) {
        if (file.path !== FILE_PATH) return;
        try {
            const config: ISaveConfig = JSON.parse(file.content);
            config.accounts.forEach((accConf) => {
                const acc = new MiCloudAccountProvider(
                    accConf.username,
                    accConf.password,
                    accConf.locale,
                    accConf.country,
                );

                acc.once('loggedIn', async () => {
                    const devs = await acc.getDevices();
                    this.accounts[acc.miioUserId] = acc;
                    miotPluginStore.accounts[acc.miioUserId] = acc;
                    await this.saveDevices(devs);
                    this.addSavedDevices();
                    await acc.getMapData('1029726937', '1737992578');
                    // await acc.getMapData('1029726937', 'Карта1 ');
                    // await acc.getMapData('1029726937', '1029726937');
                });
            });
        } catch (e) {
            console.error(e);
        }
        this.addSavedDevices();
    }

    private async saveDevices (devices: IAccountDeviceInfo[]) {
        const config: Record<string, ISaveDeviceInfo> = JSON.parse(
            existsSync(MIIO_DEVICES_PATH) ? await readFile(MIIO_DEVICES_PATH, { encoding: 'utf-8' }) || '{}' : '{}');
        for (let i = 0; i < devices.length; i++) {
            config[devices[i].did] = {
                did: devices[i].did,
                token: devices[i].token,
                ip: devices[i].localip,
                miioUserId: devices[i].uid,
                model: devices[i].model,
            };
        }
        await writeFile(MIIO_DEVICES_PATH, JSON.stringify(config));
    }

    private async addSavedDevices () {
        if (!existsSync(MIIO_DEVICES_PATH)) return;
        const devs = JSON.parse(await readFile(MIIO_DEVICES_PATH, { encoding: 'utf-8' })) as Record<string, ISaveDeviceInfo>;
        Object.values(devs).forEach(dev => {
            if (homeEngine.getEntityByName(getUUIDByMiotDeviceId(dev.did))) return;
            homeEngine.addEntity(createMiotGadget(dev));
        });
    }
}

homeEngine.addSystem(new MiFinderSystem(), 10);
