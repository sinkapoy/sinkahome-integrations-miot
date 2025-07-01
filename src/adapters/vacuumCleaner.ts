import { MiotPropsProcessorT } from './../interfaces/IMiotPropsProcessor';
enum VacuumState {
    sleep,
    idle,
    paused,
    goCharging,
    charging,
    sweeping,
    sweepingAndMopping,
    mopping,
    upgrading
}
export enum VacuumMode {
    sweep,
    sweepAndMop,
    mop,
}
enum VacuumSweepType {
    global,
    mop,
    edge,
    area,
    point,
    remote,
    explore,
    room,
    floor,
}

enum SuctionState {
    silent,
    standart,
    medium,
    turbo,
}

enum SweepDirection {
    forward = 1,
    left,
    right,
    back,
    stop,
    exit = 10,
}
export enum SweepConsumableIndex {
    main = 1,
    size,
    hypa,
    cloth,
}
enum SweepMopRoute{
    s, // snake style
    y, // y style
}
enum SweepWaterState{
    low,
    mid,
    high
}
enum SweepDoorState {
    none,
    dustCollectorOpen,
    waterBoxOpen,
    bothOpen,
}

export const processVacuumProperies: MiotPropsProcessorT = {
    'vacuum:mode': (property)=>{
        property.enumData = {
            sweep: VacuumMode.sweep,
            mop: VacuumMode.mop,
            sweepAndMop: VacuumMode.sweepAndMop,
        };
    },
    'vacuum:status': (property)=>{
        property.enumData = {
            sleep: VacuumState.sleep,
            idle:VacuumState.idle,
            paused:VacuumState.paused,
            goCharging:VacuumState.goCharging,
            charging:VacuumState.charging,
            sweeping:VacuumState.sweeping,
            sweepingAndMopping:VacuumState.sweepingAndMopping,
            mopping:VacuumState.mopping,
            upgrading:VacuumState.upgrading,
        };
    },
    'vacuum:sweep-type': (property)=>{
        property.enumData = {
            global:VacuumSweepType.global,
            mop:VacuumSweepType.mop,
            edge:VacuumSweepType.edge,
            area:VacuumSweepType.area,
            point:VacuumSweepType.point,
            remote:VacuumSweepType.remote,
            explore:VacuumSweepType.explore,
            room:VacuumSweepType.room,
            floor:VacuumSweepType.floor,
        };
    },
    'sweep:suction-state': (property)=>{
        property.enumData = {
            silent:SuctionState.silent,
            standart:SuctionState.standart,
            medium:SuctionState.medium,
            turbo:SuctionState.turbo,
        };
    },
    'sweep:direction': (property)=>{
        property.enumData = {
            forward:SweepDirection.forward,
            left:SweepDirection.left,
            right:SweepDirection.right,
            back:SweepDirection.back,
            stop:SweepDirection.stop,
            exit:SweepDirection.exit,
        };
    },
    'sweep:mop-route': (property)=>{
        property.enumData = {
            'snake-style': SweepMopRoute.s,
            'y-style': SweepMopRoute.y,
        };
    },
    'sweep:water-state': (property)=>{
        property.enumData = {
            low:SweepWaterState.low,
            mid:SweepWaterState.mid,
            high:SweepWaterState.high,
        };
    },
    'sweep:door-state': (property)=>{
        property.enumData = {
            none:SweepDoorState.none,
            dustCollectorOpen:SweepDoorState.dustCollectorOpen,
            waterBoxOpen:SweepDoorState.waterBoxOpen,
            bothOpen:SweepDoorState.bothOpen,
        };
    },
};