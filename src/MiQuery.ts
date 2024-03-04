import { createHash, createCipheriv, createDecipheriv } from "crypto";
import * as dgram from "dgram";
import EventEmitter from "eventemitter3";
import { IMiotDeviceProperty } from "./interfaces/IMiotDeviceProperty";
import { IResultWithError } from "./interfaces/miotLocal/localDeviceQueryResults";
import { KnownErrors } from "./interfaces/miotLocal/KnownErrors";
import { PropertyDataType } from "@sinkapoy/home-core";

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

    abstract sendRaw(load?: string): Promise<unknown>;



    getTimeStamp() {
        return this.timeStamp;
    }

}

export class MiioDeviceConnection extends ConnectionPrototype {
    protected key: Uint8Array;
    protected IV: Uint8Array;
    protected queryNumber = 1;
    protected token: Buffer;
    protected lastTimeAck = 0;
    queryDelays = 1000;

    constructor(
        protected ip: string,
        protected deviceType: number,
        protected deviceId: number,
        protected timeStamp: number,
        protected did: string,
        token: string,
        private port = 54321
    ) {
        super();
        this.timeStampTime = Date.now();
        this.token = Buffer.from(token, 'hex');

        this.key = createHash("md5").update(this.token).digest();

        this.IV = createHash("md5").update(this.key).update(this.token).digest();
        this.socket.on('message', (msg) => {
            const result = this.unpackMsg(msg);
            if (result) {
                this.emit('message', result);
            }
        })
        this.socket.on('error', (e) => {
            console.error('miot socket error:\n\t' + e.message);
        });
        this.socket.bind();
    }

    protected async recreateSocket() {
        if (this.socket) {
            try{
                this.socket.disconnect();
                this.socket.close();
            }
            catch {
                //
            }
        }
        await new Promise(r => setTimeout(r, 1000));
        this.socket = dgram.createSocket('udp4');
        this.socket.on('message', (msg) => {
            const result = this.unpackMsg(msg);
            if (result) {
                this.emit('message', result);
            }
        })
        this.socket.on('error', (e) => {
            console.error('miot socket error:\n\t' + e.message);
        });
        const bindPromise = new Promise((resolve) => {
            this.socket.once('listening', resolve);
        })
        this.socket.bind();
        await bindPromise;
        console.log('handshake')
        await this.handshake();
        console.log('got connection')
    }

    async sendRaw(load?: string) {
        await this.handshake();
        this.queryNumber++;
        this.queryNumber %= 16535;
        const now = Date.now();
        const lastAckDt = now - this.lastTimeAck;
        console.log(lastAckDt);
        if (lastAckDt < this.queryDelays) {
            await new Promise(resolve => {
                setTimeout(resolve, this.queryDelays - lastAckDt);
            });
        }
        this.lastTimeAck = now;
        return new Promise(async (resolve, reject) => {
            setTimeout(reject, 5000);
            const socket = this.socket;
            const cb = async (msg: Buffer) => {
                const answer = this.unpackMsg(msg) as IResultWithError;
                console.log('got', answer)
                socket.off('message', cb);
                resolve(answer);
            }
            socket.once("message", cb);
            const msg = this.packMsg(
                this.encryptData(load ?? '')
            );
            socket.send(
                msg,
                this.port,
                this.ip
            );
        });
    }

    async send(method: string, params: Record<string, any>) {
        while (true) {
            const result = await this.sendRaw(JSON.stringify({
                method,
                params,
                id: this.queryNumber,
            })) as IResultWithError;
            if (!result?.error || result?.error?.code !== KnownErrors.ackTimeout) {
                return result;
            }
            console.log('error send msg');
            await new Promise(r => setTimeout(r, 10000));
            this.queryNumber++;
            // this.queryNumber += 100;
            this.recreateSocket();
            
        }


    }

    async getProperties(props: IMiotDeviceProperty<PropertyDataType.any>[] = []) {
        const params = props.map(prop => {
            return {
                did: this.did + '',
                siid: prop.siid,
                piid: prop.iid,
            }
        });
        return this.send('get_properties', params);
    }

    async writeProperties(props: IMiotDeviceProperty<PropertyDataType.any>[] = []) {
        const params = props.map(prop => {
            return {
                did: this.did + '',
                siid: prop.siid,
                piid: prop.iid,
            }
        });
        return this.send('set_properties', params);
    }

    protected encryptData(data: string) {
        const cipher = createCipheriv("aes-128-cbc", this.key, this.IV);
        const buffer = Buffer.from(data);
        return Buffer.concat([
            cipher.update(buffer),
            cipher.final()
        ]);
    }

