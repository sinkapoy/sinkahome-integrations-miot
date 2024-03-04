import { Entity } from "@ash.ts/ash";
import { AllDataTypesT, IMiotSpec, SpecAccessModesT } from "./interfaces/IMiotSpec";
import { DataFormat, MiDeviceInfoComponent, MiotDeviceProperties } from "./components";
import { IProperty, PropertiesComponent, Property, PropertyAccessMode, PropertyDataType } from "@sinkapoy/home-core";
import { IMiotDeviceProperty } from "./interfaces/IMiotDeviceProperty";

export class MiotSpecProvider {
    static fillEntityBySpec(spec: IMiotSpec, entity: Entity) {
        const miotProps = entity.get(MiotDeviceProperties);
        const properties = entity.get(PropertiesComponent);

        if (!miotProps || !properties) return;

        properties.createPropertyFromJson({
            id: 'description',
            accessMode: PropertyAccessMode.rw,
            value: spec.description,
        });
        for (const service of spec.services) {
            const serviceName = this.getSpecElementIdByUrn(service.type);
            if (service.properties) {

                for (const propSpec of service.properties) {
                    const propId = serviceName + ':' + this.getSpecElementIdByUrn(propSpec.type);
                    const minMax = propSpec['value-range'] ? propSpec['value-range'] : [undefined, undefined];
                    const dataType = this.convertSpecFormat(propSpec.format);
                    const value = this.defaultValueByFormat(dataType);
                    const accessMode = this.convertSpecAccessMode(propSpec.access);
                    let json = {
                        id: propId,
                        accessMode,
                        min: minMax[0],
                        max: minMax[1],
                        dataType,
                        value: value,
                    } as IProperty;
                    const prop = properties.createPropertyFromJson(json);
                    properties.set(propId, prop);
                    miotProps.set(propId, {
                        homeProperty: prop,
                        name: propId,
                        siid: service.iid,
                        iid: propSpec.iid,
                        urn: propSpec.type,
                        description: propSpec.description,
                        format: this.convertSpecFormat(propSpec.format),
                    });

                }
            }
        }
    }

    static async fetchAllReadableProperties(entity: Entity) {
        const miotProps = entity.get(MiotDeviceProperties);
        const miotInfo = entity.get(MiDeviceInfoComponent);
        if (!miotProps || !miotInfo) return;

        const currentBatch: IMiotDeviceProperty[] = [];
        let index = 0;
        for (const prop of miotProps.values()) {
            if (prop.homeProperty.accessMode & PropertyAccessMode.read) {
                index++;
                currentBatch.push(prop);
            }

            if (miotInfo.localConnection) {
                console.log('query batch', index, currentBatch);
                const queryResult = await miotInfo.localConnection.getProperties(currentBatch);
                console.log(queryResult);
                currentBatch.splice(0);
            }
        }
        console.log('done reading')
    }

    static async writeProperty(entity: Entity, prop: IProperty) {
        const miotInfo = entity.get(MiDeviceInfoComponent);
        const miotProps = entity.get(MiotDeviceProperties);
        if (!miotInfo || !miotProps) return;
        if (miotInfo.localConnection) {
            const miotProp = miotProps.get(prop.id);
            if (!miotProp) {
                console.error('cant find miot property with id', prop.id);
            } else
                miotInfo.localConnection.writeProperties([miotProp]);
        }
    }

    private static getSpecElementIdByUrn(urn: string) {
        return urn.split(':')[3];
    }

    private static convertSpecAccessMode(accessMode: SpecAccessModesT[]) {
        let mode = PropertyAccessMode.none;
        for (let i = 0; i < accessMode.length; i++) {
            switch (accessMode[i]) {
                case 'read':
                    mode = mode | PropertyAccessMode.read;
                    break;
                case 'write':
                    mode = mode | PropertyAccessMode.write;
                    break;
                case 'notify':
                    mode = mode | PropertyAccessMode.notify;
                    break;
            }
        }
        return mode;
    }

    private static convertSpecFormat(format: AllDataTypesT) {
        switch (true) {
            case (format.includes('int')):
                return PropertyDataType.int;
            case (format === 'float'):
                return PropertyDataType.float;
            case (format === 'string'):
                return PropertyDataType.string;
        }
        return PropertyDataType.boolean;
    }

    private static defaultValueByFormat(format: PropertyDataType) {
        switch (format) {
            case PropertyDataType.any:
                return undefined;
            case PropertyDataType.boolean:
                return false;
            case PropertyDataType.float:
            case PropertyDataType.int:
                return 0;
            case PropertyDataType.json:
                return '{}';
            case PropertyDataType.object:
                return {};
            case PropertyDataType.string:
                return '';
        }
    }
}