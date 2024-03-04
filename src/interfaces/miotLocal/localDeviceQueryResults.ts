import { KnownErrors } from "./KnownErrors";

interface IProperty {
    did: string;
    siid: number;
    piid: number;
    code: number;
    value: number | string | boolean;
}
export interface IGetProperties {
    result: IProperty[];
}
export interface IResultWithError {
    error: {
        code: KnownErrors,
        message: string,
    }
}