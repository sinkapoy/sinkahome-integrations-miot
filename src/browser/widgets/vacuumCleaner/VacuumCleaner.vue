<script setup lang="ts">
import { IWidgetViewModel, rootViewModel, WidgetBaseComponent } from '@sinkapoy/home-integrations-vue-components';
import VaccumCleanerModal from './VaccumCleanerModal.vue';
import image from '../../assets/vacuum.svg';
import { ref } from 'vue';
const props = defineProps<{ widget: IWidgetViewModel; portrait: boolean; }>();
const device = rootViewModel.gadgets[props.widget.properties['vacuumUuid'].value];
const modal = ref(false);

</script>

<template>
    <WidgetBaseComponent
        :widget="props.widget"
        :portrait="props.portrait"
    >
        <template #landscape>
            <div class="landscape-vacuum">
                <img
                    :src="image"
                    @click="modal = true"
                >
            </div>
        </template>
        <template #portrait>
            <div />
        </template>
    </WidgetBaseComponent>
    <VaccumCleanerModal
        v-if="modal"
        :device="device"
        @close="modal = false"
    />
</template>

<style scoped lang="css">
.landscape-vacuum {
    z-index: 999;

    img {
        width: 100%;
        height: auto;
    }
}
</style>