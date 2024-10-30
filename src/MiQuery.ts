import { createHash, createCipheriv, createDecipheriv } from 'crypto';
import * as dgram from 'dgram';
import EventEmitter from 'eventemitter3';
import { type IMiotDeviceProperty } from './interfaces/IMiotDeviceProperty';
import { type IGetProperties, type IResultWithError } from './interfaces/miotLocal/localDeviceQueryResults';
import { KnownErrors } from './interfaces/miotLocal/KnownErrors';
import { type PropertyDataType } from '@sinkapoy/home-core';
import { type IMiotDeviceAction } from './interfaces/IMiotDeviceAction';
import { type MiotDeviceProperties } from './components';
import { DeferredPromise } from 'ts-deferable';

export interface IQueryMetadata {
    deviceType: number;
    deviceId: number;
    timeStamp: number;
}

export interface IHandshakeResult {
    deviceType: number;
    deviceId: number;
    timeStamp: number;
}

export interface IQueryResult extends IHandshakeResult {
    data: string;
}

interface IConnectionEvents {
    message: (msg: IQueryResult) => any;
}

abstract class ConnectionPrototype<T extends EventEmitter.ValidEventTypes = IConnectionEvents> extends EventEmitter<T> {
    protected magic = 0x2131;
    protected length = 0;
    protected ip: string;
    protected deviceType: number;
    protected deviceId: number;
    protected timeStamp: number;
    protected timeStampTime = 0;

    protected socket = dgram.createSocket('udp4');

    protected abstract sendRaw (load?: string): Promise<unknown>;

    // abstract send(method: string, params: Record<string, any>): Promise<any>;

    getTimeStamp () {
        return this.timeStamp;
    }
}

class Query {
    public promise = new DeferredPromise<IResultWithError & IGetProperties>();
    constructor (
        public method: string,
        public params: object,
    ) {}
}

export class MiioDeviceConnection extends ConnectionPrototype {
    protected key: Uint8Array;
    protected IV: Uint8Array;
    protected queryNumber = 1;
    protected token: Buffer;
    protected lastTimeAck = 0;
    queryDelays = 50;
    protected queriesQueue: Query[] = [];
    private _busy = false;

    constructor (
        protected ip: string,
        protected deviceType: number,
        protected deviceId: number,
        protected timeStamp: number,
        protected did: string,
        token: string,
        private readonly port = 54321,
    ) {
        super();
        this.timeStampTime = Date.now();
        this.token = Buffer.from(token, 'hex');

        this.key = createHash('md5').update(this.token).digest();

        this.IV = createHash('md5').update(this.key).update(this.token).digest();
        this.socket.on('message', (msg) => {
            const result = this.unpackMsg(msg);
            if (result) {
                this.emit('message', result);
            }
        });
        this.socket.on('error', (e) => {
            console.error('miot socket error:\n\t' + e.message);
        });
        this.socket.bind();
    }

    get busy () {
        return this._busy;
    }

