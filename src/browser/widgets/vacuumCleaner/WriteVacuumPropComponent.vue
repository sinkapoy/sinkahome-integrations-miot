<script setup lang="ts">
import { WritePropertyCommand } from '@sinkapoy/home-integrations-commands';
import { icons, IWidgetViewModel } from '@sinkapoy/home-integrations-vue-components';
import { onBeforeUnmount, ref, watch } from 'vue';

const { device, prop, value, iconsMap = icons } = defineProps<{ device: IWidgetViewModel; prop: string; value: string; iconsMap?: Record<string, string>;}>();
const emit = defineEmits<{(e: 'click'):void;}>();
const property = device.properties[prop];
const realValue = property.enumData![value];
const active = ref(property.value === realValue);
console.log(active.value, realValue, property.value);
const watcher = watch(property, () => {
    if (property.value === realValue) {
        active.value = true;
    } else {
        active.value = false;
    }
});

const writePropCommand = new WritePropertyCommand(device.uuid, prop, property?.enumData ? property.enumData[value] : undefined);
const writeProp = ()=>{
    if(prop){
        writePropCommand.execute();
    }
    emit('click');
};
onBeforeUnmount(watcher);

</script>

<template>
    <button
        :class="active ? 'propbtn propbtn-active' : 'propbtn'"
        @click="writeProp"
    >
        <img :src="iconsMap[value]">
    </button>
</template>

<style lang="scss" scoped>
.propbtn {
    background-color: var(--main-color);

    img {
        width: 100%;
        height: auto;
    }
}

.propbtn-active {
    background-color: var(--accent-color);
}
</style>