import './browser/assets/injectAssets';
import { widgetsIndex } from '@sinkapoy/home-integrations-vue-components';
import VacuumCleaner from './browser/widgets/vacuumCleaner/VacuumCleaner.vue';


widgetsIndex.typeAlias['miot-vacuum-cleaner'] = VacuumCleaner;