export interface IMiotDeviceAction {
    name: string;
    /** service id */
    siid: number;
    iid: number;
    inProps: string[];
    outProps: string[];
}
