import { Entity } from '@ash.ts/ash';
import { homeEngine, HomeEngineT, PropertiesComponent, PropertyAccessMode, PropertyDataType, uuidT } from '@sinkapoy/home-core';
import {buildWidgetBase, ICommonWidgetConfig, IServerWidgetsEvents} from '@sinkapoy/home-integrations-server-widgets';
interface IVacuumConfig extends ICommonWidgetConfig {
    vacuumUuid: uuidT;
}
const engine = homeEngine as HomeEngineT<IServerWidgetsEvents>;
engine.nextUpdate(() => {
    engine.emit('widgets:register-builder', 'miot-vacuum-cleaner', (config: Partial<IVacuumConfig>, widgets: Map<uuidT, Entity>) => {
        if (widgets.has(config.uuid ?? '')) return undefined;

        const entity = buildWidgetBase(config as ICommonWidgetConfig);
        const props = entity.get(PropertiesComponent)!;
        props.createPropertyFromJson({
            id: 'vacuumUuid',
            accessMode: PropertyAccessMode.rwn,
            dataType: PropertyDataType.string,
            value: config.vacuumUuid ?? '',
        });

        return entity;
    });
});