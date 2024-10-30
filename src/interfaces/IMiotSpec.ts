type UrnT = string;

export type AllDataTypesT = 'string' | 'uint8' | 'uint16' | 'uint32' | 'int8' | 'int32' | 'float' | 'boolean';

export type SpecAccessModesT = 'read' | 'write' | 'notify';

interface EnumT { value: number; desctiption: string; }

type RangeT = [min: number, max: number, step: number];

type UnitsT = 'none';

export interface IMiotSpec {
    /**
     * urn:miot-spec-vX:device:DDDDDD:NNNNNN:TTTTT
     */
    type: UrnT;
    description: string;
    services: {
        iid: number;
        type: UrnT;
        description: string;
        properties?: {
            iid: number;
            /** urn:miot-spec-vX:property:PPPPP:NNNNNN:TTTT */
            type: UrnT;
            description: string;
            format: AllDataTypesT;
            access: SpecAccessModesT[];
            unit?: UnitsT;
            'value-list'?: EnumT;
            'value-range'?: RangeT;
        }[];
        actions?: {
            iid: number;
            /** urn:miot-spec-vX:action:AAAAA:NNNNNN:TTTT */
            type: UrnT;
            description: string;
            in: number[];
            out: number[];
        }[];
        events?: {
            iid: number;
            /** urn:miot-spec-vX:event:EEEEE:NNNNNN:TTTT */
            type: UrnT;
            description: string;
            arguments: number[];
        }[];
    }[];
}
