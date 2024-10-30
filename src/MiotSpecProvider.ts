import { type Entity } from '@ash.ts/ash';
import { type AllDataTypesT, type IMiotSpec, type SpecAccessModesT } from './interfaces/IMiotSpec';
import { MiDeviceInfoComponent, MiotDeviceActions, MiotDeviceProperties } from './components';
import { ActionsComponent, type IActionArgument, type IProperty, PropertiesComponent, PropertyAccessMode, PropertyDataType } from '@sinkapoy/home-core';
import { type IMiotDeviceProperty } from './interfaces/IMiotDeviceProperty';

export class MiotSpecProvider {
    static fillEntityBySpec (spec: IMiotSpec, entity: Entity) {
        const miotProps = entity.get(MiotDeviceProperties);
        const miotActions = entity.get(MiotDeviceActions);
        const properties = entity.get(PropertiesComponent);
        const actions = entity.get(ActionsComponent);

        if (!miotProps || !properties || !actions || !miotActions) return;

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
                    const json = {
                        id: propId,
                        accessMode,
                        min: minMax[0],
                        max: minMax[1],
                        dataType,
                        value,
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

            if (service.actions) {
                for (const actionSpec of service.actions) {
                    const actionId = serviceName + ':' + this.getSpecElementIdByUrn(actionSpec.type);

                    const args: IActionArgument[] = [];
                    const miotArgs: string[] = [];
                    const miotResults: string[] = [];
                    if (service.properties) {
                        for (const arg of actionSpec.in) {
                            const propSpec = service.properties[arg];
                            if (!propSpec) continue;
                            args.push({
                                name: this.getSpecElementIdByUrn(propSpec.type),
                                type: this.convertSpecFormat(propSpec.format),
                            });
                            miotArgs.push(serviceName + ':' + this.getSpecElementIdByUrn(propSpec.type));
                        }

                        for (const arg of actionSpec.out) {
                            const propSpec = service.properties[arg];
                            if (!propSpec) continue;
                            miotResults.push(serviceName + ':' + this.getSpecElementIdByUrn(propSpec.type));
                        }
                    }
                    actions.addFromJson({
                        id: actionId,
                        argsT: args,
                        resultT: [],
                    });
                    miotActions.set(actionId, {
                        name: serviceName,
                        siid: service.iid,
                        iid: actionSpec.iid,
                        inProps: miotArgs,
                        outProps: miotResults,
                    });
                }
            }
        }
    }

    static async fetchAllReadableProperties (entity: Entity) {
        const miotProps = entity.get(MiotDeviceProperties);
        const miotInfo = entity.get(MiDeviceInfoComponent);
        if (!miotProps || !miotInfo) return;

        const currentBatch: IMiotDeviceProperty[] = [];
        for (const prop of miotProps.values()) {
            if (prop.homeProperty.accessMode & PropertyAccessMode.read) {
                currentBatch.push(prop);
            }

            if (miotInfo.localConnection && currentBatch.length > 9) {
                const queryResult = await miotInfo.localConnection.getProperties(currentBatch);
                if (queryResult.result) {
                    const result = queryResult.result;
                    for (let i = 0; i < currentBatch.length; i++) {
                        if (result[i]?.value !== undefined) {
                            currentBatch[i].homeProperty.value = result[i].value;
                        }
                    }
                }
                if (queryResult) { currentBatch.splice(0); }
            }
        }
        if (miotInfo.localConnection && currentBatch.length) {
            const queryResult = await miotInfo.localConnection.getProperties(currentBatch);
            if (queryResult.result) {
                const result = queryResult.result;
                for (let i = 0; i < currentBatch.length; i++) {
                    if (result[i]?.value !== undefined) {
                        currentBatch[i].homeProperty.value = result[i].value;
                    }
                }
            }
            if (queryResult) { currentBatch.splice(0); }
        }
    }

    static async writeProperty (entity: Entity, prop: IProperty) {
        const miotInfo = entity.get(MiDeviceInfoComponent);
        const miotProps = entity.get(MiotDeviceProperties);
        if (!miotInfo || !miotProps) return;
        if (miotInfo.localConnection) {
            const miotProp = miotProps.get(prop.id);
            if (!miotProp) {
                console.error('cant find miot property with id', prop.id);
            } else {
                const result = await miotInfo.localConnection.writeProperties([miotProp]);
                if (result.result[0].code === 0) {
                    return true;
                }
            }
        }
        return false;
    }

    private static getSpecElementIdByUrn (urn: string) {
        return urn.split(':')[3];
    }

    private static convertSpecAccessMode (accessMode: SpecAccessModesT[]) {
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

    private static convertSpecFormat (format: AllDataTypesT) {
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

    private static defaultValueByFormat (format: PropertyDataType) {
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
