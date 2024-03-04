import { createHash, randomBytes } from "crypto";
import { CustomCryptRC4 } from "./utils/rc4";
import { stringify } from "querystring";
import fetch from 'node-fetch';

export interface IAuthData {
    userAgent: string;
    clientId: string;
    miioUserId: number;
    serviceToken: string;
    locale: string;
    country: string;
    ssecurity: string;
}

export class MiCloudApiProvider {

    static async request(path: string, data: object, auth: IAuthData) {
        const url = this.getApiUrl(auth.country, path);
        const load = this.generateQueryHeaders(
            'POST',
            auth.userAgent,
            auth.clientId,
            auth.miioUserId,
            auth.serviceToken,
            auth.locale
        );
        const nonce = this.generateNonce();
        const signedNonce = this.generateSignedNonce(auth.ssecurity, nonce);
        Object.assign(load, {
            body: stringify(this.generateSignedLoad(
                url,
                'POST',
                signedNonce,
                nonce,
                {
                    data: JSON.stringify(data)
                },
                auth.ssecurity
            )),
        });


        const queryResult = await fetch(url, load);
        if (!queryResult.ok) return undefined;
        const result = this.decryptWithRc4(signedNonce, await queryResult.text());
        try {
            return JSON.parse(result);
        } catch {
            return undefined;
        }
    }

    protected static getApiUrl(country: string, path: string = '') {
        country = country?.length ? country : 'cn';
        let url = ((country === 'cn') ? '' : country + '.') + 'api.io.mi.com/app/';
        url = url + path;
        url = url.replace(/\/\//g, '/');
        return 'https://' + url;
    }

    protected static generateQueryHeaders(method: 'POST' | 'GET', userAgent: string, clientId: string, miioUserId: number, serviceToken: string, locale: string) {
        return {
            method: method,
            headers: {
                'User-Agent': userAgent,
                'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
                'Accept-Encoding': 'identity',
                'Content-Type': 'application/x-www-form-urlencoded',
                'MIOT-ENCRYPT-ALGORITHM': 'ENCRYPT-RC4',
                Cookie: [
                    'sdkVersion=accountsdk-18.8.15',
                    `deviceId=${clientId}`,
                    `userId=${miioUserId}`,
                    `yetAnotherServiceToken=${serviceToken}`,
                    `serviceToken=${serviceToken}`,
                    `locale=${locale}`,
                    'channel=MI_APP_STORE'
                ].join('; '),
            }
        }
    }

    protected static generateNonce() {
        const buf = Buffer.allocUnsafe(12);
        buf.write(randomBytes(8).toString("hex"), 0, "hex");
        buf.writeInt32BE(parseInt((Date.now() / 60000).toString(), 10), 8);
        return buf.toString("base64");
    }

    protected static generateSignedNonce(ssecurity: string, nonce: string) {
        const salt = Buffer.from(ssecurity, 'base64');
        const n = Buffer.from(nonce, 'base64');
        return createHash('sha256').update(salt).update(n).digest('base64');
    }

    protected static generateSignedLoad(url: string, method: string, signedNonce: string, nonce: string, options: Record<string, any>, ssecurity: string) {
        const rc4Hash = this.generateEncSignature(url, method, signedNonce, options);
        const params: Record<string, any> = {
            'rc4_hash__': rc4Hash,
        };
        for (const [key, val] of Object.entries(options)) {
            params[key] = this.encryptWithRc4(signedNonce, val);
        }
        params.signature = this.generateEncSignature(url, method, signedNonce, params);
        params.ssecurity = ssecurity;
        params._nonce = nonce;
        return params;
    }

    protected static generateEncSignature(url: string, method: string, signedNonce: string, params: Record<string, any>) {
        const signatures: string[] = [
            method,
            url.split("com")[1].replace("/app/", "/")
        ];
        const paramKeys = Object.keys(params).sort();
        for (let i = 0; i < paramKeys.length; i++) {
            signatures.push(`${paramKeys[i]}=${params[paramKeys[i]]}`);
        }
        signatures.push(signedNonce);
        return createHash('sha1').update(signatures.join('&')).digest('base64');
    }

    protected static encryptWithRc4(signedNonce: string, payload: string) {
        return CustomCryptRC4.create(Buffer.from(signedNonce, 'base64'), 1024).encode(payload);
    }

    protected static decryptWithRc4(signedNonce: string, payload: string) {
        payload += '';
        return CustomCryptRC4.create(Buffer.from(signedNonce, 'base64'), 1024).decode(payload);
    }
}