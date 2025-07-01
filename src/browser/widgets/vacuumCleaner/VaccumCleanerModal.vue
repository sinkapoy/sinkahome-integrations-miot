<script setup lang="ts">
import { icons, IWidgetViewModel, JoystickComponent, ModalWindowComponent, Point } from '@sinkapoy/home-integrations-vue-components';
import WriteVacuumPropComponent from './WriteVacuumPropComponent.vue';
import { waterIcons } from 'src/browser/assets/injectAssets';
import { reactive } from 'vue';
import { WritePropertyCommand } from '@sinkapoy/home-integrations-commands';


const { device } = defineProps<{ device: IWidgetViewModel; }>();
const actions = [
    { id: 'vacuum:start-sweep', icon: icons.play },
    { id: 'vacuum:stop-sweeping', icon: icons.pause },
    { id: 'battery:start-charge', icon: icons.home },
];
const mopMods = ['sweep', 'sweepAndMop', 'mop'];
const suctionStates = ['silent',
    'standart',
    'medium',
    'turbo',];
const wateringStates = [
    'low',
    'mid',
    'high'
];

enum ModalState {
    default,
    driving,
}

// back:4
// exit:10
// forward:1
// left:2
// right:3
// stop:5
const drivingCommands = {
    'forward': new WritePropertyCommand(device.uuid, 'sweep:direction', 1),
    'left': new WritePropertyCommand(device.uuid, 'sweep:direction', 2),
    'back': new WritePropertyCommand(device.uuid, 'sweep:direction', 4),
    'right': new WritePropertyCommand(device.uuid, 'sweep:direction', 3),
    'stop': new WritePropertyCommand(device.uuid, 'sweep:direction', 5),
    'exit': new WritePropertyCommand(device.uuid, 'sweep:direction', 10),
};

const modalStore = reactive({
    state: ModalState.default,
    currentCommand: <keyof typeof drivingCommands>'stop',
    interval: -1,
});

const updateState = (pad: Point) => {
    if((Math.abs(pad.x) < 0.4) && (Math.abs(pad.y) < 0.4)){
        clearInterval(modalStore.interval);
        modalStore.interval = -1;
        drivingCommands['stop'].execute();
    } else {
        if (modalStore.interval < 0) {
            modalStore.interval = setInterval(() => {
                drivingCommands[modalStore.currentCommand].execute();
            }, 300) as unknown as number;
        }
        if (Math.abs(pad.y) >= Math.abs(pad.x)) {
            switch (true) {
                case (pad.y > 0): {
                    modalStore.currentCommand = 'forward';
                }
                    break;
                case (pad.y < 0): {
                    modalStore.currentCommand = 'back';
                }
                    break;
            }

        } else {
            switch (true) {
                case (pad.x > 0): {
                    modalStore.currentCommand = 'right';
                }
                    break;
                case (pad.x < 0): {
                    modalStore.currentCommand = 'left';
                }
                    break;
            }
        }
    }
    
    
};

</script>

<template>
    <ModalWindowComponent
        :header="'id: ' + device.uuid"
        class="vacuum-modal"
    >
        <div class="vacuum-modal__uprow">
            <div class="actions">
                <template
                    v-for="action in actions"
                    :key="action.id"
                >
                    <button
                        class="circlebtn"
                    >
                        <img :src="action.icon">
                    </button>
                </template>
            </div>
            <div class="map" />
        </div>
        <div class="vacuum-modal__downrow">
            <div class="vacuum-modal__default">
                <h5>Mode</h5>
                <div class="downrow__btns">
                    <template
                        v-for="mopMod in mopMods"
                        :key="mopMod"
                    >
                        <WriteVacuumPropComponent
                            class="circlebtn"
                            :device="device"
                            prop="vacuum:mode"
                            :value="mopMod"
                        />
                    </template>
                    <button
                        class="propbtn circlebtn"
                    >
                        <img :src="icons['joystick']">
                    </button>
                </div>
                <h5>Suction power</h5>
                <div class="downrow__btns">
                    <template
                        v-for="state in suctionStates"
                        :key="state"
                    >
                        <WriteVacuumPropComponent
                            class="circlebtn"
                            :device="device"
                            prop="sweep:suction-state"
                            :value="state"
                        />
                    </template>
                </div>
                <h5>Watering</h5>
                <div class="downrow__btns">
                    <template
                        v-for="state in wateringStates"
                        :key="state"
                    >
                        <WriteVacuumPropComponent
                            class="circlebtn"
                            :device="device"
                            prop="sweep:water-state"
                            :value="state"
                            :icons-map="waterIcons"
                        />
                    </template>
                </div>
            </div>
            <div class="vacuum-modal__driving">
                <div>
                    <JoystickComponent
                        size="4rem"
                        @update="updateState"
                    />
                </div>
            </div>
        </div>
    </ModalWindowComponent>
</template>

<style lang="scss" scoped>
.vacuum-modal {
    max-width: 80vw;

    &__uprow {
        display: flex;
        flex-direction: row;

    }

    &__default {
        display: flex;
        flex-direction: column;
        grid-column: 1;
        grid-row: 1;
    }

    &__driving {
        display: flex;
        flex-direction: column;
        grid-column: 2;
        grid-row: 1;
    }

    &__downrow {
        display: grid;
        grid-template-columns: 2;
        grid-template-rows: 1;
    }


}

.downrow {
    &__btns {
        display: flex;
        flex-direction: row;
    }
}

.actions {
    display: flex;
    flex-direction: column;

    button {
        background-color: var(--main-color);
    }
}

.map {
    display: block;
    flex: 1;
    background-color: var(--main-color);
}

.circlebtn {
    width: 3rem;
    height: 3rem;
    border-radius: 1.5rem;
    text-align: center;

    img {
        width: 100%;
        height: auto;
    }
}
</style>