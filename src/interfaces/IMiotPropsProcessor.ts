import {Property} from '@sinkapoy/home-core';

export type MiotPropsProcessorT = Record<string, (property: Property<any>)=>void>