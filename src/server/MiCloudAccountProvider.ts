import { URLSearchParams } from 'url';
import { createHash } from 'crypto';
import { type IAuthData, MiCloudApiProvider } from './MiCloudApiProvider';
import EventEmitter from 'eventemitter3';
import { type IGetDevicesRequestResult } from '../interfaces/IGetDevicesRequestResult';
import fetch from 'node-fetch';

interface IMiCloudServiceEvents {
    loggedIn: () => any;
}

export class MiCloudAccountProvider<T extends EventEmitter.ValidEventTypes = object> extends EventEmitter<IMiCloudServiceEvents | T> {
    static readonly countries = ['ru', 'us', 'tw', 'sg', 'cn', 'de', 'in', 'i2'];
    static readonly step1url = 'https://account.xiaomi.com/pass/serviceLogin?sid=xiaomiio&_json=true';
    static readonly step2url = 'https://account.xiaomi.com/pass/serviceLoginAuth2';

    private readonly agentId = 'ABCDEFABCDEFB';
    
    private loggedIn = false;

    private readonly auth: IAuthData = {
        userAgent: undefined,
        clientId: undefined,
        miioUserId: undefined,
        serviceToken: undefined,
        locale: undefined,
        country: undefined,
        ssecurity: undefined,
    } as unknown as IAuthData;

    get miioUserId () {
        return this.auth.miioUserId;
    }

    get isLoggedIn(){
        return this.loggedIn;
    }

    constructor (
        private readonly username: string,
        password: string,
        locale = 'en',
        country = MiCloudAccountProvider.countries[0],
    ) {
        super();
        this.auth.userAgent = `Android-7.1.1-1.0.0-ONEPLUS A3010-136-${this.agentId} APP/xiaomi.smarthome APPV/62830`;
        this.auth.clientId = 'AZJROP';
        this.auth.locale = locale;
        this.auth.country = country;

        console.debug('new cloud service for', this.username);
        this.once('loggedIn', ()=>this.loggedIn = true);
        this.login(username, password);
    }

    private async login (username: string, password: string) {
        while(true){
            try{
                console.debug(`login with ${username}`);
                const sign = await this.loginStep1();
                console.debug('sign', sign);
                if (!sign) { return; }
                const step2 = await this.loginStep2(username, password, sign);
                if (!step2.location) { return; }
                const serviceToken = await this.loginStep3(step2.location);
                this.auth.miioUserId = step2.userId ?? 0;
                this.auth.serviceToken = serviceToken!;
                this.auth.ssecurity = step2.ssecurity!;
    
                this.emit('loggedIn');
                break;
            } catch(e){
                console.error(e);
                await new Promise(r=>setTimeout(r, 10000));
            }
        }
        
    }

    private async loginStep1 () {
        let str = await (await fetch(MiCloudAccountProvider.step1url)).text() ?? '{}';
        if (str.indexOf('&&&START&&&') === 0) {
            str = str.replace('&&&START&&&', '');
        }
        const json = JSON.parse(str);
        return json._sign as string | undefined;
    }

    private async loginStep2 (username: string, password: string, sign: string) {
        const params = new URLSearchParams({
            user: username,
            hash: createHash('md5')
                .update(password)
                .digest('hex')
                .toUpperCase(),
            _json: 'true',
            sid: 'xiaomiio',
            callback: 'https://sts.api.io.mi.com/sts',
            qs: '%3Fsid%3Dxiaomiio%26_json%3Dtrue',
            _sign: sign,
        });
        let str = await (await fetch(MiCloudAccountProvider.step2url, {
            method: 'POST',
            body: params,
            headers: {
                'User-Agent': this.auth.userAgent,
                'Content-Type': 'application/x-www-form-urlencoded',
                Cookie: [
                    'sdkVersion=accountsdk-18.8.15',
                    `deviceId=${this.auth.clientId};`,
                ].join('; '),
            },
        })).text();
        if (str.indexOf('&&&START&&&') === 0) {
            str = str.replace('&&&START&&&', '');
        }
        return JSON.parse(str ?? '{}') as Partial<{
            ssecurity: string;
            qs: string;
            code: number;
            passToken: string;
            description: string;
            securityStatus: number;
            nonce: number;
            userId: number;
            cUserId: string;
            result: string;
            psecurity: string;
            capthaUrl: string | null;
            location: string;
        }>;
    }

    private async loginStep3 (location: string) {
        const query = await fetch(location);
        const regex = /serviceToken=[\w\d+\/=]*;/;
        const raw = query.headers.get('set-cookie') ?? '';
        if (regex.test(raw)) {
            return regex.exec(raw)?.[0].split('serviceToken=')[1].replace(';', '');
        }
    }

    async request (path: string, data: object) {
        return await MiCloudApiProvider.request(path, data, this.auth);
    }

    async getDevices () {
        const reqResult = await this.request('home/device_list', {
            getVirtualModel: false,
            getHuamiDevices: 0,
        }) as IGetDevicesRequestResult;
        if (!reqResult) return [];

        return reqResult.result.list;
    }

    async getMapData(deviceId: string, mapName: string){
        const reqResult = await this.request('v2/home/get_interim_file_url', {
            obj_name: `${this.miioUserId}/${deviceId}/${mapName}`,
        });
        // const reqResult = await this.request('v2/home/get_interim_file_url', {
        //     obj_name: `${this.miioUserId}/${deviceId}/${mapName}`,
        // });
        // const reqResult = await this.request('/home/getmapfileurl', {
        //     obj_name: `${mapName}`,
        // });
        console.debug(reqResult);
        if(reqResult.result){
            const url = reqResult.result.url;
            console.debug(await MiCloudApiProvider.get(url, {}, this.auth));
        }
        return reqResult;
    }
}
