import { FileT, HomeSystem, homeEngine } from "@sinkapoy/home-core";
import { HandshakeConnection, IQueryResult } from "./MiQuery";
import { ISaveConfig } from "./interfaces/saves/ISaveConfig";
import { MiCloudService } from "./MiCloudService";
import { readFile, writeFile } from "fs/promises";
import { IAccountDeviceInfo } from "./interfaces/IAccountDeviceInfo";
import { ISaveDeviceInfo } from "./interfaces/saves/ISaveDeviceInfo";
import { existsSync } from "fs";
import { getUUIDByMiotDeviceId } from "./utils/deviceIdToUUIDAdapter";
import { createMiotGadget } from "./utils/createDevice";
import { miotPluginStore } from "./store";

const FILE_PATH = 'server-data/miioConfig.json';
const MIIO_DEVICES_PATH = 'server-data/miio_devices.json';
class MiFinderSystem extends HomeSystem {

    private searchTimer = { countdown: 5000, time: 5000 };

    private handshakeMsg = new HandshakeConnection('255.255.255.255')

    private accounts: Record<number, MiCloudService> = {};

    onInit(): void {
        this.handshakeMsg.on('message', this.debug, this);
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
        console.log('init mi finder');
    }

    onDestroy(): void {

    }

    onUpdate(dt: number): void {
        // this.searchTimer.countdown -= dt;
        // if (this.searchTimer.countdown <= 0) {
        //     console.log('find')
        //     this.findLocalDevices();
        //     this.searchTimer.countdown = this.searchTimer.time;
        // }
    }

    protected findLocalDevices() {
        this.handshakeMsg.sendRaw();
    }

    debug(msg: IQueryResult) {
        console.log(msg);
    }

    private parseConfig(file: FileT) {
        console.log(file)
        if (file.path !== FILE_PATH) return;
        try {
            const config: ISaveConfig = JSON.parse(file.content);
            config.accounts.forEach((accConf) => {
                const acc = new MiCloudService(
                    accConf.username,
                    accConf.password,
                    accConf.locale,
                    accConf.country,
                );

                acc.once('loggedIn', async () => {
                    const devs = await acc.getDevices();
                    console.log(devs);
                    this.accounts[acc.miioUserId] = acc;
                    miotPluginStore.accounts[acc.miioUserId] = acc;
                    await this.saveDevices(devs);
                    this.addSavedDevices();
                });
            });
        } catch (e) {
            console.error(e);
        }
    }

    private async saveDevices(devices: IAccountDeviceInfo[]) {
        const config: Record<string, ISaveDeviceInfo> = JSON.parse(
            existsSync(MIIO_DEVICES_PATH) ? await readFile(MIIO_DEVICES_PATH, { encoding: 'utf-8' }) || '{}' : '{}');
        for (let i = 0; i < devices.length; i++) {
            config[devices[i].did] = {
                did: devices[i].did,
                token: devices[i].token,
                ip: devices[i].localip,
                miioUserId: devices[i].uid,
                model: devices[i].model,
            }
        }
        await writeFile(MIIO_DEVICES_PATH, JSON.stringify(config));
    }

    private async addSavedDevices() {
        if (!existsSync(MIIO_DEVICES_PATH)) return;
        const devs = JSON.parse(await readFile(MIIO_DEVICES_PATH, { encoding: 'utf-8' })) as Record<string, ISaveDeviceInfo>;
        Object.values(devs).forEach(dev => {
            if (homeEngine.getEntityByName(getUUIDByMiotDeviceId(dev.did))) return;
            homeEngine.addEntity(createMiotGadget(dev));
        });
    }

}

homeEngine.addSystem(new MiFinderSystem(), 10);