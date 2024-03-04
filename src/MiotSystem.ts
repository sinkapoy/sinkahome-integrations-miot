import { HomeSystem, Property, PropertyAccessMode, homeEngine } from "@sinkapoy/home-core";
import { MiotDeviceNode } from "./nodes";
import { HandshakeConnection, MiioDeviceConnection } from "./MiQuery";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { IMiotSpec } from "./interfaces/IMiotSpec";
import { MiotSpecProvider } from "./MiotSpecProvider";
import fetch from 'node-fetch';

const MIOT_SPECS_PATH = 'server-data/miot_specs.json';

class MiotSystem extends HomeSystem {
    onInit(): void {
        this.setupNodeList({
            node: MiotDeviceNode,
            onAdd: this.addNode.bind(this),
        });

    }

    onDestroy(): void {

    }

    onUpdate(dt: number): void {

    }

    private async addNode(node: MiotDeviceNode) {
        if (!node.miot.ip) return;
        const handshakeConnection = new HandshakeConnection(node.miot.ip);
        const handshake = await handshakeConnection.sendRaw();
        if (!handshake) return;
        const dataConnection = new MiioDeviceConnection(
            node.miot.ip,
            handshake.deviceType,
            handshake.deviceId,
            handshakeConnection.getTimeStamp(),
            node.miot.did,
            node.miot.token
        );
        await new Promise(r => setTimeout(r, 100));
        await dataConnection.handshake();

        node.miot.localConnection = dataConnection;

        const specs = await this.getSpecs(node.miot.model);
        if (!specs) return;
        MiotSpecProvider.fillEntityBySpec(specs, node.entity);
        await MiotSpecProvider.fetchAllReadableProperties(node.entity);
        const mode = node.properties.get('vacuum:mode');
        console.log('vacuum mode', mode)
        mode!.value = 2;
        MiotSpecProvider.writeProperty(node.entity, mode!);
    }

    private async getSpecs(model: string) {
        let specsRecord: Record<string, IMiotSpec> = {};
        if (!existsSync(MIOT_SPECS_PATH)) {
            await writeFile(MIOT_SPECS_PATH, '{}')
        } else {
            specsRecord = JSON.parse(await readFile(MIOT_SPECS_PATH, { encoding: 'utf-8' }));
        }

        if (specsRecord[model]) { return specsRecord[model] }
        else {
            const allUrns = JSON.parse(
                await (await fetch('https://miot-spec.org/miot-spec-v2/instances?status=all')).text() ?? '{}'
            ) as { instances: { status: string; model: string; version: number; type: string, ts: number }[] };
            let urn: string | undefined = undefined;
            for (let i = 0; i < allUrns.instances.length; i++) {
                const data = allUrns.instances[i];
                if (data.model === model) {
                    urn = data.type;
                    console.log('found urn', urn, model)
                    break;
                }

            }
            if (!urn) return undefined;
            const result = await (await fetch('https://miot-spec.org/miot-spec-v2/instance?type=' + urn)).text();
            try {
                specsRecord[model] = JSON.parse(result);
            } catch { }
            console.log(specsRecord)
            await writeFile(MIOT_SPECS_PATH, JSON.stringify(specsRecord));
            return specsRecord[model];
        }
    }

}

homeEngine.addSystem(new MiotSystem(), 1);