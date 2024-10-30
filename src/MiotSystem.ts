import { HomeSystem, PropertyAccessMode, PropertyDataType, homeEngine } from '@sinkapoy/home-core';
import { MiotDeviceNode } from './nodes';
import { HandshakeConnection, MiioDeviceConnection } from './MiQuery';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { type IMiotSpec } from './interfaces/IMiotSpec';
import { MiotSpecProvider } from './MiotSpecProvider';
import fetch from 'node-fetch';
import { type Entity } from '@ash.ts/ash';
import { MiDeviceInfoComponent, MiotDeviceActions, MiotDeviceProperties } from './components';

const MIOT_SPECS_PATH = 'server-data/miot_specs.json';
const MIOT_FETCH_TIMER = 5000;
class MiotSystem extends HomeSystem {
    onInit (): void {
        this.setupNodeList({
            node: MiotDeviceNode,
            onAdd: this.addNode.bind(this),
            onUpdate: this.onNodeUpdate.bind(this),
        });
        this.setupEvent('writeGadgetProperty', this.onWriteProperty.bind(this));
        this.setupEvent('invokeGadgetAction', this.onInvokeAction.bind(this));
    }

    onDestroy (): void {
        //
    }

    onUpdate (dt: number): void {
        //
    }

    private onNodeUpdate (node: MiotDeviceNode, dt: number) {
        if (!node.properties.has('ready')) return;
        if (node.miot.localConnection?.busy) {
            node.miot.fetchCountdown = MIOT_FETCH_TIMER;
        }
        node.miot.fetchCountdown -= dt;
        if (node.miot.fetchCountdown <= 0) {
            node.miot.fetchCountdown = MIOT_FETCH_TIMER;
            MiotSpecProvider.fetchAllReadableProperties(node.entity);
        }
    }

    private async onWriteProperty (entity: Entity, id: string, val: any) {
        const deviceInfo = entity.get(MiDeviceInfoComponent);
        const props = entity.get(MiotDeviceProperties);
        if (!props || !deviceInfo) return;

        const prop = props.get(id);

        if (!prop) return;
        const oldValue = prop.homeProperty.value;
        prop.homeProperty.value = val;
        if (!await MiotSpecProvider.writeProperty(entity, prop.homeProperty)) {
            prop.homeProperty.value = oldValue;
        }

        this.engine.emit('gadgetPropertyEvent', entity, prop.homeProperty);
    }

    private async onInvokeAction (entity: Entity, id: string, ...args: any[]) {
        const miotDevice = entity.get(MiDeviceInfoComponent);
        if (!miotDevice) return;
        console.debug('invoke action');
        if (miotDevice.localConnection) {
            const actions = entity.get(MiotDeviceActions);
            const props = entity.get(MiotDeviceProperties)!;
            if (!actions?.has(id)) return;

            const result = await miotDevice.localConnection.invokeAction(actions.get(id)!, props, args);
            this.engine.emit('gadgetActonResult', entity, id, [result]);
        }
    }

    private async addNode (node: MiotDeviceNode) {
        if (!node.miot.ip) {
            console.info('cant find ip for ' + node.entity.name);
            return;
        }
        console.debug(`try to handshake ${node.entity.name}`);
        const handshakeConnection = new HandshakeConnection(node.miot.ip);
        const handshake = await handshakeConnection.send();
        if (!handshake) return;
        const dataConnection = new MiioDeviceConnection(
            node.miot.ip,
            handshake.deviceType,
            handshake.deviceId,
            handshakeConnection.getTimeStamp(),
            node.miot.did,
            node.miot.token,
        );

        await dataConnection.handshake();

        node.miot.localConnection = dataConnection;

        const specs = await this.getSpecs(node.miot.model);
        if (!specs) {
            console.warn(`can't get specs for ${node.entity.name}`);
            return;
        }
        MiotSpecProvider.fillEntityBySpec(specs, node.entity);
        this.engine.emit('gadgetPropertyEvent', node.entity, node.properties.createPropertyFromJson({
            id: 'ready',
            dataType: PropertyDataType.boolean,
            accessMode: PropertyAccessMode.rwn,
            value: true,
        }));
    }

    private async getSpecs (model: string) {
        let specsRecord: Record<string, IMiotSpec> = {};
        if (!existsSync(MIOT_SPECS_PATH)) {
            await writeFile(MIOT_SPECS_PATH, '{}');
        } else {
            specsRecord = JSON.parse(await readFile(MIOT_SPECS_PATH, { encoding: 'utf-8' }));
        }

        if (specsRecord[model]) { return specsRecord[model]; } else {
            const allUrns = JSON.parse(
                await (await fetch('https://miot-spec.org/miot-spec-v2/instances?status=all')).text() ?? '{}',
            ) as { instances: { status: string; model: string; version: number; type: string; ts: number; }[]; };
            let urn: string | undefined;
            for (let i = 0; i < allUrns.instances.length; i++) {
                const data = allUrns.instances[i];
                if (data.model === model) {
                    urn = data.type;
                    console.debug('found urn', urn, model);
                    break;
                }
            }
            if (!urn) {
                console.warn(`can't find urn for ${model}`);
                return undefined;
            }
            const result = await (await fetch('https://miot-spec.org/miot-spec-v2/instance?type=' + urn)).text();
            try {
                specsRecord[model] = JSON.parse(result);
            } catch { }
            await writeFile(MIOT_SPECS_PATH, JSON.stringify(specsRecord));
            return specsRecord[model];
        }
    }
}

homeEngine.addSystem(new MiotSystem(), 1);
