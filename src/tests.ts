import { createCipheriv, createHash } from "crypto";
import { MiioDeviceConnection } from "./MiQuery";

const deviceType = 0xdead;
const deviceId = 0xbeaf;
const token = '6c6554657762735a4b597a4758654967';
const timeStamp = 0xfafafafa;
const did = '12';

function getCryptKey(){
    const t = Buffer.from(token, 'hex');
    const key = createHash('md5').update(t).digest();
    return {
        key,
        IV: createHash('md5')
        .update(key)
        .update(t)
        .digest(),
        token: t
    }
}

function _encryptMessage(data: Buffer) {

    const header = Buffer.alloc(2 + 2 + 4 + 4 + 4 + 16);
    header.writeInt16BE(0x2131);

    const cryptKey = getCryptKey();

    // Encrypt the data
    const cipher = createCipheriv('aes-128-cbc', cryptKey.key, cryptKey.IV);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

    // Set the length
    header.writeUInt16BE(32 + encrypted.length, 2);

    // Unknown
    header.writeUInt32BE(0x00000000, 4);

    // Stamp
    if (true) {
        const secondsPassed = 0;
        header.writeUInt32BE(timeStamp + secondsPassed, 12);
    } 
    // else {
        // header.writeUInt32BE(0xffffffff, 12);
    // }

    // Device ID
    header.writeUInt32BE(Number(deviceId), 8);

    // MD5 Checksum
    const digest = createHash('md5')
        .update(header.slice(0, 16))
        .update(Buffer.from(token, 'hex'))
        .update(encrypted)
        .digest();
    digest.copy(header, 16);
    return Buffer.concat([header, encrypted]);
}

class TestConnection extends MiioDeviceConnection{
    test(){
        this.timeStamp = timeStamp;
        this.timeStampTime = Date.now();
        console.log('key check')
        console.log('ref', getCryptKey());
        console.log('my', {key: this.key, IV: this.IV, token: this.token});

        const data = 'ololo';
        const myresult = this.packMsg(this.encryptData(data));
        const refResult = _encryptMessage(Buffer.from(data));
        console.log(myresult);
        console.log(refResult);

        console.log('load check');
        console.log(myresult.slice(32));
        console.log(refResult.slice(32));
        
        console.log('crc check');
        console.log(myresult.slice(16,32));
        console.log(refResult.slice(16,32));
    }
}

const t = new TestConnection('192.168.0.2', deviceType, deviceId, 0,did,  token);
t.test();