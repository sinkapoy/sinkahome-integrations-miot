import { MiotPropsProcessorT } from './../interfaces/IMiotPropsProcessor';
import { PropertiesComponent } from '@sinkapoy/home-core';
import { Entity } from '@ash.ts/ash';
import { processVacuumProperies } from './vacuumCleaner';

export class PropertiesProcessor {
    static process(entity: Entity){
        const props = entity.get(PropertiesComponent);
        if(!props) return;
        this.processByConfig(processVacuumProperies, props);
    }

    private static processByConfig(config: MiotPropsProcessorT, props: PropertiesComponent){
        for(const propId in config){
            if(props.has(propId)){
                config[propId](props.get(propId)!);
            }
        }
    }
}