    protected unpackMsg(msgEncrypted: Buffer, handshake = false) {
        const dataView = new DataView(msgEncrypted.buffer);
        const magic = dataView.getUint16(0);
        const length = dataView.getUint16(2);
        const deviceType = dataView.getUint16(8);
        const deviceId = dataView.getUint16(10);
        const timeStamp = dataView.getUint32(12);
        this.timeStamp = timeStamp;
        this.timeStampTime = Date.now();
        console.log('got ts', timeStamp)
        if (handshake || (msgEncrypted.length <= 32)) {
            this.timeStamp = timeStamp;
            return <IQueryResult>{
                deviceType,
                deviceId,
                timeStamp,
            };
        }
        const crc = msgEncrypted.slice(16, 32);
        const encrypted = msgEncrypted.slice(32);
        const digest = createHash('md5')
            .update(msgEncrypted.slice(0, 16))
            .update(this.token)
            .update(encrypted)
            .digest();
        const decrypter = createDecipheriv('aes-128-cbc', this.key, this.IV);
        const data = Buffer.concat([
            decrypter.update(encrypted),
            decrypter.final()
        ]).toString('utf-8');

        return JSON.parse(data);
    }

    protected packMsg(msg: Buffer) {
        this.length = 32 + msg.length;
        const buffer = Buffer.allocUnsafe(this.length);
        buffer.writeUint16BE(this.magic);
        buffer.writeUint16BE(this.length, 2);
        buffer.writeUint32BE(0, 4);
        buffer.writeUint16BE(this.deviceType, 8);
        buffer.writeUint16BE(this.deviceId, 10);
        const elapsedSeconds = ((Date.now() - this.timeStampTime) / 1000) >> 0;
        buffer.writeUint32BE(this.timeStamp + elapsedSeconds, 12);
        console.log('send ts', this.timeStamp + elapsedSeconds)
        msg.copy(buffer, 32);
        const checksum = this.getChecksum(buffer.slice(0, 16), msg);
        checksum.copy(buffer, 16);

        return buffer;
    }

    handshake() {
        const buffer = Buffer.allocUnsafe(32);
        buffer.writeUint16BE(0x2131);
        buffer.writeUint16BE(0x20, 2);
        for (let i = 0; i < 7; i++) {
            buffer.writeUint32BE(0xffffffff, 4 + i * 4)
        }
        return new Promise(resolve => {
            const cb = (msg: Buffer) => {
                console.log('got handshake for stable connection')
                resolve(this.unpackMsg(msg, true));
            };
            this.socket.once('message', cb);
            this.socket.send(buffer, this.port, this.ip, (e, l) => {
                console.log(`send handshake to ${this.ip + ':' + this.port}\n${l}`);
                if (e) {
                    this.socket.off('message', cb);
                    resolve(undefined);
                }
            });
        });

    }

    private getChecksum(header: Buffer, encryptedMsg: Buffer) {
        return createHash("md5")
            .update(header)
            .update(this.token)
            .update(encryptedMsg)
            .digest();
    }
}

export class HandshakeConnection extends ConnectionPrototype {
    private load = "";
    constructor(
        protected ip,
        private port = 54321
    ) {
        super();
        for (let i = 0; i < 14 * 4; i++) {
            this.load += "F"
        }
        this.socket.on('message', (msg) => {
            const result = this.unpackMsg(msg, true);
            if (result) {
                this.emit('message', result);
            }

        });
        this.socket.on("error", error => {
            console.error(error);
        });
        this.socket.bind(() => {
            this.socket.setBroadcast(true);
            console.log('socket', this.socket.address());
        });
    }



    sendRaw(): Promise<IHandshakeResult | undefined> {
        return new Promise(async resolve => {
            const socket = dgram.createSocket('udp4');

            socket.once("message", msg => {
                resolve(this.unpackMsg(msg, true));
            });
            // setTimeout(() => {
            //     resolve(undefined);
            // }, 2000);
            const sendMsg = Buffer.from(
                this.magic.toString(16)
                + "0020"
                + this.load
                , "hex")
            socket.send(
                sendMsg,
                this.port,
                this.ip,
                (a, b) => {
                    // console.error(a,b)
                }
            );

        });
    }

    protected unpackMsg(msg: Uint8Array, handshake = false) {
        const dataView = new DataView(msg.buffer);
        const magic = dataView.getUint16(0);
        const length = dataView.getUint16(2);
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