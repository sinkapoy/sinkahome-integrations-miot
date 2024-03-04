import type { Property, PropertyDataType } from "@sinkapoy/home-core";
import type { DataFormat } from "../components";

export interface IMiotDeviceProperty<T extends PropertyDataType = PropertyDataType.any> {
    name: string;
    /** service id */
    siid: number;
    iid: number;
    urn: string;
    description: string;
    format: PropertyDataType;
    range?: { min: number, max: number, step: number };
    enum?: Record<string, number>;
    homeProperty: Property<T>;
}