type UrnT = string;

export type AllDataTypesT = 'string' | 'uint8' | 'uint16' | 'uint32' | 'int8' | 'int32' | 'float' | 'boolean';

export type SpecAccessModesT = 'read' | 'write' | 'notify';

type EnumT = { value: number, desctiption: string };

type RangeT = [min: number, max: number, step: number];

type UnitsT = 'none';

// interface IActionArgs{
    // 1 - order-id
    // 2 - enable
    // 3 - day
    // 4 - hour
    // 5 - minute
    // 6 - repeat
    // 10 - room-ids
    // 11 - mapid
    // 12 - room-count
    // 14 - time-zone
    // 16 - room-preference
    // [17]: 'consumable-index';
    // 19 - is-global
    // 24 - clean-room-ids
    // 25 - clean-room-mode
    // 26 - clean-room-oper

    
    // 33 - clean-current-map
    // 34 - clean-preference
    // 38 - clean-prefer-type
    // 43 - go-charging
// }

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