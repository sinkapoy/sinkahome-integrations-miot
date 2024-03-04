export interface IAccountDeviceInfo {
    /** device id number in string */
    "did": string,
    "token": string,
    "longitude": string,
    "latitude": string,
    "name": string,
    "pid": string,
    "localip": string,
    "mac": string,
    /** the wifi access point name */
    "ssid": string,
    /** the wifi access point mac */
    "bssid": string,
    "parent_id": string,
    "parent_model": string,
    "show_mode": number,
    "model": string,
    "adminFlag": number,
    "shareFlag": number,
    "permitLevel": number,
    "isOnline": boolean,
    "desc": string,
    "extra": {
        "isSetPincode": number,
        "pincodeType": number,
        "fw_version": string,
        "needVerifyCode": number,
        "isPasswordEncrypt": number,
    },
    /** miio user id */
    "uid": number,
    "pd_id": number,
    "password": string,
    "p2p_id": string,
    /** wifi signal quality */
    "rssi": number,
    "family_id": number,
    "reset_flag": number,
}