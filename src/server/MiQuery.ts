import { createHash, createCipheriv, createDecipheriv } from 'crypto';
import * as dgram from 'dgram';
import EventEmitter from 'eventemitter3';
import { type IMiotDeviceProperty } from '../interfaces/IMiotDeviceProperty';
import { type IGetProperties, type IResultWithError } from '../interfaces/miotLocal/localDeviceQueryResults';
import { KnownErrors } from '../interfaces/miotLocal/KnownErrors';
import { type PropertyDataType } from '@sinkapoy/home-core';
import { type IMiotDeviceAction } from '../interfaces/IMiotDeviceAction';
import { type MiotDeviceProperties } from './ecs/components';
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

    protected socket: dgram.Socket;
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

    static readonly queueBlacklist = new Set(['sweep:direction']);

    constructor (
        protected ip: string,
        protected did: string,
        token: string,
        private readonly port = 54321,
    ) {
        super();
        this.timeStampTime = Date.now();
        this.token = Buffer.from(token, 'hex');

        this.key = createHash('md5').update(this.token).digest();

        this.IV = createHash('md5').update(this.key).update(this.token).digest();
        this.recreateSocket(false);
    }

    get busy () {
        return this._busy;
    }

    protected async recreateSocket (wait = true) {
        if (this.socket) {
            try {
                this.socket.removeAllListeners();
                this.socket.close();
            } catch {
                //
            }
        }
        if(wait)
            await new Promise(resolve => setTimeout(resolve, 1000));
        try{
            this.socket = dgram.createSocket({type: 'udp4', reuseAddr: true});
            this.socket.on('message', (msg) => {
                const result = this.unpackMsg(msg);
                if (result) {
                    this.emit('message', result);
                }
            });
            this.socket.on('error', (e) => {
                console.error('miot socket error:\n\t' + e.message);
            });
            this.socket.on('close', ()=>{
                console.error('miot socket is closed');
                this.recreateSocket(true);
            });
            const bindPromise = new DeferredPromise<void>((resolve) => {
                this.socket.once('listening', resolve);
            });
            this.socket.bind({exclusive: false});
            await bindPromise;
            await this.handshake();
        } catch (e) {
            console.error(e);
            await this.recreateSocket();
        }
    }

    protected async sendRaw (load?: string, wait = true): Promise<unknown> {
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
        if(wait)
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
        else {
            const socket = this.socket;
            const msg = this.packMsg(
                this.encryptData(load ?? ''),
            );
            socket.send(
                msg,
                this.port,
                this.ip,
            );
            return Promise.resolve({});
        }
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

    send (method: string, params: Record<string, any>, withoutQueue = false) {
        if (!params.timeout) {
            Object.assign(params, {
                timeout: 16535,
                retries: 3,
            });
        }

        
        if(withoutQueue){
            if(!this.queriesQueue.length){
                this.sendRaw(JSON.stringify({
                    method,
                    params,
                    id: this.queryNumber,
                }), false);
            }
            return Promise.resolve(<IResultWithError & IGetProperties>{});
        } else {
            const query = new Query(method, params);
            this.queriesQueue.unshift(query);
            this.sendFromQueue();
            return query.promise;
        }
        
        
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
        return await this.send('set_properties', params, MiioDeviceConnection.queueBlacklist.has(props[0].name));
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
        this.deviceId = deviceId;
        this.deviceType = deviceType;
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

    async handshake () {
        const buffer = Buffer.allocUnsafe(32);
        buffer.writeUint16BE(0x2131);
        buffer.writeUint16BE(0x20, 2);
        for (let i = 0; i < 7; i++) {
            buffer.writeUint32BE(0xffffffff, 4 + i * 4);
        }
        for(let i =0; i < 10; i++){
            const result = await new Promise<boolean>(resolve => {
                const cb = (msg: Buffer) => {
                    resolve(this.unpackMsg(msg, true));
                };
                this.socket.once('message', cb);
                this.socket.send(buffer, this.port, this.ip, (e, _l) => {
                    if (e) {
                        this.socket.off('message', cb);
                        resolve(true);
                    }
                });
                setTimeout(()=>resolve(false), 5000);
            });
            if(result){
                return true;
            }
        }
        return false;
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
    private recreateSocketPromise = new DeferredPromise();
    constructor (
        protected ip,
        private readonly port = 54321,
    ) {
        super();
        for (let i = 0; i < 14 * 4; i++) {
            this.load += 'F';
        }
        this.recreateSocket(false);  
    }

    protected async sendRaw (): Promise<IHandshakeResult | undefined> {
        await this.recreateSocketPromise;
        return new Promise(resolve => {
            const socket = dgram.createSocket({type: 'udp4', reuseAddr: true});

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
                (_a, _b) => {
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

    protected async recreateSocket (wait = true) {
        if (this.socket) {
            try {
                this.socket.disconnect();
                this.socket.close();
            } catch {
                //
            }
        }
        if(wait)
            await new Promise(resolve => setTimeout(resolve, 1000));
        try{
            this.socket = dgram.createSocket({type: 'udp4', reuseAddr: true});
            this.socket.on('message', (msg) => {
                const result = this.unpackMsg(msg, true);
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
            this.socket.bind({exclusive: false});
            await bindPromise;
            this.recreateSocketPromise.resolve(undefined);
        } catch (e) {
            console.error(e);
            await this.recreateSocket();
        }
    }
}