    protected async recreateSocket () {
        if (this.socket) {
            try {
                this.socket.disconnect();
                this.socket.close();
            } catch {
                //
            }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.socket = dgram.createSocket('udp4');
        this.socket.on('message', (msg) => {
            const result = this.unpackMsg(msg);
            if (result) {
                this.emit('message', result);
            }
        });
        this.socket.on('error', (e) => {
            console.error('miot socket error:\n\t' + e.message);
        });
        const bindPromise = new Promise((resolve) => {
            this.socket.once('listening', resolve);
        });
        this.socket.bind();
        await bindPromise;
        await this.handshake();
    }

    protected async sendRaw (load?: string) {
        this.queryNumber++;
        this.queryNumber %= 16535;
        const now = Date.now();
        const lastAckDt = now - this.lastTimeAck;
        if (lastAckDt < this.queryDelays) {
            await new Promise(resolve => {
                setTimeout(resolve, this.queryDelays - lastAckDt);
            });
        }
        this.lastTimeAck = now;
        return await new Promise((resolve) => {
            setTimeout(() => { resolve({ error: 'network error' }); }, 5000);
            const socket = this.socket;
            const cb = async (msg: Buffer) => {
                const answer = this.unpackMsg(msg) as IResultWithError;
                socket.off('message', cb);
                resolve(answer);
            };
            socket.once('message', cb);
            const msg = this.packMsg(
                this.encryptData(load ?? ''),
            );
            socket.send(
                msg,
                this.port,
                this.ip,
            );
        });
    }

    private async sendFromQueue () {
        if (this._busy) return;
        const query = this.queriesQueue.pop();
        if (!query) return;
        this._busy = true;
        const { method, params } = query;
        while (true) {
            const result = await this.sendRaw(JSON.stringify({
                method,
                params,
                id: this.queryNumber,
            })) as IResultWithError & IGetProperties;
            if (!result?.error || result?.error?.code !== KnownErrors.ackTimeout) {
                query.promise.resolve(result);
                this._busy = false;
                this.sendFromQueue();
                return;
            }
            console.warn('MIOT: error', result);
            await new Promise(resolve => setTimeout(resolve, 500));
            this.queryNumber++;
            await this.recreateSocket();
        }
    }

    send (method: string, params: Record<string, any>) {
        if (!params.timeout) {
            Object.assign(params, {
                timeout: 16535,
                retries: 3,
            });
        }

        const query = new Query(method, params);
        this.queriesQueue.unshift(query);
        this.sendFromQueue();
        return query.promise;
    }

    async getProperties (props: IMiotDeviceProperty<PropertyDataType.any>[] = []) {
        const params = props.map(prop => {
            return {
                did: this.did + '',
                siid: prop.siid,
                piid: prop.iid,
            };
        });
        return await this.send('get_properties', params);
    }

    async writeProperties (props: IMiotDeviceProperty<PropertyDataType.any>[] = []) {
        const params = props.map(prop => {
            return {
                did: this.did + '',
                siid: prop.siid,
                piid: prop.iid,
                value: prop.homeProperty.value,
            };
        });
        return await this.send('set_properties', params);
    }

    async invokeAction (action: IMiotDeviceAction, props: MiotDeviceProperties, args: any[]) {
        const params = {
            did: this.did + '',
            siid: action.siid,
            aiid: action.iid,
            in: [] as { siid: number; piid: number; value: any; }[],
        };
        args.forEach((value, index) => {
            const propId = action.inProps[index];
            const prop = props.get(propId);
            if (!prop) return;
            params.in[index] = {
                siid: prop.siid,
                piid: prop.iid,
                value,
            };
        });
        console.debug(`MIOT: call action ${JSON.stringify(params)}`);
        const promise = this.send('action', params);
        promise.then((result) => { console.debug(`got for action ${JSON.stringify(result)}`); });
        return await promise;
    }

    protected encryptData (data: string) {
        const cipher = createCipheriv('aes-128-cbc', this.key, this.IV);
        const buffer = Buffer.from(data);

        return Buffer.concat([
            cipher.update(buffer),
            cipher.final(),
        ]);
    }

    protected unpackMsg (msgEncrypted: Buffer, handshake = false) {
        const dataView = new DataView(msgEncrypted.buffer);
        // const magic = dataView.getUint16(0);
        // const length = dataView.getUint16(2);
        const deviceType = dataView.getUint16(8);
        const deviceId = dataView.getUint16(10);
        const timeStamp = dataView.getUint32(12);
        this.timeStamp = timeStamp;
        this.timeStampTime = Date.now();
        if (handshake || (msgEncrypted.length <= 32)) {
            this.timeStamp = timeStamp;
            return <IQueryResult>{
                deviceType,
                deviceId,
                timeStamp,
            };
        }
        // const crc = msgEncrypted.slice(16, 32);
        const encrypted = msgEncrypted.slice(32);
        // const digest = createHash('md5')
        //     .update(msgEncrypted.slice(0, 16))
        //     .update(this.token)
        //     .update(encrypted)
        //     .digest();
        const decrypter = createDecipheriv('aes-128-cbc', this.key, this.IV);
        try {
            const data = Buffer.concat([
                decrypter.update(encrypted),
                decrypter.final(),
            ]).toString('utf-8');

            return JSON.parse(data);
        } catch {
            return { error: 'decrypt error' };
        }
    }

    protected packMsg (msg: Buffer) {
        this.length = 32 + msg.length;
        const buffer = Buffer.allocUnsafe(this.length);
        buffer.writeUint16BE(this.magic);
        buffer.writeUint16BE(this.length, 2);
        buffer.writeUint32BE(0, 4);
        buffer.writeUint16BE(this.deviceType, 8);
        buffer.writeUint16BE(this.deviceId, 10);
        const elapsedSeconds = ((Date.now() - this.timeStampTime) / 1000) >> 0;
        buffer.writeUint32BE(this.timeStamp + elapsedSeconds, 12);
        msg.copy(buffer, 32);
        const checksum = this.getChecksum(buffer.slice(0, 16), msg);
        checksum.copy(buffer, 16);

        return buffer;
    }

    handshake () {
        const buffer = Buffer.allocUnsafe(32);
        buffer.writeUint16BE(0x2131);
        buffer.writeUint16BE(0x20, 2);
        for (let i = 0; i < 7; i++) {
            buffer.writeUint32BE(0xffffffff, 4 + i * 4);
        }
        return new Promise(resolve => {
            const cb = (msg: Buffer) => {
                resolve(this.unpackMsg(msg, true));
            };
            this.socket.once('message', cb);
            this.socket.send(buffer, this.port, this.ip, (e, l) => {
                if (e) {
                    this.socket.off('message', cb);
                    resolve(undefined);
                }
            });
        });
    }

    private getChecksum (header: Buffer, encryptedMsg: Buffer) {
        return createHash('md5')
            .update(header)
            .update(this.token)
            .update(encryptedMsg)
            .digest();
    }
}

export class HandshakeConnection extends ConnectionPrototype {
    private readonly load = '';
    constructor (
        protected ip,
        private readonly port = 54321,
    ) {
        super();
        for (let i = 0; i < 14 * 4; i++) {
            this.load += 'F';
        }
        this.socket.on('message', (msg) => {
            const result = this.unpackMsg(msg, true);
            if (result) {
                this.emit('message', result);
            }
        });
        this.socket.on('error', error => {
            console.error(error);
        });
        this.socket.bind(() => {
            this.socket.setBroadcast(true);
            console.debug('socket', this.socket.address());
        });
    }

    protected sendRaw (): Promise<IHandshakeResult | undefined> {
        return new Promise(resolve => {
            const socket = dgram.createSocket('udp4');

            socket.once('message', msg => {
                resolve(this.unpackMsg(msg, true));
            });
            const sendMsg = Buffer.from(
                this.magic.toString(16) +
                '0020' +
                this.load
                , 'hex');
            socket.send(
                sendMsg,
                this.port,
                this.ip,
                (a, b) => {
                    // console.error(a,b)
                },
            );
        });
    }

    send () {
        return this.sendRaw();
    }

    protected unpackMsg (msg: Uint8Array, handshake = false) {
        const dataView = new DataView(msg.buffer);
        // const magic = dataView.getUint16(0);
        // const length = dataView.getUint16(2);
        const deviceType = dataView.getUint16(8);
        const deviceId = dataView.getUint16(10);
        const timeStamp = dataView.getUint32(12);
        if (handshake) {
            this.timeStamp = timeStamp;
            return <IQueryResult>{
                deviceType,
                deviceId,
                timeStamp,
            };
        }
    }
}
